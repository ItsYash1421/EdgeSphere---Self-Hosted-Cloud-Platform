package main

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all Prometheus metrics for the edge server
type Metrics struct {
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	cacheHits       *prometheus.CounterVec
	cacheMisses     *prometheus.CounterVec
	bandwidthBytes  *prometheus.CounterVec
	cacheSize       *prometheus.GaugeVec
}

// NewMetrics initializes and registers all Prometheus metrics
func NewMetrics(region string) *Metrics {
	m := &Metrics{
		requestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "edge_requests_total",
			Help: "Total number of requests handled by this edge server",
		}, []string{"region", "method", "status"}),

		requestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "edge_request_duration_seconds",
			Help:    "Request duration in seconds",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		}, []string{"region", "method"}),

		cacheHits: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "edge_cache_hits_total",
			Help: "Total cache hits",
		}, []string{"region"}),

		cacheMisses: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "edge_cache_misses_total",
			Help: "Total cache misses",
		}, []string{"region"}),

		bandwidthBytes: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "edge_bandwidth_bytes_total",
			Help: "Total bytes served",
		}, []string{"region"}),

		cacheSize: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "edge_cache_size_bytes",
			Help: "Current cache size in bytes",
		}, []string{"region", "level"}),
	}

	prometheus.MustRegister(
		m.requestsTotal,
		m.requestDuration,
		m.cacheHits,
		m.cacheMisses,
		m.bandwidthBytes,
		m.cacheSize,
	)

	return m
}

func (m *Metrics) RecordRequest(region, method string, status int, duration time.Duration) {
	statusStr := http.StatusText(status)
	m.requestsTotal.WithLabelValues(region, method, statusStr).Inc()
	m.requestDuration.WithLabelValues(region, method).Observe(duration.Seconds())
}

func (m *Metrics) RecordCacheHit(region string) {
	m.cacheHits.WithLabelValues(region).Inc()
}

func (m *Metrics) RecordCacheMiss(region string) {
	m.cacheMisses.WithLabelValues(region).Inc()
}

func (m *Metrics) RecordBandwidth(region string, bytes int64) {
	m.bandwidthBytes.WithLabelValues(region).Add(float64(bytes))
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}
