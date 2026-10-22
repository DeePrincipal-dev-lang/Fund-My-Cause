# DevOps Infrastructure & Automation Architecture

## Overview

This document captures the architecture, automation pipelines, and infrastructure tools implemented for Fund-My-Cause across secret management, security scanning, automated deployments, and continuous integration.

---

## 1. Secret Management & Rotation

### Objectives
- Secure secret storage and runtime injection using HashiCorp Vault or AWS Secrets Manager.
- Automated secret rotation and audit logging.

### Key Deliverables
- `docs/secret-vault-setup.md`: Setup guide for Vault and AWS Secrets Manager.
- `scripts/secret-access-logging.sh`: Secret access logging and audit tracking.
- `scripts/rotate-secrets.sh`: Rotation script with dry-run and force rotation flags.
- `scripts/test-secret-management.sh`: Secret infrastructure validation tests.

---

## 2. Automated Security Scanning

### Objectives
- Shift-left security automation in GitHub Actions pipelines.
- Multi-layer vulnerability detection across Rust crates, Node.js dependencies, Docker images, and application source code.

### Pipeline Configuration
- `.github/workflows/security-scanning.yml`:
  - **SAST Scanning**: Semgrep static analysis for web and contract code.
  - **Dependency Auditing**: `cargo audit` for Rust vulnerabilities, `npm audit` for JavaScript/TypeScript packages.
  - **Container Scanning**: Trivy container vulnerability analysis for Dockerfiles.
  - **Secret Detection**: Gitleaks pre-commit and CI verification (`.gitleaks.toml`).

---

## 3. Deployment Automation & Monitoring

### Blue-Green & Canary Deployments
- Detailed deployment strategies for zero-downtime rollouts documented in `docs/blue-green-deployment.md` and `docs/canary-deployment.md`.
- Infrastructure provisioning managed through Terraform templates in `terraform/` and Kubernetes manifests in `k8s/`.

### Disaster Recovery & Runbooks
- Multi-region failover and backup automation documented in `docs/disaster-recovery.md` and `docs/runbooks/`.
