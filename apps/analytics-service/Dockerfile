FROM node:22-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/analytics-service/package.json ./apps/analytics-service/
RUN pnpm install --filter @edgesphere/analytics-service...
COPY apps/analytics-service ./apps/analytics-service
RUN pnpm --filter @edgesphere/analytics-service build

FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/analytics-service/dist ./dist
COPY --from=builder /app/package*.json ./
EXPOSE 3003
CMD ["npm", "start"]\n