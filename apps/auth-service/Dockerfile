FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/auth-service/package.json ./apps/auth-service/
RUN pnpm install --filter @edgesphere/auth-service...

COPY apps/auth-service ./apps/auth-service
RUN pnpm --filter @edgesphere/shared build
RUN pnpm --filter @edgesphere/logger build
RUN pnpm --filter @edgesphere/auth-service build

FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/apps/auth-service/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/auth/health || exit 1
CMD ["node", "dist/main"]
