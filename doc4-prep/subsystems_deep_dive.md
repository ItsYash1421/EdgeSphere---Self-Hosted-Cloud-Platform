# EdgeSphere — Subsystem Deep Dives

`architecture_explanation.md` walks through the *end-to-end request flow*. This document goes one
level deeper into the five subsystems that generate the toughest interview follow-ups — rate
limiting, circuit breaking, auth/RBAC, caching, and the Kafka/WebSocket event pipeline — with the
actual code behind each claim (file paths included) so you can defend every sentence if an
interviewer asks "show me." Where the real implementation has a genuine trade-off or limitation, it's
called out explicitly rather than glossed over — being able to name your own system's weak points is
worth more in an interview than pretending it has none.

---

## 1. Rate Limiting — two algorithms, two different guarantees

**File:** `apps/gateway/src/rate-limit/rate-limit.service.ts`

EdgeSphere implements both algorithms discussed in system design interviews, and uses them for
different things:

### Token Bucket (per-user, allows bursts)
```ts
async tokenBucket(identifier: string, capacity = 100, refillRatePerSec = 10) {
  const key = `ratelimit:tb:${identifier}`;
  const [tokensStr, lastRefillStr] = await this.redis.hmget(key, 'tokens', 'lastRefill');
  let tokens = tokensStr ? parseFloat(tokensStr) : capacity;
  // ... refill based on elapsed time, then decrement by 1 if tokens >= 1
  await this.redis.hmset(key, { tokens: tokens.toString(), lastRefill: now.toString() });
}
```
A Redis hash stores `{tokens, lastRefill}`. On each call, tokens are lazily refilled based on
wall-clock time elapsed since the last request (`deltaSec * refillRatePerSec`), capped at `capacity`.
This is what lets a client burst up to `capacity` requests instantly after being idle, then settle
into the steady-state refill rate — the defining property of token bucket vs. fixed/sliding window.

**Honest limitation:** this is a **read-modify-write**, not an atomic Redis operation — `HMGET` then
compute in application code then `HMSET`. Two concurrent requests from the same user could both read
the same `tokens` value before either writes back, both see `tokens >= 1`, and both get admitted —
a classic race condition. The fix (and a great "what would you improve" answer) is wrapping the
read-compute-write in a Lua script (`EVAL`), which Redis executes atomically, or switching to
`redis.call` primitives like `HINCRBYFLOAT` that don't require a round-trip read first.

### Sliding Window (per-IP, strict — this one *is* correctly atomic)
```ts
async slidingWindow(identifier: string, limit = 100, windowMs = 60000) {
  const key = `ratelimit:sw:${identifier}`;
  const pipeline = this.redis.pipeline();
  pipeline.zadd(key, now, requestId);                    // record this request
  pipeline.zremrangebyscore(key, 0, now - windowMs);      // drop anything outside the window
  pipeline.zcard(key);                                    // count what's left
  pipeline.expire(key, Math.ceil(windowMs / 1000));
  const results = await pipeline.exec();
}
```
This uses a Redis **sorted set** (`ZADD`) keyed by request timestamp, wrapped in a `pipeline` (Redis
pipelining batches commands into one round-trip and Redis processes them sequentially without another
client's commands interleaving between them — so this one *is* race-free in practice, unlike the
token bucket above). Every request adds itself, then the set is trimmed to only the current window,
then counted. No fixed-window "burst at the boundary" problem, because the window slides continuously
rather than resetting on a clock tick.

