# EdgeSphere — Real-Data Integration & Production Debugging Session

This document covers a real engineering session on EdgeSphere: taking a dashboard that looked
complete but was substantially wired to mock data, making every page genuinely real end-to-end,
and fixing the backend bugs that surfaced along the way. Unlike a feature-planning doc, everything
here is grounded in specific files, specific bugs, and specific verified behavior — use it to talk
about **debugging methodology and distributed-systems judgment**, which is what senior interviews
actually probe for.

---

## 1. The starting problem

The dashboard (11 pages, Next.js + Redux + SWR) looked finished. Visually, every page had real
charts, tables, and stat cards. But an audit (reading every page's data source, not just its UI)
found the backend was **more built-out than the frontend used**:

| Category | Examples |
|---|---|
| Frontend fully mocked, backend already real | Storage (buckets/files), API purge on CDN page, most of Settings |
| Frontend called the real API but misread the response shape | Overview page's summary stats (`stats.cacheHits` read from a field that doesn't exist — real field is `cacheHitRatio`), Recent Requests table (`req.statusCode`/`req.timestamp` vs actual `status`/`time`) |
| **Backend itself faked data**, not just the frontend | `websocket-gateway`'s "Live req/s" indicator was `Math.random()` on every page's topbar; cache-service's "Cache Hit Ratio" stat was a hardcoded `0.95` |
| Backend endpoint existed but silently did nothing | `auth-service`'s `listApiKeys()` returned `{ keys: [], message: 'TODO Phase 1' }` — a stub that had shipped |

**The methodology that matters here for an interview:** don't trust that "the UI shows a chart" means
"the data is real." Trace every page's data back to its origin — REST call → controller → service →
raw SQL/ORM → actual DB row — and check the field names match at every hop. Several of the bugs below
were only found by doing that trace, not by reading the frontend in isolation.

---

## 2. Bugs found and fixed (the real interview material)

### 2.1 A TypeORM entity had the wrong column mapping — and it silently broke the entire analytics pipeline

**File:** `apps/analytics-service/src/analytics/request-event.entity.ts`

```ts
// Before
@Column({ type: 'uuid', nullable: true }) userId: string;

// After
@Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string;
```

The `request_events` table's physical column is `user_id` (snake_case), but the TypeORM entity's
`userId` property had no explicit `name` mapping. Every *other* column on that entity (`latencyMs`,
`cacheHit`, `edgeRegion`) *did* have the mapping — which is exactly why this one slipped through:
the analytics service's read queries were all hand-written raw SQL (`SELECT * FROM request_events`),
which bypasses entity metadata entirely and never touched the bug. It only surfaced when I added a
new method that used TypeORM's `insert().values(entities)` — that's entity-metadata-driven, and it
tried to `INSERT INTO request_events ("userId", ...)`, a column that doesn't exist.

**Impact:** every single Kafka-consumed request event failed to insert, silently, because the ingest
method wrapped the insert in a `try { ... } catch (error) { this.logger.error(...) }` with no
alerting. The `request_events` table had been empty since day one. That meant Overview, Logs, Live
Events, and Edge Servers — the entire "real-time analytics" surface — had nothing to show, and no
one would know why just by looking at the dashboard.

**Why this is a good interview story:** it's a textbook case of a defect that (a) was invisible from
the UI, (b) was invisible from 90% of the codebase because raw SQL doesn't validate against entity
metadata, and (c) only fails loudly the moment someone uses the ORM the "normal" way. It's also a
good prompt to talk about **why silently swallowing errors in a hot ingest path is dangerous** — that
`catch` block should have paged someone.

### 2.2 A reverse-proxy's `bodyParser: false` broke a brand-new local route

**File:** `apps/gateway/src/main.ts` / `apps/gateway/src/app.module.ts`

