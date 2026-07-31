FROM node:20-alpine AS base
RUN npm install -g pnpm@9
# Sharp needs native deps
RUN apk add --no-cache python3 make g++ vips-dev
RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/cdn-service/package.json ./apps/cdn-service/
RUN pnpm install --filter @edgesphere/cdn-service...

COPY apps/cdn-service ./apps/cdn-service

WORKDIR /app/apps/cdn-service
RUN pnpm run build

FROM node:20-alpine AS production
RUN npm install -g pnpm@9
RUN apk add --no-cache vips
WORKDIR /app
COPY --from=base /app/apps/cdn-service/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/tsconfig.base.json ./
EXPOSE 8080
CMD ["node", "dist/main"]
