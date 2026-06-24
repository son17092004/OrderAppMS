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

# Build common and delivery-service
RUN npm run build -w packages/common
RUN npm run build -w packages/delivery-service

# Production runner
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/packages/common /app/packages/common
COPY --from=base /app/packages/delivery-service /app/packages/delivery-service

ENV PORT=3008
EXPOSE 3008
CMD ["node", "packages/delivery-service/dist/main.js"]
