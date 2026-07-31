FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/websocket-gateway/package.json ./apps/websocket-gateway/
RUN pnpm install --filter @edgesphere/websocket-gateway...

COPY apps/websocket-gateway ./apps/websocket-gateway
RUN pnpm --filter @edgesphere/websocket-gateway build

EXPOSE 3006
ENV NODE_ENV=production
CMD ["node", "apps/websocket-gateway/dist/main"]
