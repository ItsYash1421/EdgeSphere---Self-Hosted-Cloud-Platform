# EdgeSphere — SDE Mock Interview Questions

This document contains a curated list of tough, real-world mock interview questions specifically tailored to the EdgeSphere project. These are exactly the types of questions a Senior Engineer or Engineering Manager would ask for an SDE role.

---

## Part 1: System Design & Architecture

### 1. "You used Microservices. How do you handle a scenario where a user signs up (Auth Service), but we also need to create a default storage bucket for them (Storage Service)? What if the Storage service is down at that exact moment?"
**Expected Answer (Eventual Consistency & Queues):**
"In a monolith, we would do this in a single SQL transaction. But in microservices, we cannot. Instead, I use **Eventual Consistency** via **Kafka**.
When a user signs up, the Auth Service saves the user to Postgres and immediately returns a 'Success' to the user. Simultaneously, it publishes a `user.created` event to Kafka. The Storage Service consumes this event and creates the bucket. If the Storage Service is down, Kafka retains the message. Once the Storage Service comes back online, it reads the backlog and creates the bucket. No data is lost."

### 2. "Why did you use an API Gateway instead of letting the frontend talk to the microservices directly?"
**Expected Answer:**
"If the frontend talks directly to the microservices, the frontend code becomes extremely complex. It would need to know the IPs and ports of 10 different services. Also, every single service would have to implement its own Rate Limiting, JWT Validation, and CORS logic.
By using an API Gateway, I centralized all cross-cutting concerns. The Gateway handles JWT validation, Redis rate-limiting, and request logging. The backend services stay purely focused on business logic and can safely trust the requests forwarded by the Gateway."

### 3. "How does your Rate Limiter work in Redis? What algorithm did you use?"
**Expected Answer:**
"I used the **Sliding Window Log** algorithm (or Token Bucket) implemented via Redis. I use the user's IP or API Key as the Redis key. When a request hits the Gateway, we check the number of requests in the current window. Redis is single-threaded, so operations like `INCR` or `ZADD` (Sorted Sets) are atomic, which prevents race conditions if multiple concurrent requests come in at the same millisecond."

---

## Part 2: Backend & Database (Node.js/Postgres)

### 4. "You're uploading potentially 5GB video files. Doesn't passing a 5GB file through your API Gateway and Node.js backend crash the server due to memory limits?"
**Expected Answer (Presigned URLs):**
"If I streamed the file through the API Gateway to the Storage Service, yes, it would choke the CPU and memory of my Node.js servers. To solve this, I used **Presigned URLs**. 
The frontend asks the backend for permission to upload. The backend verifies the user and uses the MinIO SDK to generate a temporary, cryptographically signed URL. The frontend then uploads the 5GB file directly to MinIO (Object Storage) using that URL. My Node.js backend handles exactly 0 bytes of the file transfer."

### 5. "What happens if someone steals a JWT token? How do you revoke a stateless token before it expires?"
**Expected Answer:**
"By design, JWTs are stateless and cannot be revoked easily because they are validated without checking the database. To solve this, I implemented a **Redis Blacklist**. When a user logs out or their password is changed, the backend takes the `jti` (JWT ID) or the whole token and saves it in Redis with an expiry time matching the token's remaining lifespan. The API Gateway checks this Redis blacklist on every request. If the token is found, it denies access. Redis is incredibly fast, so this adds virtually no latency."

### 6. "Why did you choose Postgres over MongoDB for this project?"
**Expected Answer:**
"For a platform like EdgeSphere, data relationships are critical. A `Bucket` belongs to a `User`. A `File` belongs to a `Bucket`. A `File` has `Permissions`. Relational integrity (Foreign Keys) and ACID properties are essential to ensure we don't have orphaned files or buckets. Postgres handles this perfectly. Furthermore, Postgres has excellent JSONB support, meaning if I needed to store unstructured metadata for a file, I could still do it efficiently without sacrificing SQL features."

---

## Part 3: CDN & Performance

### 7. "How exactly does your custom CDN node work? How do you ensure cache consistency if a user deletes a file?"
**Expected Answer:**
"My CDN Edge nodes are NestJS services deployed closer to the user. When a request comes in, the Edge node checks its local Redis cache. If it's a 'Cache Miss', it fetches the file from the origin (MinIO), streams it to the user, and writes it to Redis. 
For cache consistency (Invalidation), when a user deletes a file in the Storage Service, the Storage Service publishes a `file.deleted` event to Kafka. All CDN nodes consume this event and immediately delete the corresponding key from their local Redis caches."

