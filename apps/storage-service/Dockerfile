FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/storage-service/package.json ./apps/storage-service/
RUN pnpm install --filter @edgesphere/storage-service...

COPY apps/storage-service ./apps/storage-service
RUN pnpm --filter @edgesphere/storage-service build

EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "apps/storage-service/dist/main"]
