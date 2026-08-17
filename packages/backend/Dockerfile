FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies
RUN npm install

# Copy source
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY tsconfig.json ./

# Build shared first, then backend
RUN npm run build -w packages/shared
RUN npm run build -w packages/backend

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./
COPY --from=builder /app/packages/shared/dist ./node_modules/@reelroom/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@reelroom/shared/

# Install production dependencies only
RUN npm install --omit=dev

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/server.js"]