**Where each is actually used:** the gateway's `AuthMiddleware` (`apps/gateway/src/middleware/
auth.middleware.ts`) applies sliding-window per authenticated user on *every* request, using the
admin-configurable limit from `/config` (see §2 of `real_data_integration_debugging.md`). The
`ProxyController`'s CDN route (`@All('cdn/*')`) applies a second sliding-window check per raw IP,
independent of auth, since CDN traffic is often unauthenticated.

**Good interview answer for "why two algorithms instead of one":** "Sliding window is strict — good
for protecting shared infrastructure from any single IP regardless of who they are. Token bucket is
generous to a legitimate, bursty client (e.g., a dashboard that fires five requests on page load) as
long as their *average* rate stays within budget. I use sliding window where I want a hard ceiling and
token bucket where a burst is expected and fine."

---

## 2. Circuit Breaker — Opossum, and what the numbers actually mean

**File:** `apps/gateway/src/resilience/circuit-breaker.service.ts`

```ts
const options: CircuitBreaker.Options = {
  timeout: 3000,               // a call that hangs > 3s counts as a failure
  errorThresholdPercentage: 50, // if ≥50% of recent calls fail, trip the breaker
  resetTimeout: 30000,          // stay OPEN for 30s before trying again (HALF_OPEN)
  volumeThreshold: 5,           // need at least 5 calls before the percentage means anything
};
```

One breaker is created per downstream service at boot (`auth-service`, `storage-service`,
`analytics-service`, `cdn-service`, `cache-service` — see `onModuleInit()`), and every proxied call
goes through `execute(serviceName, fn)`, which calls `breaker.fire(fn)`.

**Why `volumeThreshold: 5` matters and is easy to get wrong:** without it, one single failed request
right after boot (0 successes, 1 failure = 100% failure rate) would trip the breaker instantly. The
threshold means Opossum won't even evaluate the error percentage until at least 5 calls have gone
through — so a cold-start blip doesn't cause a false trip.

**The three states, and what the dashboard shows for each:** `CLOSED` (normal — requests pass
through and are counted), `OPEN` (>50% of the last window failed — every request is rejected
immediately with `503` and a `retryAfter: 30` header, *without even attempting the downstream call*),
`HALF_OPEN` (after `resetTimeout`, one trial request is allowed through; success closes the breaker
again, failure re-opens it). The gateway's `/health` endpoint reports `circuitState` per service —
this is exactly what let me diagnose, during this session's debugging, that a "down" status was a
health-check gap rather than a tripped breaker (breaker was `CLOSED` the whole time — see
`real_data_integration_debugging.md §2.6`).

**Good interview follow-up: "what's the difference between what your circuit breaker protects
against and what your rate limiter protects against?"** Rate limiting protects a *downstream service*
from too much *legitimate* traffic (or protects it from abuse). Circuit breaking protects the
*gateway itself and the caller's latency* from a downstream service that's already unhealthy — once a
service is failing, retrying it immediately just wastes time and piles up load on a service trying to
recover. They're complementary, not redundant.

---

## 3. Auth & RBAC — two independent JWT checks, and why that's not accidental duplication

There are genuinely **two separate JWT verification implementations** in this codebase, and knowing
why is a good depth signal:

1. **Gateway** (`apps/gateway/src/middleware/auth.middleware.ts`) — uses the raw `jsonwebtoken`
   package directly: `jwt.verify(token, secret)`. This runs on *every* request that isn't explicitly
   excluded (register/login/health/metrics/cdn — see `AppModule.configure()`), before the request is
   ever proxied anywhere.
2. **auth-service** (`apps/auth-service/src/auth/strategies/jwt.strategy.ts`) — a Passport.js
   `Strategy` wired through NestJS's `@nestjs/passport`, applied via `@UseGuards(JwtAuthGuard)` on
   specific auth-service routes (`GET /auth/me`, `GET/POST/DELETE /auth/api-keys`).

Since *all* external traffic is forced through the gateway (nothing else is publicly exposed — see
the Docker network in `docker-compose.dev.yml`), the gateway's check is the one actually gatekeeping
in practice. auth-service's own guard is defense-in-depth: if the gateway's exclusion list were ever
misconfigured, or auth-service were ever called directly inside the Docker network by another
service, its routes are still independently protected. **This is a legitimate microservices pattern —
"never trust the network," not just "trust the perimeter" — and worth stating explicitly if asked
"isn't that duplicated logic?"**

### RBAC: real, but only recently a real *feature*
`packages/shared/src/index.ts` defines `UserRole = { ADMIN, USER, VIEWER }`, baked into the JWT
payload at login (`{ sub, email, role }`). `auth-service` has had a `@Roles()` decorator and
`RolesGuard` (`apps/auth-service/src/auth/guards/roles.guard.ts`) since early in the project — but
until the Platform Configuration feature (see `real_data_integration_debugging.md §3`), **no route
anywhere in the codebase actually used it**. `PATCH /config` is the first real admin-gated action:
```ts
if (req.user?.role !== 'admin') {
  throw new ForbiddenException('Only admins can update platform configuration');
}
```
The gateway route checks the role inline rather than reusing auth-service's `RolesGuard` decorator,
because the gateway doesn't import auth-service's guard module — it already has `req.user.role`
available from its own JWT decode in `AuthMiddleware`, so a duplicate guard class wasn't worth the
cross-service coupling for one check. If a second admin-gated route were added, factoring this into
a small shared `AdminGuard` in the gateway itself would be the next step.

---

## 4. Caching — what's actually deployed vs. what the early docs describe

This is worth being precise about, because `docs/ARCHITECTURE.md` (written early in the project)
describes a **Go-based edge server** with a three-layer cache (Redis L1 → local disk L2 → origin L3).
That Go service exists in the repo (`apps/edge-server/`, ~4 files) but **is not part of
`docker-compose.dev.yml` and has never been deployed** — it's an early prototype that the project
moved on from.

**What's actually running** is `cdn-service` (NestJS + `sharp`, two instances — `cdn-service-a` /
`cdn-service-b` simulating two edge regions), and its real cache hierarchy is:

```
Request → in-process memory cache (NodeCache, apps/cdn-service/src/cdn/cdn.service.ts)
            ↓ miss
          Redis (apps/cdn-service/src/cache/cache.service.ts, keyPrefix "edgesphere:")
            ↓ miss
          Origin: storage-service → MinIO
