FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o bin/edge-server ./cmd/server

FROM alpine:3.19 AS runner
RUN apk add --no-cache ca-certificates wget
RUN addgroup -g 1001 -S edge && adduser -S edge -u 1001
WORKDIR /app
COPY --from=builder /app/bin/edge-server ./edge-server
RUN mkdir -p /cache && chown -R edge:edge /cache
USER edge
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["./edge-server"]