The gateway runs with `NestFactory.create(AppModule, { bodyParser: false })` **on purpose** — it's a
reverse proxy, and if it parsed and re-serialized every request body, it would corrupt anything that
isn't clean JSON (multipart file uploads being the obvious case) before forwarding it to the real
owning service. Every existing gateway route was either a pure proxy pass-through or a body-less
GET, so this had never been a problem.

The first time I added a *local* (non-proxied) `PATCH /config` route to the gateway, `@Body()`
resolved to `undefined` — because nothing was parsing the body for that route either. The fix wasn't
to flip the global flag (that would break the proxy for every other route); it was to scope
`express.json()` to exactly that route:

```ts
consumer.apply(json()).forRoutes('config');
```

**Why this is a good interview story:** it's a concrete example of **not fixing a bug by widening its
blast radius**. The tempting fix (`bodyParser: true` globally) would have silently broken file
uploads through the proxy. The correct fix required understanding *why* the flag was off in the first
place before touching it.

### 2.3 Phantom dependencies that only fail inside Docker, in three different services

**Files:** `apps/storage-service/package.json`, `apps/gateway/package.json`

Both `storage-service/src/main.ts` and (after my change) `gateway/src/app.module.ts` do
`import * as express from 'express'` / `import { json } from 'express'` directly. `express` was
never a *direct* dependency in either service's `package.json` — it only arrived transitively via
`@nestjs/platform-express`. Locally, pnpm's flattened resolution (plus editor tooling resolving
`@types/express`) made this invisible. Inside Docker, pnpm's **strict, non-hoisted** `node_modules`
layout only links packages a workspace explicitly declares as its own dependency — so
`require('express')` failed with `MODULE_NOT_FOUND` at container boot, every time, for both services.

**Fix:** add `"express": "^4.22.1"` as a direct dependency in both `package.json` files (matching the
version already resolved transitively via `@nestjs/platform-express`).

**Why this is a good interview story:** it's the cleanest possible illustration of **why pnpm's
strict linking is a feature, not a bug** — it converts "works on my machine" phantom-dependency bugs
into build-time failures instead of silent footguns. Good follow-up to mention: `@types/express`
resolving fine while the runtime package doesn't is itself a hint — type-only packages don't need to
be a direct dependency to type-check, so their presence tells you nothing about the runtime graph.

### 2.4 A misnamed environment variable meant a service had been running on default credentials for its entire life

**File:** `apps/storage-service/src/app.module.ts`

```ts
// Before — reads DB_USERNAME, which docker-compose never sets
username: configService.get<string>('DB_USERNAME', 'postgres'),
password: configService.get<string>('DB_PASSWORD', 'postgres'),
database: configService.get<string>('DB_NAME', 'storage'),

// After — matches what docker-compose actually sets (DB_USER), and matches
// the other four services' convention
username: configService.get<string>('DB_USER', 'edgesphere'),
password: configService.get<string>('DB_PASSWORD', 'edgesphere_secret'),
database: configService.get<string>('DB_NAME', 'edgesphere'),
```

Every other service in the monorepo reads `DB_USER`; this one read `DB_USERNAME`. Docker Compose
never set `DB_USERNAME`, so the config silently fell back to the hardcoded default (`postgres`/
`postgres`), which doesn't match the real Postgres user (`edgesphere`/`edgesphere_secret`) — so the
service failed `password authentication failed for user "postgres"` on every boot and crash-looped.

**Why this is worth mentioning:** a fallback default that *looks* reasonable (`'postgres'` is a
plausible-sounding Postgres username) is more dangerous than one that's obviously wrong, because it
fails in a way that looks like a credentials problem rather than a naming-convention problem. The fix
was two lines; finding it required comparing this service's config against the four *working*
services' config side by side.

### 2.5 A Kafka producer that connects once and never reconnects

**File:** `apps/gateway/src/events/event-publisher.service.ts` (pattern), symptom in
`apps/websocket-gateway` and `apps/storage-service`

