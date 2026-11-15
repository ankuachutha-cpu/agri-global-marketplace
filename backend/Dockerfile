# Production Dockerfile for AgriGlobal Backend API
FROM node:20-alpine AS base

# Install curl for docker healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/
COPY data/ ./data/

# Create uploads and logs directories
RUN mkdir -p uploads logs && chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
