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

# Build common and cart-service
RUN npm run build -w packages/common
RUN npm run build -w packages/cart-service

# Production runner
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/packages/common /app/packages/common
COPY --from=base /app/packages/cart-service /app/packages/cart-service

ENV PORT=3003
EXPOSE 3003
CMD ["node", "packages/cart-service/dist/main.js"]