```

The in-process `NodeCache` (`stdTTL` from `MEMORY_CACHE_TTL_SECONDS`, default 300s) is genuinely L1 —
it lives in the Node process's own heap, so it's the fastest possible hit and is *not* shared between
`cdn-service-a` and `cdn-service-b` (each instance has its own). Redis is L2 — shared across both
instances, TTL now admin-configurable (`platform_config` hash — see
`real_data_integration_debugging.md §3`). MinIO (via `storage-service`) is the origin.

**If asked "why does the architecture doc describe Go and disk caching, but that's not what's
running?"** — the honest, good answer: *"The project explored a Go edge implementation early on for
performance, then consolidated on a NestJS implementation to share code and tooling with the rest of
the monorepo. The docs weren't fully reconciled after that decision — which I caught and corrected
while auditing the dashboard's data sources for this session (see `docs/ARCHITECTURE.md §7`)."* That's
a stronger answer than pretending the Go service is live — interviewers routinely probe for exactly
this kind of doc/reality drift.

---

## 5. Kafka event flow & the WebSocket bridge

**Topics actually produced/consumed** (grep-verified, not aspirational): `request.events`,
`storage.events`, `alerts.triggered`, plus a per-service DLQ topic pattern (`request.events.dlq`) used
by the gateway's `DlqService` when a publish fails after retries.

**Producers:** every service that handles a request logs it via a `LoggingMiddleware`-equivalent and
publishes to `request.events` — gateway (`middleware/logging.middleware.ts`) and `cdn-service`
(`events/event-publisher.service.ts`) both do this, so *both* proxied API calls and direct CDN hits
show up in the same analytics pipeline.

**Consumers, and why there are two independent ones for the same topic:**
- `analytics-service`'s `KafkaConsumerService` batches incoming `request.events` (flushes every
  500ms or 1000 messages, whichever first) and bulk-inserts into TimescaleDB — this is the
  **durable, queryable** path (Analytics/Logs/Edges pages).
- `websocket-gateway`'s `KafkaConsumerService` consumes the *same* topic independently (its own
  consumer group, so it doesn't compete with analytics-service for partitions) purely to re-broadcast
  each event over Socket.io to any dashboard client subscribed to the `events` room — this is the
  **ephemeral, real-time** path (Live Events page). It also maintains a rolling 5-second in-memory
  window of the same events to compute `requestsPerSec`/`cacheHitRatio`/`avgLatencyMs` for the
  dashboard's "Live" indicator (this replaced a `Math.random()` placeholder that had been shipping on
  every page's topbar — see `real_data_integration_debugging.md §1`).

**Why two consumers instead of one service doing both jobs:** durability (writing to TimescaleDB) and
low-latency fan-out (pushing to potentially many open WebSocket connections) have different failure
modes and different scaling needs. If `websocket-gateway` restarts or falls behind, live dashboard
updates pause — that's fine, nothing is lost, clients just catch up on reconnect. If
`analytics-service` fell behind the same way, that *would* be a real data-loss risk, so it's a
separate consumer group with its own restart/backpressure characteristics rather than sharing one.

---

## 6. Summary for the interviewer

*"Rate limiting uses two Redis-backed algorithms for two different guarantees — sliding window via
sorted sets for a hard per-IP ceiling, token bucket via a hash for bursty per-user traffic, though the
token bucket's read-modify-write isn't currently atomic and I'd move it to a Lua script under real
load. Circuit breaking wraps every downstream call in Opossum with a volume threshold so cold starts
don't cause false trips. Auth is checked twice by design — once at the gateway perimeter, once again
inside auth-service — because I don't want to rely solely on perimeter trust inside the Docker
network. RBAC existed as unused scaffolding until I gave it a real admin-gated feature to protect.
And the caching layer that's actually deployed is an in-process-memory-plus-Redis two-tier cache in a
NestJS CDN service, not the Go/disk-based design an earlier architecture doc described and that I
corrected once I found the drift."*
