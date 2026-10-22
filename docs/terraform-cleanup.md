# Terraform Cleanup Documentation

## Overview
This document describes the Terraform cleanup process for removing unused variables and modules.

## Audit Process

### 1. Run Audit Script
```bash
./scripts/audit-terraform.sh
./scripts/cleanup-terraform.sh
./scripts/verify-terraform.sh
terraform plan
# Shows changes (if any)
terraform plan
# Should show no unintended changes
