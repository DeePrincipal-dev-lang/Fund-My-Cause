# Shared Node.js 20 service base image
# ────────────────────────────────────────────────────────────────────────────
# This Dockerfile builds the common runtime base that all Fund-My-Cause Node
# services share.  It:
#   - Starts from node:20-alpine
#   - Installs dumb-init for correct PID-1 / signal handling
#   - Creates a non-root "app" user (uid 1001, gid 1001)
#
# Build this image locally:
#   docker build -f docker/node-service-base/Dockerfile \
#                -t fmc/node-service-base:20-alpine \
#                docker/node-service-base
#
# In CI / production, the tag is pushed to the registry and referenced as:
#   FROM fmc/node-service-base:20-alpine
#
# For local development without a registry, each service Dockerfile uses a
# multi-stage approach and references this file via --build-arg or a
# Docker Bake file (see docs/docker.md).
#
# ── Why a separate base? ─────────────────────────────────────────────────────
# Both services/indexer and services/monitoring-service previously duplicated
# the same dumb-init install + non-root user setup.  Moving them here means:
#   1. A single CVE scan target for the OS / system packages layer.
#   2. The "heavy" apk install step is cached once, not twice.
#   3. Hardening changes (user GID, added packages) are applied in one place.
# See: https://github.com/Fund-My-Cause/Fund-My-Cause/issues/1199
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Install dumb-init: a minimal init system that correctly propagates signals
# to child processes (node, npm, etc.) and reaps zombie processes.
# This is the only apk install in the base — every service benefits from it.
RUN apk add --no-cache dumb-init

# Create a dedicated non-root system group and user.
# UID/GID 1001 is reserved for the app across all services so that volume
# mounts and file-permission assumptions remain consistent.
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S app -G nodejs

WORKDIR /app

# Switch to the non-root user by default.
# Individual service Dockerfiles may temporarily switch back to root (e.g. to
# run `npm ci`) and then switch to `USER app` before CMD.
USER app
