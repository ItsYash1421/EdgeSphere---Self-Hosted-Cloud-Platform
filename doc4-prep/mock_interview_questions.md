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

## 💡 Interview Strategy Tip
If the interviewer asks an open-ended question like *"Tell me about a time you solved a hard technical problem"*, use the **Docker Sequential Build Issue** (Question 9) or the **5GB File Upload Issue** (Question 4). These show that you don't just write code, but you understand system limitations (Networking, Memory, CPU) and can architect real-world solutions.
