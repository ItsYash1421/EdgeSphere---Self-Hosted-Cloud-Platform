FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/cache-service/package.json ./apps/cache-service/
COPY packages ./packages

# Install dependencies
RUN npm install -g pnpm && pnpm install

# Copy source
COPY apps/cache-service ./apps/cache-service

# Build
RUN pnpm --filter @edgesphere/cache-service build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/apps/cache-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/cache-service/package.json ./

EXPOSE 3004
CMD ["node", "dist/main"]
