FROM node:22-alpine
RUN npm install -g pnpm@9
WORKDIR /app

# Install dependencies (pnpm virtual store stays intact — no symlink issues)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/gateway/package.json ./apps/gateway/
RUN pnpm install --filter @edgesphere/gateway...

# Build TypeScript
COPY apps/gateway ./apps/gateway
RUN pnpm --filter @edgesphere/shared build
RUN pnpm --filter @edgesphere/gateway build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "apps/gateway/dist/main"]
