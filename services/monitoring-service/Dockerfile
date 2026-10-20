# services/monitoring-service — multi-stage build
# ────────────────────────────────────────────────────────────────────────────
# Stage 1 (builder): install all deps + compile TypeScript
# Stage 2 (runner):  production-only deps + compiled output on the shared base
#
# Shared base: docker/node-service-base/Dockerfile
#   Provides: dumb-init, non-root "app" user (uid 1001 / gid nodejs)
#
# Build from repo root:
#   docker build -f services/monitoring-service/Dockerfile -t fmc/monitoring .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps needed for tsc)
RUN npm ci

# Copy source
COPY src ./src
COPY tsconfig.json ./

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
COPY package.json package-lock.json ./

# Install production dependencies only and clear the npm cache.
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from the builder stage
COPY --from=builder /app/dist ./dist

# Ensure the non-root user owns the working directory
RUN chown -R app:nodejs /app

# Switch to the non-root user provided by the base image
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9091/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Environment defaults
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose metrics and API ports
EXPOSE 9091

# Use dumb-init (from the base image) to ensure correct signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