Two related issues:
- `storage-event-publisher.service.ts` originally did `await this.producer.connect()` directly in
  `onModuleInit()`, unguarded. If Kafka isn't reachable yet at boot, this throws, and NestJS's
  bootstrap fails — the whole service goes down over a dependency (event publishing) that should be
  best-effort, not load-bearing.
- Separately, after a Kafka container restart mid-session, the **gateway's own** Kafka producer
  (which *did* have the "connect in background, don't crash" pattern already) stayed silently
  disconnected — kafkajs doesn't auto-reconnect a producer whose connection was torn down, and
  nothing in the app noticed. Every `publishRequestEvent()` call failed with
  `KafkaJSError: The producer is disconnected` for the rest of that process's lifetime; the fix was
  simply restarting the container so `onModuleInit` ran again against a healthy broker.

**Why this matters for an interview:** it's a good prompt for "how do you make a service resilient to
a dependency it doesn't strictly need to serve traffic?" — the answer is the same pattern used
elsewhere in this codebase (`.connect().then(log).catch(warn)` instead of `await connect()`), applied
consistently. It's also a good prompt for **liveness vs. readiness**: a service can be "up" and
serving its core HTTP traffic while one of its background integrations (Kafka) is quietly broken —
which argues for a health check that actually verifies the Kafka producer's connection state, not
just "the process is running."

### 2.6 A service with no health endpoint at all

**File:** `apps/storage-service/src/health/` (didn't exist; added)

Every backend service — `auth`, `analytics`, `cache`, `cdn`, `gateway` — has a `/health` controller.
`storage-service` didn't. The gateway's own health aggregator (`GET /health`) probes all four other
services by name and correctly reported `storage-service: down` — not because the service was
unhealthy, but because `fetch('http://storage:3002/health')` hit a 404. The dashboard's sidebar
"Service Health" panel then honestly (and misleadingly) showed **Storage: Down** even while file
uploads were working perfectly through that exact service.

**Why this is worth telling:** it's a nice example of the dashboard telling the truth about a bug
that lived one layer deeper — the health indicator wasn't lying, it was accurately reporting that a
health check that should exist, didn't. Fixing the actual gap (adding the missing controller, five
lines, copied from the pattern every other service already used) was more correct than special-casing
the frontend to ignore it.

---

## 3. Feature built: real, role-gated Platform Configuration

The dashboard's "Settings → Platform Configuration" section (cache TTL, max file size, per-IP rate
limit) started as three `<input>`s with hardcoded `defaultValue`s and an "Apply" button that called
nothing. Turning it into a real feature touched five services and is a good end-to-end system-design
story:

- **Storage:** a Redis hash at a single physical key (`edgesphere:platform_config`), owned by the
  gateway's new `PlatformConfigService` (`GET /config`, `PATCH /config`).
- **Access control:** `GET /config` is available to any authenticated user (read-only view); `PATCH`
  checks `req.user.role === 'admin'` and returns `403 Forbidden` otherwise. This is the **first real
  consumer** of the RBAC scaffolding (`@Roles()` decorator, `RolesGuard`) that had existed in
  `auth-service` since early in the project but was never actually applied to any route.
- **Cross-service config propagation without a config bus:** rather than build new infrastructure,
  three services that already share one Redis instance read the same physical key directly:
  - `cdn-service`'s `CacheService` (which already namespaces its Redis client with a
    `keyPrefix: "edgesphere:"`) reads the *unprefixed* key `platform_config`, which ioredis
    transparently expands to the same physical key the gateway wrote.
  - `storage-service` (which had no Redis client at all) got a small dedicated read-only
    `PlatformConfigService` using a plain `ioredis` connection with no prefix, reading the literal
    key `edgesphere:platform_config` to match.
  - Each read has a hardcoded fallback default, so a Redis outage degrades to "last known env-var
    behavior," not a hard failure.
- **Real enforcement, not just persistence:** the rate limit is read on every authenticated request
  (`AuthMiddleware`); the cache TTL is read on every cache-set in `cdn-service`; the max file size is
  checked against `file.size` before `storage-service` ever calls MinIO, returning a real
  `400 Bad Request` with the configured limit in the message.

