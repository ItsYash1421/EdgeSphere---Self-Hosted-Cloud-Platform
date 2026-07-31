# EdgeSphere — Interview Preparation Guide

This document is designed to help you explain the **EdgeSphere** project in technical interviews. It covers the architecture, the "Why" behind technology choices, the data flow, and potential interview questions with detailed answers.

---

## 1. Project Overview (Elevator Pitch)
**EdgeSphere** is a modern, high-performance, self-hosted cloud platform designed with a microservices architecture. It provides an API Gateway, Object Storage (like AWS S3), a custom CDN Edge network, Real-time Analytics, and WebSockets. It is built to be horizontally scalable and highly available.

---

## 2. Technology Stack & "Why We Chose It"

### Backend Framework: NestJS (Node.js/TypeScript)
- **Why?** NestJS provides a strict architectural structure out-of-the-box (Modules, Controllers, Services). It uses TypeScript heavily, supports Dependency Injection natively, and makes it extremely easy to build scalable microservices.
- **Alternatives considered:** Express.js (too unopinionated, leads to spaghetti code in large projects), Go (great performance, but Node.js allows sharing code/types between frontend and backend in a monorepo).

### Frontend: Next.js & React
- **Why?** Next.js provides Server-Side Rendering (SSR) for fast initial loads and great SEO. It easily integrates with our React components and handles routing natively. We use `standalone` output mode to build extremely lightweight Docker images for production.

### Primary Database: PostgreSQL
- **Why?** Relational data like Users, API Keys, and Bucket metadata require strict schema enforcement and ACID properties. Postgres is highly reliable and handles complex joins easily.

### Caching & Rate Limiting: Redis
- **Why?** Redis is an in-memory data store. We use it for three critical high-speed tasks:
  1. **Rate Limiting** at the API Gateway (using Token Bucket / Sliding Window algorithms).
  2. **Caching** in the CDN Edge services (Layer 1 cache before hitting MinIO).
  3. **Session Management / JWT Blacklisting** in the Auth service.

### Object Storage: MinIO
- **Why?** We needed an S3-compatible object storage layer to store user uploads (images, videos). MinIO is open-source, highly performant, and perfectly mimics the AWS S3 API, meaning we can easily migrate to actual AWS S3 in the future without changing our code.

### Event Bus / Message Broker: Apache Kafka
- **Why?** As the system scales, synchronous communication (HTTP) between microservices creates bottlenecks. Kafka provides robust, asynchronous, event-driven communication. For example, when a user uploads a video, the Storage service publishes an event to Kafka, which the Analytics or Transcoding service can consume at its own pace without blocking the user request.

### Observability: Prometheus, Grafana, Jaeger, Loki
- **Prometheus & Grafana:** For scraping and visualizing metrics (e.g., request latency, CPU usage, API hit rates).
- **Jaeger:** For distributed tracing. Since a single user request might travel through API Gateway -> Auth -> Storage, Jaeger helps us trace where a request failed or slowed down.
- **Loki:** For centralized log aggregation across all Docker containers.

---

## 3. How It Works (Core Data Flows)

### Flow 1: API Request with Rate Limiting & Auth
1. User makes an API request to `api.edgesphere.com/v1/storage/buckets`.
2. **API Gateway** receives the request.
3. The Gateway checks **Redis** to see if the user's IP/Token has exceeded the rate limit. If yes, it returns `429 Too Many Requests`.
4. If allowed, the Gateway extracts the JWT and validates it.
5. The Gateway proxies the request to the internal **Storage Service**.
6. The Storage Service queries **PostgreSQL** to fetch the buckets and returns the data.
7. Gateway logs the request metrics to **Prometheus** and returns the response to the user.

### Flow 2: File Upload & CDN Delivery
1. User uploads `image.jpg` to the Storage Service.
2. Storage Service saves metadata in **Postgres** and the actual file binary into **MinIO**.
3. A user in India requests the image via `cdn.edgesphere.com/bucket/image.jpg`.
4. The request hits **CDN Edge A** (closest to the user).
5. CDN checks its **Redis Cache** (L1 Cache). If it's a MISS, it fetches the file from MinIO (Origin), stores a copy in Redis, and serves it to the user.
6. The next user requesting the same image gets a lightning-fast response directly from Redis (HIT).

