FROM node:22-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/gateway/package.json ./apps/gateway/
RUN pnpm install --filter @edgesphere/gateway...
COPY apps/gateway ./apps/gateway
RUN pnpm --filter @edgesphere/gateway build

FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
