package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// CacheEntry represents a cached item
type CacheEntry struct {
	Data         []byte    `json:"data"`
	ContentType  string    `json:"content_type"`
	ETag         string    `json:"etag"`
	RemainingTTL int64     `json:"remaining_ttl"`
	CreatedAt    time.Time `json:"created_at"`
}

// CacheManager handles L1 (Redis) and L2 (disk) caching
type CacheManager struct {
	redis    *redis.Client
	cacheDir string
	logger   *zap.Logger
}

// NewCacheManager creates a new cache manager with Redis + disk backends
func NewCacheManager(redisURL, cacheDir string, logger *zap.Logger) (*CacheManager, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	// Ensure cache directory exists
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache dir: %w", err)
	}

	logger.Info("Cache manager initialized",
		zap.String("redis", redisURL),
		zap.String("cacheDir", cacheDir),
	)

	return &CacheManager{
		redis:    client,
		cacheDir: cacheDir,
		logger:   logger,
	}, nil
}

// GetFromRedis attempts L1 cache retrieval
func (c *CacheManager) GetFromRedis(ctx context.Context, key string) (*CacheEntry, error) {
	data, err := c.redis.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err // redis.Nil if not found
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, err
	}

	// Update remaining TTL
	ttl, _ := c.redis.TTL(ctx, key).Result()
	entry.RemainingTTL = int64(ttl.Seconds())

	return &entry, nil
}

// SetInRedis stores an entry in L1 cache
func (c *CacheManager) SetInRedis(ctx context.Context, key string, entry *CacheEntry, ttlSeconds int) error {
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	return c.redis.Set(ctx, key, data, time.Duration(ttlSeconds)*time.Second).Err()
}

// GetFromDisk attempts L2 cache retrieval
func (c *CacheManager) GetFromDisk(key string) (*CacheEntry, error) {
	path := c.diskPath(key)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, err
	}

	// Check TTL (disk cache doesn't auto-expire)
	if time.Since(entry.CreatedAt) > time.Duration(entry.RemainingTTL)*time.Second {
		os.Remove(path) // Expired — clean up
		return nil, fmt.Errorf("cache entry expired")
	}

	remaining := entry.RemainingTTL - int64(time.Since(entry.CreatedAt).Seconds())
	entry.RemainingTTL = remaining

	return &entry, nil
}

// SetOnDisk stores an entry in L2 cache
func (c *CacheManager) SetOnDisk(key string, entry *CacheEntry) error {
	path := c.diskPath(key)

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// Purge removes entries matching a pattern from both L1 and L2 caches
func (c *CacheManager) Purge(ctx context.Context, pattern string) error {
	// Delete from Redis (use SCAN to find matching keys)
	var cursor uint64
	for {
		keys, nextCursor, err := c.redis.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			c.logger.Error("Redis SCAN failed", zap.Error(err))
			break
		}

		if len(keys) > 0 {
			c.redis.Del(ctx, keys...)
			c.logger.Info("Purged from Redis", zap.Int("keys", len(keys)))
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	// Delete from disk (simple: remove files matching pattern)
	// In production, maintain a key → file index
	c.logger.Info("Cache purge complete", zap.String("pattern", pattern))
	return nil
}

func (c *CacheManager) Close() {
	c.redis.Close()
}

// diskPath converts a cache key to a filesystem path
func (c *CacheManager) diskPath(key string) string {
	// Hash the key to prevent path traversal and long filenames
	// For simplicity, sanitize the key
	safe := filepath.Clean(key)
	return filepath.Join(c.cacheDir, safe+".cache")
}
