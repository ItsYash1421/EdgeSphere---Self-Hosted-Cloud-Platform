module github.com/edgesphere/edge-server

go 1.22

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/prometheus/client_golang v1.19.0
	github.com/gorilla/mux v1.8.1
	github.com/google/uuid v1.6.0
	go.opentelemetry.io/otel v1.27.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.27.0
	go.opentelemetry.io/otel/sdk v1.27.0
	go.opentelemetry.io/otel/trace v1.27.0
	go.uber.org/zap v1.27.0
)
