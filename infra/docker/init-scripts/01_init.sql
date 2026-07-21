-- EdgeSphere Database Init Script
-- Runs automatically when PostgreSQL container starts for the first time

-- ─── Enable Extensions ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- TimescaleDB extension (for analytics)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─── Auth Tables ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  key_hash    VARCHAR(255) NOT NULL,
  key_prefix  VARCHAR(20) NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ─── Storage Tables ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buckets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(63) UNIQUE NOT NULL,
  region       VARCHAR(50) DEFAULT 'us-east-1',
  is_public    BOOLEAN DEFAULT false,
  storage_class VARCHAR(20) DEFAULT 'standard',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buckets_user_id ON buckets(user_id);
CREATE INDEX idx_buckets_name ON buckets(name);

CREATE TABLE IF NOT EXISTS files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id    UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  key          VARCHAR(1024) NOT NULL,
  size         BIGINT NOT NULL DEFAULT 0,
  content_type VARCHAR(255),
  etag         VARCHAR(255),
  version      INTEGER DEFAULT 1,
  is_latest    BOOLEAN DEFAULT true,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bucket_id, key, version)
);

CREATE INDEX idx_files_bucket_id ON files(bucket_id);
CREATE INDEX idx_files_key ON files(bucket_id, key);

-- ─── Analytics Tables (TimescaleDB) ───────────────────────────
CREATE TABLE IF NOT EXISTS request_events (
  time         TIMESTAMPTZ NOT NULL,
  service      VARCHAR(50),
  method       VARCHAR(10),
  path         VARCHAR(1024),
  status       SMALLINT,
  latency_ms   INTEGER,
  user_id      UUID,
  ip           INET,
  country      CHAR(2),
  cache_hit    BOOLEAN DEFAULT false,
  bytes        BIGINT DEFAULT 0,
  edge_region  VARCHAR(50),
  request_id   UUID DEFAULT uuid_generate_v4()
);

-- Convert to TimescaleDB hypertable (partitioned by time)
SELECT create_hypertable('request_events', 'time', if_not_exists => TRUE);

-- Add compression policy (compress chunks older than 7 days)
SELECT add_compression_policy('request_events', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (delete data older than 90 days)
SELECT add_retention_policy('request_events', INTERVAL '90 days', if_not_exists => TRUE);

-- Indexes for common query patterns
CREATE INDEX idx_request_events_service ON request_events(service, time DESC);
CREATE INDEX idx_request_events_user ON request_events(user_id, time DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_request_events_country ON request_events(country, time DESC);

-- ─── Seed Data ─────────────────────────────────────────────────
-- Default admin user (password: admin123 — change immediately!)
-- Password hash: bcrypt of 'admin123' with 12 rounds
INSERT INTO users (id, email, password_hash, role)
VALUES (
  uuid_generate_v4(),
  'admin@edgesphere.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0NpFzBCKBe',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ─── Update Triggers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER buckets_updated_at
  BEFORE UPDATE ON buckets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
