FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY pnpm-workspace.yaml ./

# Copy shared packages
COPY packages/ ./packages/

# Copy service files
COPY apps/websocket-gateway/ ./apps/websocket-gateway/

# Install dependencies using pnpm
RUN npm install -g pnpm && pnpm install --filter @edgesphere/websocket-gateway...

WORKDIR /app/apps/websocket-gateway

# Build service
RUN pnpm run build

EXPOSE 3006

CMD ["node", "dist/main"]
