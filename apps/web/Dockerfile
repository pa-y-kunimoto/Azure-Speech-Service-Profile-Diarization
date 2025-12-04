# ===================================
# Web Dockerfile
# Multi-stage build for Nuxt 3 Web App
# ===================================

# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/speech-client/package.json ./packages/speech-client/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source files
COPY tsconfig.json tsconfig.base.json ./
COPY apps/web/ ./apps/web/
COPY packages/ ./packages/

# Build core package first (required for type exports)
WORKDIR /app
RUN npx tsc --build packages/core --force

# Build Nuxt app
WORKDIR /app/apps/web
RUN npm run build

# Stage 2: Production
FROM node:22-slim AS production

WORKDIR /app/.output

# Copy the built Nuxt output
COPY --from=builder /app/apps/web/.output ./

# Nitro expects public assets at server/chunks/public (relative to nitro.mjs)
# Create symlink to fix the path resolution issue
RUN mkdir -p /app/.output/server/chunks && \
    ln -s /app/.output/public /app/.output/server/chunks/public

# Ensure all files are readable
RUN chmod -R 755 /app/.output

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002

# Expose port
EXPOSE 3002

# Run as non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

# Start Nuxt server from the server directory
WORKDIR /app/.output/server
CMD ["node", "index.mjs"]
