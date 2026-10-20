# services/indexer — multi-stage build
# ────────────────────────────────────────────────────────────────────────────
# Stage 1 (builder): install all deps + compile TypeScript
# Stage 2 (runner):  production-only deps + compiled output on the shared base
#
# Shared base: docker/node-service-base/Dockerfile
#   Provides: dumb-init, non-root "app" user (uid 1001 / gid nodejs)
#
# Build from repo root:
#   docker build -f services/indexer/Dockerfile -t fmc/indexer .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDeps needed for tsc)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
# Use the shared base which already has dumb-init and the non-root user.
# For local builds without a registry, reference the base via a local build.
# In CI, the base image is pulled from the registry and cached.
#
# See docker/node-service-base/Dockerfile for what this image provides.
FROM fmc/node-service-base:20-alpine

WORKDIR /app

# Temporarily switch to root for package installation, then hand off to app.
USER root

# Copy package files
COPY package*.json ./

# Install production dependencies only and clear the npm cache.
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from the builder stage
COPY --from=builder /app/dist ./dist

# Ensure the non-root user owns the working directory
RUN chown -R app:nodejs /app

# Switch to the non-root user provided by the base image
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Environment defaults
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose the HTTP port
EXPOSE 3001

# Use dumb-init (from the base image) to ensure correct signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
