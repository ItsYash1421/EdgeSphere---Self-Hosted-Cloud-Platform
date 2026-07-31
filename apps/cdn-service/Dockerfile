FROM node:22-alpine
RUN npm install -g pnpm@9 && apk add --no-cache vips-dev fftw-dev build-base python3
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/cdn-service/package.json ./apps/cdn-service/
RUN pnpm install --filter @edgesphere/cdn-service...

COPY apps/cdn-service ./apps/cdn-service
RUN pnpm --filter @edgesphere/cdn-service build

EXPOSE 3007
ENV NODE_ENV=production
CMD ["node", "apps/cdn-service/dist/main"]
