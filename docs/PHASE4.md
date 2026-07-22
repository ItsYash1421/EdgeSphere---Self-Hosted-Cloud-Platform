# Phase 4 — Advanced Resilience & Real-time

## Circuit Breaker (Gateway)
- Library: opossum
- Threshold: 50% error rate → OPEN
- Reset: 30 seconds HALF-OPEN probe
- Per-service: auth, storage, analytics, cdn, cache
- Dashboard: GET /resilience/circuit-breakers

## Dead Letter Queue
- Topics: request.events.dlq, storage.events.dlq
- Retry: 30s → 5min → 30min → permanent failure
- Metrics: dlq_messages_total, dlq_retry_success_total

## OAuth2
- Providers: Google, GitHub
- Flow: Redirect → OAuth provider → callback → JWT pair → redirect to dashboard
- User: auto-created on first OAuth login

## Resumable Multipart Upload
- Initiate → get uploadId + partCount
- Upload parts (5MB each) in parallel
- Complete → MinIO assembles, DB saved
- Abort → cleanup
- 24h session TTL in Redis

## WebSocket Real-time
- Service: websocket-gateway (Socket.io)
- Rooms: metrics, events, alerts, cdn, storage
- Feeds: Kafka consumer → Socket.io emit
- Dashboard hooks: useRealtimeMetrics, useRealtimeEvents, useRealtimeAlerts
- Metrics update frequency: every 5 seconds
