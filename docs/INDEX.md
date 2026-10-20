# Fund-My-Cause Documentation Index

> **Master index and implementation changelog across Fund-My-Cause architecture, contracts, services, and operations.**

---

## 📚 Core Developer Guides

| Document | Purpose |
|----------|---------|
| [docs/SETUP.md](./SETUP.md) | **Start here** — Single onboarding guide covering monorepo setup, env vars, contracts build, and troubleshooting |
| [docs/contributor-onboarding.md](./contributor-onboarding.md) | Detailed contributor guide, PR workflows, and standards |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Code of conduct and contribution lifecycle |
| [SECURITY.md](../SECURITY.md) | Security vulnerability disclosure policy |
| [CHANGELOG.md](../CHANGELOG.md) | Repository release notes and version history |

---

## 🏛 Architecture & Design

Consolidated architecture specifications extracted from feature implementations:

| Module / Topic | Document | Summary |
|----------------|----------|---------|
| **High-Level System Architecture** | [docs/architecture.md](./architecture.md) | System overview, verified data flow, and cross-boundary communication |
| **Backend & Ingestion** | [docs/backend-architecture.md](./backend-architecture.md) | Indexer, database models, and caching layers |
| **GraphQL API Service** | [docs/architecture/graphql-api-service.md](./architecture/graphql-api-service.md) | Apollo Server 4, Redis cache invalidation, and WebSocket subscriptions |
| **APM & Distributed Tracing** | [docs/architecture/apm-monitoring.md](./architecture/apm-monitoring.md) | Observability, OpenTelemetry traces, Prometheus metrics, and alerting |
| **Gamification & Achievements** | [docs/architecture/gamification.md](./architecture/gamification.md) | Badges, leaderboard ranking, social sharing, and milestone rewards |
| **RBAC & Team Management** | [docs/architecture/rbac-team-management.md](./architecture/rbac-team-management.md) | Multi-role campaign administration and multi-signature approval workflows |
| **DevOps & Infrastructure** | [docs/architecture/devops-infrastructure.md](./architecture/devops-infrastructure.md) | CI/CD pipelines, secret management, automated security scanning, and deployments |
| **Security Hardening** | [docs/architecture/security-hardening.md](./architecture/security-hardening.md) | Contract reentrancy guards, circuit breakers, and vulnerability remediation |
| **Contract Monolith Decomposition** | [docs/architecture/monolith-decomposition.md](./architecture/monolith-decomposition.md) | Modularization strategy and crate architecture |
| **Cross-Browser Testing** | [docs/architecture/cross-browser-testing.md](./architecture/cross-browser-testing.md) | Playwright multi-engine testing specifications |
| **Advanced Features** | [docs/architecture/advanced-features.md](./architecture/advanced-features.md) | Campaign milestones, refunds, and donation matching |

---

## 📜 Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./adr/ADR-001-pull-based-refund-model.md) | Pull-based refund model | Accepted |
| [ADR-002](./adr/ADR-002-off-chain-indexer-architecture.md) | Off-chain indexer architecture | Accepted |
| [ADR-003](./adr/ADR-003-graphql-api-for-frontend-queries.md) | GraphQL API for frontend queries | Accepted |
| [ADR-004](./adr/ADR-004-contract-module-boundaries.md) | Soroban contract module boundaries (`contracts/common`) | Active |
| [ADR-005](./adr/ADR-005-fraud-detection-vs-recommendations-service-split.md) | Keeping `fraud_detection` and `recommendations` as separate services | Proposed |
| [ADR-006](./adr/ADR-006-unify-frontend-read-paths.md) | Unify Frontend Chain Read Paths via GraphQL API | Proposed |
| [ADR-007](./adr/ADR-007-stellar-contract-upgrade-strategy.md) | Stellar smart contract upgrade strategy & state migration | Accepted |

---

## 📡 API & SDK References

| Reference | Scope |
|-----------|-------|
| [docs/api/README.md](./api/README.md) | Root API documentation hub |
| [docs/api/crowdfund.md](./api/crowdfund.md) | Crowdfund contract Soroban function interface |
| [docs/api/registry.md](./api/registry.md) | Registry contract discovery interface |
| [docs/api/graphql.md](./api/graphql.md) | GraphQL API schema, auth headers, rate limits, and mutations |
| [docs/api/events.md](./api/events.md) | Contract event signatures and payloads |
| [docs/api/errors.md](./api/errors.md) | Contract error codes and recovery guidance |
| [docs/api/sdk-js/](./api/sdk-js/README.md) | Generated `@fund-my-cause/sdk` TypeScript documentation |

---

## ⚙️ Operations & Runbooks

- [Deployment Guide](./deployment.md)
- [Docker Deployment](./docker-deployment.md)
- [Disaster Recovery Runbooks](./disaster-recovery-runbooks.md)
- [Blue-Green Deployment](./blue-green-deployment.md)
- [Canary Deployment](./canary-deployment.md)
- [Environment Configuration](./environment-config.md)
- [Incident Response](./incident-response.md)
