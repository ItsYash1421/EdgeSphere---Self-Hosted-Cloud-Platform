FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/auth-service/package.json ./apps/auth-service/
RUN pnpm install --filter @edgesphere/auth-service...

COPY apps/auth-service ./apps/auth-service
RUN pnpm --filter @edgesphere/shared build
RUN pnpm --filter @edgesphere/auth-service build

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "apps/auth-service/dist/main"]