---

## 4. Expected Interview Questions & Answers

### Q1: Why did you choose a Microservices architecture over a Monolith?
**Answer:** "While a monolith is easier to start with, I chose microservices for EdgeSphere because of **independent scalability and separation of concerns**. For example, the CDN Edge service needs to handle massive amounts of read traffic and might need to scale horizontally across multiple regions. The Auth service, however, handles less traffic. Microservices allow us to scale the CDN independently without wasting resources scaling the Auth logic. It also allowed me to implement fault isolation—if the Analytics service crashes, the Storage service keeps working."

### Q2: How did you implement Rate Limiting?
**Answer:** "I implemented rate limiting at the API Gateway level using **Redis**. I used a **Sliding Window Log** algorithm (or Token Bucket) because it prevents sudden spikes at the edge of time windows. When a request comes in, we use the user's IP or API Key as the Redis Key, increment the counter, and set a TTL. If the counter exceeds the limit, the Gateway intercepts the request and returns a 429 status code before it even reaches the backend microservices, protecting them from DDoS or abuse."

### Q3: How do your microservices communicate with each other?
**Answer:** "I use a hybrid approach. 
1. **Synchronous (HTTP/REST):** Used for immediate actions. The API Gateway uses HTTP to proxy requests to backend services because the client is actively waiting for a response.
2. **Asynchronous (Kafka):** Used for background tasks and decoupling. For example, generating analytics logs or triggering a video transcode doesn't need to block the HTTP response. The service publishes a Kafka event, and consumer services process it independently."

### Q4: How do you handle Authentication across multiple microservices?
**Answer:** "I use stateless **JWT (JSON Web Tokens)**. When a user logs in via the Auth Service, they receive a JWT signed with a secret key. The API Gateway acts as the central gatekeeper; it verifies the JWT signature on every incoming request. Once verified, the Gateway forwards the request to the internal microservices along with the user's ID in the headers. This means internal microservices don't need to query the database to authenticate the user—they trust the Gateway."

### Q5: What happens if MinIO goes down? Is your system resilient?
**Answer:** "If MinIO goes down, file uploads will fail, but the rest of the system remains functional. This is the benefit of microservices. Furthermore, read requests for frequently accessed files will still succeed because the **CDN Edge nodes cache files in Redis**. So, while the origin (MinIO) is down, cached content remains highly available."

### Q6: What was the biggest challenge you faced building this?
**Answer:** "One major challenge was **local development infrastructure orchestration and network saturation**. Booting up 10 microservices plus databases (Postgres, Redis, Kafka) simultaneously caused Docker network overloads and `ECONNRESET` errors during `pnpm install` in the Docker builds. I solved this by writing a custom shell script that explicitly builds each microservice sequentially using Docker caching before orchestrating the final `docker compose up`. This taught me a lot about Docker networking, build context optimization, and CI/CD pipeline stability."

### Q7: How do you handle Distributed Tracing?
**Answer:** "Because a request travels through the Gateway to other services, debugging where a failure happened is hard. I implemented **Jaeger**. The API Gateway generates a unique `X-Request-ID` (UUID) for every incoming request. This ID is passed in the headers to every downstream service. All services include this Request ID in their logs (aggregated in Loki), allowing me to trace the exact lifecycle of a request across the entire platform."

---

## 5. Pro-Tips for the Interview
- **Be ready to draw:** If asked to explain the architecture, quickly draw boxes (Gateway -> Auth/Storage -> Postgres/MinIO) and show the CDN as a separate layer.
- **Admit trade-offs:** If an interviewer asks "Isn't Kafka overkill for a personal project?", say: *"Yes, for 10 users, it is. But the goal of EdgeSphere was to design a system capable of handling enterprise scale. I chose Kafka specifically to learn event-driven architecture and tackle the complexity of distributed messaging."*
- **Highlight Monorepo benefits:** Mention that using `pnpm workspaces` allowed you to share TypeScript interfaces between your Next.js frontend and NestJS backend, ensuring end-to-end type safety.
