FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/cache-service/package.json ./apps/cache-service/
RUN pnpm install --filter @edgesphere/cache-service...

COPY apps/cache-service ./apps/cache-service
RUN pnpm --filter @edgesphere/cache-service build

EXPOSE 3004
ENV NODE_ENV=production
CMD ["node", "apps/cache-service/dist/main"]
