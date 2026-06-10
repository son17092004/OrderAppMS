# Base stage
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig*.json ./
COPY jest.config.js ./
COPY nx.json ./
COPY packages packages

# Install all workspace dependencies
RUN npm install --no-audit --no-fund

# Build common and api-gateway
RUN npm run build -w packages/common
RUN npm run build -w packages/api-gateway

# Production runner
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/packages/common /app/packages/common
COPY --from=base /app/packages/api-gateway /app/packages/api-gateway

ENV PORT=3000
EXPOSE 3000
CMD ["node", "packages/api-gateway/dist/main.js"]
