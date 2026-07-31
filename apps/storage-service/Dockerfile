FROM node:22-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/storage-service/package.json ./apps/storage-service/
RUN pnpm install --filter @edgesphere/storage-service...
COPY apps/storage-service ./apps/storage-service
RUN pnpm --filter @edgesphere/storage-service build

FROM node:18-alpine
RUN npm install -g pnpm@9

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/storage-service/dist ./dist
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

EXPOSE 3002

CMD ["npm", "run", "start:prod"]
