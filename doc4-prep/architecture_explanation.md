# EdgeSphere — End-to-End Architecture Explanation

This document is a deep dive into the EdgeSphere platform. It is designed to give you a complete, mental model of exactly how the code works from the moment a user clicks a button to the moment data is saved in the database. Use this to confidently explain the inner workings of your project.

---

## 1. The Monorepo Structure (pnpm workspaces)

We chose a **Monorepo** structure using `pnpm`. This means all frontend and backend code lives in a single repository.
- **`/apps`**: Contains all deployable microservices (e.g., `auth-service`, `api-gateway`, `dashboard`).
- **`/packages`**: Contains shared code that multiple apps use (e.g., `@edgesphere/shared` for TypeScript interfaces, `@edgesphere/logger` for standardized logging).
- **Why?** It guarantees that if you change a database schema or API response in the backend, the frontend TypeScript compiler will immediately throw an error if it doesn't match. No more guessing API payloads.

---

## 2. The API Gateway: The Front Door

Every single request from the outside world (Dashboard or external APIs) hits the **API Gateway** first (running on port 3000).

### What happens inside the Gateway?
1. **Logging Middleware**: The first thing it does is generate a unique `requestId` (UUID) and logs the incoming HTTP request. This ID is passed to every downstream service for distributed tracing.
2. **Rate Limiting**: It connects to Redis. We implemented a Token Bucket / Sliding Window algorithm. If a user makes more than 100 requests per minute, Redis blocks them at the gateway, saving our backend databases from crashing.
3. **Authentication Middleware**: For protected routes, it extracts the `Bearer` token from the `Authorization` header and verifies the JWT signature. If valid, it attaches the decoded `userId` to the request headers.
4. **Proxy Routing**: Finally, it looks at the URL. If the URL is `/v1/storage/*`, it acts as a reverse proxy and forwards the entire request (now enriched with the `userId` header) to the internal `storage-service:3002`.

---

## 3. Auth Service: Identity Management

The Auth Service (`port 3001`) only does one thing: manages users and issues tokens.

### The Login Flow:
1. User sends `{ email, password }` to `/v1/auth/login` (via Gateway).
2. The Gateway sees this is a public route, skips JWT validation, and forwards it to Auth Service.
3. Auth Service checks **PostgreSQL**.
4. It compares the hashed password using bcrypt.
5. If valid, it generates a **JWT (JSON Web Token)** containing the user's ID and Role, signs it with a secret key, and returns it.
6. The client stores this JWT and sends it in the headers for all future requests.

---

## 4. Storage Service: Core Business Logic

The Storage Service (`port 3002`) handles the creation of buckets and uploading of files. It connects to **PostgreSQL** (for metadata) and **MinIO** (for binary storage).

### The File Upload Flow (Presigned URLs):
To prevent the API Gateway from being choked by massive 5GB video uploads, we use **Presigned URLs**.
1. **Client Request**: The frontend asks the Storage Service: *"I want to upload a 2GB file named video.mp4 to bucket 'my-bucket'."*
2. **Verification**: Storage Service checks Postgres to ensure the user owns 'my-bucket'.
3. **Presigning**: Storage Service talks to MinIO and generates a special, temporary, cryptographically signed URL that allows direct upload to MinIO.
4. **Direct Upload**: The frontend receives this URL and uploads the 2GB file *directly* to MinIO, completely bypassing the API Gateway and Storage Service CPU.
5. **Webhook/Event**: Once MinIO receives the file, the metadata is saved in Postgres.

---

## 5. CDN Edge Nodes: High-Speed Content Delivery

The CDN Services (`cdn-service-a`, `cdn-service-b`) act as geographically distributed edge nodes. They exist to serve files to users as fast as possible, reducing the load on MinIO.

### The Caching Flow:
1. A user requests `cdn.edgesphere.com/my-bucket/video.mp4`.
2. The request hits the nearest Edge Node (e.g., CDN A).
3. **L1 Cache Check**: The CDN checks its local **Redis** instance to see if `video.mp4` is cached in memory.
4. **Cache Miss**: If it's not there, the CDN makes a request to the origin (MinIO), streams the file to the user, and simultaneously saves a copy of that file stream into Redis.
5. **Cache Hit**: The next time *anyone* requests that file, the CDN serves it directly from Redis RAM in milliseconds.
6. **Image Optimization**: The CDN also supports on-the-fly image transformations. If you request `image.jpg?w=200`, the CDN pulls the image, uses the `sharp` library to resize it to 200px, caches the resized version, and returns it.

---

## 6. Real-Time WebSockets & Analytics

When events happen (like a file finishing upload or a CDN node getting a cache hit), we want real-time updates on the Dashboard.

### The Asynchronous Flow (Kafka):
1. When a file is uploaded, the Storage Service publishes an event to **Kafka** (Topic: `file.uploaded`).
2. The **Analytics Service** is subscribed to Kafka. It receives the event in the background and increments counters in Postgres (e.g., "Total Storage Used").
3. The **Notification/WebSocket Service** is also subscribed to Kafka. It receives the event and pushes a WebSocket message to the frontend.
4. The **Dashboard** (React) receives the WebSocket message and instantly updates the UI without the user having to refresh the page.

---

## 7. Next.js Dashboard: The Frontend

The frontend is built with Next.js and Tailwind CSS.
- **Server Components**: We fetch initial data (like the user's bucket list) on the server side using Next.js App Router for faster loading and SEO.
- **Client Components**: We use React Hooks (`useState`, `useEffect`) for interactive parts, like the WebSocket connection that shows real-time CDN cache hits and live server metrics.
- **API Integration**: All API calls from the frontend go to `http://localhost:3000` (The API Gateway). The frontend never talks directly to Auth or Storage services.

---

## Summary for the Interviewer

If an interviewer asks you to explain the system, say:

> *"EdgeSphere is a microservices-based cloud platform. At the front, I have a **Next.js Dashboard** that communicates with a central **NestJS API Gateway**. The Gateway handles rate limiting via **Redis** and JWT authentication. It routes requests to backend services like **Auth** and **Storage**, which store metadata in **PostgreSQL** and binaries in **MinIO**. To ensure high performance, I built custom **CDN Edge nodes** that cache files in Redis and do on-the-fly image resizing. Finally, everything is tied together asynchronously using **Apache Kafka**, allowing real-time analytics and WebSocket notifications without blocking the main HTTP threads."*