### 8. "How do you handle image resizing on the fly in the CDN?"
**Expected Answer:**
"I use the `sharp` library in Node.js. If a user requests `image.jpg?w=300`, the CDN node first checks Redis for the cache key `image.jpg:w=300`. If it's a miss, it fetches the original `image.jpg` from MinIO, streams it through a `sharp` transform pipeline to resize it to 300px, caches the result in Redis, and returns it. This ensures we only do the CPU-heavy resizing work exactly once per size variation."

---

## Part 4: DevOps & Infrastructure

### 9. "I see you used Docker Compose. What issue did you face when running `docker compose up` for the first time with 10 Node.js services?"
**Expected Answer:**
"I faced severe network saturation and socket hangups (`ECONNRESET`). Because Docker was trying to run `pnpm install` and download base images for 10 NestJS applications completely in parallel, it overwhelmed the Docker daemon and the host network. 
I solved this by writing a custom bash script that forces Docker to build the images sequentially using a `for` loop. Once the images are cached, the script runs `docker compose up -d` to start the containers simultaneously, which works flawlessly."

### 10. "How do you monitor this system in production?"
**Expected Answer:**
"I use the **TIG/Loki Stack** (Prometheus, Grafana, Jaeger, Loki).
- **Prometheus** pulls metrics (like CPU usage, memory, request counts) from the `/metrics` endpoint of every NestJS service.
- **Grafana** visualizes these metrics on dashboards.
- **Loki** aggregates console logs from all Docker containers so I don't have to SSH into individual machines to read logs.
- **Jaeger** tracks distributed traces. I inject an `X-Request-ID` at the Gateway, so if a request fails in the Storage service, I can see the exact path it took in Jaeger."

---

## Part 5: Trade-offs & "What Would You Improve" (the questions that separate senior from mid-level)

These are grounded in real, verified limitations in the current codebase — not hypotheticals. Being
able to name your own system's weak points, unprompted, is one of the strongest signals you can give
in an interview. Full technical detail on each is in `subsystems_deep_dive.md`.

### 11. "Is your token bucket rate limiter actually safe under concurrent requests?"
**Honest answer (this is a real gap, not a trick question):**
"No, not currently. It's a Redis `HMGET` → compute in application code → `HMSET`, which is a
read-modify-write, not an atomic operation. Two requests from the same identifier arriving within the
same few milliseconds could both read the same token count before either writes back, and both get
admitted — a classic check-then-act race condition. My sliding-window limiter doesn't have this
problem because it's a single Redis `pipeline` of `ZADD`/`ZREMRANGEBYSCORE`/`ZCARD` — pipelined
commands execute back-to-back on the Redis server without another client's commands interleaving. The
fix for the token bucket is moving the read-compute-write into a Lua script so Redis executes it
atomically server-side, or using `HINCRBYFLOAT` instead of a full read first."

### 12. "You verify the JWT in two different places — gateway and auth-service. Isn't that redundant?"
**Answer:**
"It looks redundant until you consider the threat model. The gateway's check is perimeter security —
it's the only thing the public internet can reach. auth-service's own `JwtAuthGuard` on routes like
`/auth/me` is defense-in-depth *inside* the Docker network — if the gateway's route-exclusion list
were ever misconfigured, or if another internal service called auth-service directly instead of
through the gateway, those routes are still independently protected. 'Never trust the network' is a
deliberate microservices principle, not just 'trust the edge and relax everywhere else.'"

### 13. "Your architecture docs describe a Go-based edge server with disk caching. I don't see that running anywhere."
**Answer:**
"Good catch — that's real drift I found and fixed while auditing the project. The Go edge server
(`apps/edge-server/`) is an early prototype that's never been part of the actual `docker-compose`
stack. What's actually deployed is `cdn-service`, a NestJS service using `sharp` for image
transforms, with a two-tier cache: an in-process `NodeCache` per instance, then Redis shared across
instances, then MinIO as origin. I updated `docs/ARCHITECTURE.md` to document what's actually running
instead of leaving stale docs that would mislead the next person — including me, six months from now."

