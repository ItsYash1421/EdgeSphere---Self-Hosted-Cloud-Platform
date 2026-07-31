FROM node:20-alpine
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/notification-service/package.json ./apps/notification-service/
RUN pnpm install --filter @edgesphere/notification-service...
COPY apps/notification-service ./apps/notification-service
RUN pnpm --filter @edgesphere/notification-service build

WORKDIR /app/apps/notification-service
EXPOSE 3005
CMD ["npm", "run", "start"]
