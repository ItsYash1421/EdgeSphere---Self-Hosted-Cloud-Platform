package main

import (
	"compress/gzip"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// loggingMiddleware logs every incoming request with key metadata
func loggingMiddleware(logger *zap.Logger, region string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap ResponseWriter to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		logger.Info("request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.Int("status", wrapped.statusCode),
			zap.Duration("latency", time.Since(start)),
			zap.String("ip", r.RemoteAddr),
			zap.String("region", region),
			zap.String("cache", w.Header().Get("X-Cache")),
		)
	})
}

// corsMiddleware adds permissive CORS headers (tighten in production)
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Expose-Headers", "X-Cache, X-Edge-Region, X-Cache-TTL, ETag")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// compressionMiddleware adds Gzip compression for text-based content
func compressionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		gz, err := gzip.NewWriterLevel(w, gzip.BestSpeed)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		defer gz.Close()

		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length") // length changes after compression

		gzw := &gzipResponseWriter{ResponseWriter: w, Writer: gz}
		next.ServeHTTP(gzw, r)
	})
}

// makePurgeHandler handles cache purge requests (internal use only)
func makePurgeHandler(cache *CacheManager, logger *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bucket := r.URL.Query().Get("bucket")
		key := r.URL.Query().Get("key")

		if bucket == "" {
			http.Error(w, "bucket parameter required", http.StatusBadRequest)
			return
		}

		cacheKey := "edge:*:" + bucket
		if key != "" {
			cacheKey = "edge:*:" + bucket + "/" + key
		}

		if err := cache.Purge(r.Context(), cacheKey); err != nil {
			logger.Error("Cache purge failed", zap.Error(err))
			http.Error(w, "Purge failed", http.StatusInternalServerError)
			return
		}

		logger.Info("Cache purged", zap.String("bucket", bucket), zap.String("key", key))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"purged"}`))
	}
}

// responseWriter captures the HTTP status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// gzipResponseWriter wraps gzip writer with ResponseWriter
type gzipResponseWriter struct {
	http.ResponseWriter
	Writer *gzip.Writer
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	return g.Writer.Write(b)
}
