# Multi-stage Dockerfile for IDS Express.js TypeScript Backend
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create unprivileged user and switch
RUN chown -R node:node /app
USER node

# Expose backend port
EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
