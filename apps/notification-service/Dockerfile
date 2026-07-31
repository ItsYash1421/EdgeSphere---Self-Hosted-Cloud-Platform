FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/notification-service/package.json ./apps/notification-service/
RUN pnpm install --filter @edgesphere/notification-service...

COPY apps/notification-service ./apps/notification-service
RUN pnpm --filter @edgesphere/notification-service build

EXPOSE 3005
ENV NODE_ENV=production
CMD ["node", "apps/notification-service/dist/main"]
