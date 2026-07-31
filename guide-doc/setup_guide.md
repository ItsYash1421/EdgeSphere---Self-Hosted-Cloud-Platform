# EdgeSphere Master Setup Guide

This document outlines the step-by-step setup process for the EdgeSphere platform. You have successfully written the code for the services, but to run them on any new machine, you need to configure the external dependencies and infrastructure.

## Prerequisites

Before running the platform, ensure you have the following installed on your machine:
1. **Node.js** (v20+ recommended)
2. **pnpm** (`npm install -g pnpm`)
3. **Docker** and **Docker Compose** (Docker Desktop for Mac)

## Phase Setup & External Dependencies

The platform uses a unified Docker Compose file (`infra/docker/docker-compose.dev.yml`) to manage all external dependencies (infrastructure). You do **not** need to install PostgreSQL, Redis, Kafka, or MinIO directly on your Mac. Docker handles all of them.

### 1. Database & Caching (PostgreSQL & Redis)
- **PostgreSQL**: Used by Auth, Storage, and Dashboard services to store users, buckets, and metadata.
- **Redis**: Used by API Gateway (rate limiting), Auth (session/JWT blacklisting), Cache Service, and CDN Edge.
- *Setup*: Automatically spun up by Docker. The database is initialized via the `/infra/docker/postgres/init.sql` script.

### 2. Object Storage (MinIO)
- **MinIO**: An S3-compatible object storage server. Used by the Storage Service to store actual uploaded files.
- *Setup*: Automatically spun up by Docker. Buckets are dynamically created by the NestJS Storage Service using the `minio` client library.

### 3. Event Bus (Kafka)
- **Apache Kafka**: Used for asynchronous microservice communication (e.g., triggering video transcoding, logging analytics events).
- *Setup*: Requires a Zookeeper instance (or KRaft mode). We are using a modern Kafka image. It takes ~15-20 seconds to boot up completely.

### 4. Observability (Prometheus, Grafana, Jaeger, Loki)
- **Prometheus**: Scrapes metrics from all NestJS services.
- **Grafana**: Visualizes the Prometheus metrics.
- **Jaeger**: Distributed tracing for API requests across microservices.
- **Loki**: Centralized logging.
- *Setup*: Fully configured in `docker-compose.dev.yml`.

---

## How to Run the Platform

We have bundled everything into a single startup script to make your life easier.

### Step 1: Start Docker Desktop
Make sure the Docker Desktop application is open and running in the background. (You should see the whale icon in your Mac menu bar).

### Step 2: Run the Master Command
Open your terminal in the `EdgeSphere` root directory and run:

```bash
npm run Edsphere
```

### What this command does:
1. **Builds** all your NestJS and Next.js applications using multi-stage Dockerfiles.
2. **Starts Infrastructure**: Boots up Postgres, Redis, MinIO, Kafka, and Observability tools.
3. **Waits**: Pauses to ensure the databases and Kafka are healthy.
4. **Starts Applications**: Boots up Auth, Gateway, Storage, Analytics, Cache, CDN, WebSockets, and the Dashboard.
5. **Prints URLs**: Outputs a clean list of all running services and their ports.

---

## Service URLs Overview

Once `npm run Edsphere` completes, you can access your services here:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | `http://localhost:3100` | Next.js Frontend |
| **API Gateway** | `http://localhost:3000` | Main entry point for all API requests |
| **Auth Service** | `http://localhost:3001` | Handles Login/Register |
| **Storage Service** | `http://localhost:3002` | Handles Buckets & File Uploads |
| **Analytics Service** | `http://localhost:3003` | Tracks metrics & events |
| **CDN Edge A** | `http://localhost:8080` | Edge node for fast content delivery |
| **Grafana** | `http://localhost:3200` | Dashboards (admin/admin) |
| **MinIO Console**| `http://localhost:9001` | Object Storage UI |

## Troubleshooting

1. **Port Already Allocated**: If a service fails to start because a port (e.g., 3100) is in use, you can stop all containers using:
   ```bash
   npm run Edsphere -- --stop
   ```
   Or explicitly restart Docker Desktop.

2. **Network Timeout / Socket Hang Up**: If you are building for the first time and get an `ECONNRESET` error during `pnpm install`, it means Docker is downloading too many things at once. We have already fixed this by building services sequentially.

3. **Checking Logs**: To see what is happening inside a specific service, run:
   ```bash
   docker compose -f infra/docker/docker-compose.dev.yml logs -f <service-name>
   ```
