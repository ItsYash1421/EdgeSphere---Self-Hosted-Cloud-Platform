FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/analytics-service/package.json ./apps/analytics-service/
RUN pnpm install --filter @edgesphere/analytics-service...

COPY apps/analytics-service ./apps/analytics-service
RUN pnpm --filter @edgesphere/analytics-service build

EXPOSE 3003
ENV NODE_ENV=production
CMD ["node", "apps/analytics-service/dist/main"]