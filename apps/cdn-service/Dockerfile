FROM node:20-alpine AS base
# Sharp needs native deps
RUN apk add --no-cache python3 make g++ vips-dev
RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-workspace.yaml* ./
COPY apps/cdn-service/package.json ./apps/cdn-service/
RUN pnpm install --filter @edgesphere/cdn-service...

COPY apps/cdn-service ./apps/cdn-service

WORKDIR /app/apps/cdn-service
RUN pnpm run build

FROM node:20-alpine AS production
RUN apk add --no-cache vips
WORKDIR /app
COPY --from=base /app/apps/cdn-service/dist ./dist
COPY --from=base /app/apps/cdn-service/package.json ./
RUN npm install --production

EXPOSE 8080
CMD ["node", "dist/main"]
