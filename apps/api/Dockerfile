# ===================================
# API Dockerfile
# Multi-stage build for Node.js API
# ===================================

# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/
COPY packages/speech-client/package.json ./packages/speech-client/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source files
COPY tsconfig.json tsconfig.base.json ./
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

# Build all packages and apps using TypeScript project references
# --force ensures all projects are rebuilt regardless of timestamps
RUN npx tsc --build --force

# Stage 2: Production
FROM node:22-slim AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/
COPY packages/speech-client/package.json ./packages/speech-client/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/speech-client/dist ./packages/speech-client/dist

# Set environment
ENV NODE_ENV=production
ENV API_PORT=3001

# Expose port
EXPOSE 3001

# Healthcheck - verifies the API health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "(function(){const http=require('http');const opt={host:'127.0.0.1',port:process.env.API_PORT||3001,path:'/api/health'};const req=http.get(opt,res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));})();"

# Run as non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash nodejs
USER nodejs

# Start the server
CMD ["node", "apps/api/dist/index.js"]