### 14. "Your alert rules — are they persisted anywhere, or do they reset if the service restarts?"
**Answer:**
"They're in-memory only right now (`notification-service`'s `AlertsService` holds them in a plain
array seeded from `DEFAULT_ALERT_RULES`). A restart resets any custom rules a user created back to
the defaults. That's a real limitation I'd fix before calling this production-ready — either a
Postgres table (consistent with how everything else in the platform persists) or, if I wanted
sub-millisecond reads on every alert-check tick, Redis with a periodic snapshot to Postgres so a
restart doesn't lose custom rules."

### 15. "How would you scale the rate limiter itself if Redis became the bottleneck?"
**Answer:**
"Two levers, depending on what's actually saturating: if it's Redis CPU from too many small
operations, shard the rate-limit keyspace across multiple Redis instances by hashing the identifier
(consistent hashing so most keys don't move if I add a shard). If it's network round-trips from the
gateway to Redis under high fan-out, I'd add a short-lived local cache in the gateway itself — e.g.,
if a client is already well under their limit, skip the Redis round-trip for N milliseconds and just
count locally, reconciling periodically. That trades a small amount of rate-limit precision for a lot
less Redis load, which is usually the right trade for a limiter (being briefly too generous is a much
smaller risk than adding latency to every request)."

---

## Part 6: Questions specifically about the real-data-integration debugging session

If your resume or project walkthrough mentions "found and fixed production bugs," expect these.
Full write-ups with code are in `real_data_integration_debugging.md`.

### 16. "Walk me through the most subtle bug you've found in this codebase."
**Answer:**
"A TypeORM entity (`RequestEventEntity.userId`) was missing its database column-name mapping —
every sibling column had `@Column({ name: 'snake_case_name' })`, this one didn't. It never surfaced
because every *read* query in that service was hand-written raw SQL, which bypasses entity metadata
entirely. It only broke the moment I added a method using TypeORM's query builder for an *insert* —
which does validate against metadata — and then every Kafka-consumed event silently failed to persist
inside a `try/catch` that just logged and moved on. The result: the table backing the entire
real-time-analytics dashboard had been empty since the service was first stood up, and nothing about
the failure was visible from the UI or from 90% of the codebase. I found it by tracing every
dashboard page's data back to its actual origin — REST call → controller → service → raw SQL → DB
row — rather than trusting that a rendered chart meant the underlying data was real."

### 17. "How do you decide when a bug fix is safe versus when you're just papering over a symptom?"
**Answer:**
"A gateway Kafka producer disconnected mid-session and never reconnected — kafkajs doesn't
auto-reconnect a torn-down producer, and nothing was polling connection state. The immediate fix was
operational: restart the container so `onModuleInit` re-ran against a healthy broker. That's a real
fix for the immediate outage, but it's not a fix for the underlying gap — the service *should* detect
a dead producer and either reconnect or fail its health check so something pages a human. I documented
that as a known follow-up rather than pretending the restart solved the root cause. I try to be
explicit with myself about which category a fix falls into, because conflating 'the symptom is gone'
with 'the defect is fixed' is how the same class of bug comes back later."

### 18. "You mentioned a package worked locally but failed in Docker. Explain that to someone who doesn't know pnpm."
**Answer:**
"Two services imported the `express` package directly in their source code, but never listed it as a
dependency in their own `package.json` — they only got it transitively, through `@nestjs/
platform-express` depending on it. Most package managers hoist all transitive dependencies into one
flat `node_modules`, so `require('express')` finds it anyway even though it's not *your* declared
dependency — that's what happened locally. pnpm, by default, does the opposite: strict, non-flattened
linking, where a package can only `require()` what it explicitly lists as its own dependency. That's
usually a feature — it stops exactly this kind of implicit coupling — but it means the bug only
appears inside the Docker build, which uses a clean install, not on a developer's machine that already
has a stale, more permissive `node_modules` sitting around. The fix was two lines per service: declare
`express` as a direct dependency at the version already being resolved transitively."

---

## 💡 Interview Strategy Tip
If the interviewer asks an open-ended question like *"Tell me about a time you solved a hard technical problem"*, use the **Docker Sequential Build Issue** (Question 9), the **5GB File Upload Issue** (Question 4), or — if they want something more recent and more "I own this system end-to-end" — **Question 16** (the silent analytics-ingestion bug). If they push into "what's not perfect about your own system," Part 5 is built exactly for that — naming a real race condition in your own rate limiter unprompted is a far stronger signal than claiming the system has no weaknesses.
