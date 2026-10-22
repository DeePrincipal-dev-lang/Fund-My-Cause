# docker/node-service-base — Shared Node.js service base image

This directory contains the base Dockerfile shared by all Fund-My-Cause Node.js
microservices (`services/indexer`, `services/monitoring-service`).

## What it provides

| Layer | Detail |
|-------|--------|
| Base image | `node:20-alpine` |
| `dumb-init` | Installed via `apk add` — ensures correct signal propagation for the Node process |
| Non-root user | `app` (uid 1001), group `nodejs` (gid 1001) |

## Why a shared base?

Before this change (see issue #1199), both `services/indexer/Dockerfile` and
`services/monitoring-service/Dockerfile` independently installed `dumb-init`
and created the same non-root user.  That meant:

- **Duplicated `apk add`** — the heavy layer was cached independently per
  service and had to be re-scanned separately for CVEs.
- **Drift risk** — a hardening change (e.g. adding a new package or changing the
  UID) had to be applied in multiple places and could easily go out of sync.

The shared base solves both problems: one image to scan, one place to update.

## Building locally

```bash
# Build the base image
docker build \
  -f docker/node-service-base/Dockerfile \
  -t fmc/node-service-base:20-alpine \
  docker/node-service-base

# Then build a service (which FROM-extends the base)
docker build -f services/indexer/Dockerfile          -t fmc/indexer          .
docker build -f services/monitoring-service/Dockerfile -t fmc/monitoring-service .
```

## CI workflow

In CI, the base image is built and pushed to the container registry first,
then each service image is built in a subsequent step that pulls the base
from the registry.  The `docker/node-service-base/Dockerfile` path triggers
a separate build job whenever it changes, so dependent service images are
rebuilt automatically.

## Updating the base

1. Edit `docker/node-service-base/Dockerfile`.
2. Bump the tag if you're making a breaking change (e.g. node:20 → node:22).
3. Update the `FROM fmc/node-service-base:<tag>` line in each service Dockerfile.
4. Test locally with the build commands above.