**Verified live**, not just code-reviewed: with the limit set to 5 req/min, the 4th request in a
window returned `429`; with the max file size set to 1 MB, a 2 MB upload was rejected with
`"File exceeds the maximum allowed size of 1 MB"`; a non-admin JWT got `403 Forbidden` on `PATCH
/config` while an admin JWT succeeded and the change was visible immediately (no restart) on the next
request.

---

## 4. Interview Q&A grounded in this session

### Q: "Walk me through a bug you found that wasn't visible from the UI."
**A:** The `request_events` table backing the entire analytics dashboard was empty from day one,
because the `RequestEventEntity`'s `userId` column had no explicit database column-name mapping while
every sibling column did. It never surfaced because all the *read* queries were hand-written raw SQL
that bypasses entity metadata — it only broke the moment I added a method using TypeORM's query
builder for an insert, which does validate against metadata. I found it by tracing data provenance
end-to-end for every dashboard page instead of trusting that "a chart renders" means "the data is
real" — the DB table had zero rows despite the UI looking complete.

### Q: "Tell me about a time you *didn't* take the obvious fix."
**A:** A gateway route's request body wasn't being parsed. The obvious fix — flip `bodyParser: false`
to `true` globally — would have broken every proxied route, because the gateway deliberately proxies
raw, unparsed bodies to downstream services (multipart file uploads in particular would have been
corrupted by JSON re-serialization). The correct fix was scoping `express.json()` middleware to only
the one new local route that actually needed a parsed body, leaving the proxy's raw pass-through
behavior untouched for everything else.

### Q: "How do you decide whether a bug is 'my code' or 'infrastructure'?"
**A:** A Kafka producer disconnected mid-session and stayed disconnected — kafkajs doesn't
auto-reconnect a torn-down producer connection, and nothing in the app was polling connection state.
That's a legitimate gap (health checks should verify integration liveness, not just process
liveness), but the immediate fix was operational (restart the container so `onModuleInit` re-ran
against a healthy broker), not a code change. I try to fix the actual defect (add proper Kafka
reconnect logic or a real health check) as a follow-up, but I don't block on it if there's a correct,
low-risk operational fix available now.

### Q: "How would you design a runtime-configurable setting across multiple services without a
message bus or config service?"
**A:** I used the Redis instance the services already shared as the source of truth — a single hash
key, one owning service (the gateway) doing writes with validation and RBAC, and each *reader*
service polling that same physical key with a hardcoded fallback default. The trade-off I made
explicitly: this doesn't push updates (a service reads current config every time it needs it, rather
than being notified of changes), which is fine for settings like "max upload size" that are checked
per-request anyway, but would be the wrong pattern for something that needs to react to a change
instantly without new traffic triggering the read.

### Q: "What would you do differently, or what's still not finished?"
**A:** The gateway's Kafka producer reconnect gap (2.5 above) is still a real latent issue — I fixed
the symptom, not the root cause, and a proper fix means either a reconnect watchdog or making the
health check assert producer connection state so it pages someone instead of silently dropping
events. Also, the multipart upload path (`multipart.service.ts`) still calls
`storageEventPublisher.publishStorageEvent()` unguarded — the same class of bug I fixed in
`storage-event-publisher.service.ts`'s `onModuleInit`, just not yet applied to that specific call
site since the dashboard doesn't exercise multipart upload today.

---

## 5. How to frame this whole session in one sentence

*"I was asked to make a dashboard's data genuinely real instead of mocked, and the actual work turned
out to be distributed-systems debugging — an ORM column-mapping bug that had silently disabled
analytics ingestion since day one, a reverse-proxy body-parsing edge case, phantom npm dependencies
that only fail inside Docker's strict linking, and a stale Kafka connection — plus building one real
end-to-end feature (admin-gated platform config) to prove the fixes actually held under live
traffic."*
