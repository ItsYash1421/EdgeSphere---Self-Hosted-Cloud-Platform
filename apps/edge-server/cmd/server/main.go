package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
)

func main() {
	// ─── Logger ─────────────────────────────────────────────────
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// ─── Config from environment ─────────────────────────────────
	port := getEnv("EDGE_PORT", "8080")
	region := getEnv("EDGE_REGION", "us-east-1")
	originURL := getEnv("ORIGIN_URL", "http://localhost:3002")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")
	cacheDir := getEnv("CACHE_DIR", "/cache")

	logger.Info("Starting EdgeSphere edge server",
		zap.String("port", port),
		zap.String("region", region),
		zap.String("origin", originURL),
	)

	// ─── Cache ───────────────────────────────────────────────────
	cache, err := NewCacheManager(redisURL, cacheDir, logger)
	if err != nil {
		logger.Fatal("Failed to initialize cache manager", zap.Error(err))
	}
	defer cache.Close()

	// ─── Metrics ─────────────────────────────────────────────────
	metrics := NewMetrics(region)

	// ─── Router ──────────────────────────────────────────────────
	r := mux.NewRouter()

	// CDN serving endpoint
	r.PathPrefix("/cdn/").HandlerFunc(
		makeEdgeHandler(cache, metrics, originURL, region, logger),
	).Methods(http.MethodGet, http.MethodHead)

	// Cache purge endpoint (internal only)
	r.HandleFunc("/internal/cache/purge", makePurgeHandler(cache, logger)).
		Methods(http.MethodPost)

	// Prometheus metrics
	r.Handle("/metrics", metrics.Handler())

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","region":"%s","timestamp":"%s"}`,
			region, time.Now().UTC().Format(time.RFC3339))
	})

	// ─── Middleware chain ────────────────────────────────────────
	handler := loggingMiddleware(logger, region,
		corsMiddleware(
			compressionMiddleware(r),
		),
	)

	// ─── HTTP Server ──────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// ─── Graceful Shutdown ────────────────────────────────────────
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server error", zap.Error(err))
		}
	}()

	logger.Info("Edge server ready", zap.String("addr", ":"+port))
	<-done

	logger.Info("Shutting down edge server...")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Shutdown error", zap.Error(err))
	}
	logger.Info("Edge server stopped")
}

// makeEdgeHandler is the core CDN handler: cache hit → serve, miss → fetch from origin
func makeEdgeHandler(
	cache *CacheManager,
	metrics *Metrics,
	originURL string,
	region string,
	logger *zap.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Build cache key from path + query params
		cacheKey := buildCacheKey(r, region)

		// ─── L1: Redis Cache ──────────────────────────────────
		if entry, err := cache.GetFromRedis(r.Context(), cacheKey); err == nil {
			metrics.RecordCacheHit(region)
			metrics.RecordRequest(region, r.Method, http.StatusOK, time.Since(start))

			w.Header().Set("Content-Type", entry.ContentType)
			w.Header().Set("X-Cache", "HIT")
			w.Header().Set("X-Cache-TTL", fmt.Sprintf("%d", entry.RemainingTTL))
			w.Header().Set("X-Edge-Region", region)
			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", entry.RemainingTTL))
			w.Header().Set("ETag", entry.ETag)

			w.WriteHeader(http.StatusOK)
			w.Write(entry.Data)

			logger.Debug("Cache HIT (Redis)",
				zap.String("key", cacheKey),
				zap.Duration("latency", time.Since(start)),
			)
			return
		}

		// ─── L2: Disk Cache ───────────────────────────────────
		if entry, err := cache.GetFromDisk(cacheKey); err == nil {
			metrics.RecordCacheHit(region)

			// Repopulate L1
			go cache.SetInRedis(r.Context(), cacheKey, entry, 3600)

			w.Header().Set("Content-Type", entry.ContentType)
			w.Header().Set("X-Cache", "HIT")
			w.Header().Set("X-Cache-Source", "disk")
			w.Header().Set("X-Edge-Region", region)

			w.WriteHeader(http.StatusOK)
			w.Write(entry.Data)
			return
		}

		// ─── L3: Origin Fetch ─────────────────────────────────
		metrics.RecordCacheMiss(region)

		// Strip /cdn prefix and forward to origin
		originPath := r.URL.Path[len("/cdn"):]
		originReq, err := http.NewRequestWithContext(
			r.Context(),
			http.MethodGet,
			originURL+originPath+"?"+r.URL.RawQuery,
			nil,
		)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Forward relevant headers
		originReq.Header.Set("X-Edge-Region", region)
		originReq.Header.Set("X-Forwarded-For", r.RemoteAddr)

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(originReq)
		if err != nil {
			logger.Error("Origin fetch failed",
				zap.String("origin", originURL),
				zap.Error(err),
			)
			http.Error(w, "Origin unavailable", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, "Failed to read origin response", http.StatusInternalServerError)
			return
		}

		contentType := resp.Header.Get("Content-Type")
		etag := resp.Header.Get("ETag")
		if etag == "" {
			etag = fmt.Sprintf(`"%x"`, time.Now().UnixNano())
		}

		// Store in cache (async)
		entry := &CacheEntry{
			Data:         body,
			ContentType:  contentType,
			ETag:         etag,
			RemainingTTL: 3600,
		}
		go func() {
			cache.SetInRedis(context.Background(), cacheKey, entry, 3600)
			cache.SetOnDisk(cacheKey, entry)
		}()

		// Respond
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("X-Cache", "MISS")
		w.Header().Set("X-Edge-Region", region)
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "public, max-age=3600")

		metrics.RecordRequest(region, r.Method, resp.StatusCode, time.Since(start))
		metrics.RecordBandwidth(region, int64(len(body)))

		w.WriteHeader(resp.StatusCode)
		w.Write(body)

		logger.Debug("Cache MISS → origin fetch",
			zap.String("key", cacheKey),
			zap.Duration("latency", time.Since(start)),
			zap.Int("size", len(body)),
		)
	}
}

func buildCacheKey(r *http.Request, region string) string {
	return fmt.Sprintf("edge:%s:%s:%s", region, r.URL.Path, r.URL.RawQuery)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
