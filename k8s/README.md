# Kubernetes Deployment Guide

## Overview

This directory contains Kubernetes manifests for deploying Fund-My-Cause on a Kubernetes cluster.

## Files

- `namespace.yaml` - Kubernetes namespace for the application
- `configmap.yaml` - Application configuration
- `deployment.yaml` - Frontend deployment with 3 replicas
- `deployment-api.yaml` - API deployment
- `service.yaml` - ClusterIP service for internal communication
- `ingress.yaml` - Ingress configuration for external access
- `indexer-deployment.yaml` - Indexer Deployment, Service, and ConfigMap
- `monitoring-service-deployment.yaml` - Monitoring service Deployment and Service

## Runbooks

Operational procedures (restart, rollback, health checks, escalation) live in
`docs/runbooks/`:

- [Indexer & Monitoring Service Deployment Runbook](../docs/runbooks/indexer-monitoring-service-deployment.md)

Both `indexer-deployment.yaml` and `monitoring-service-deployment.yaml` carry a
`runbook.url` annotation pointing at that document, so `kubectl describe
deployment/<name>` surfaces the runbook link directly in the cluster.

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured to access your cluster
- NGINX Ingress Controller installed
- cert-manager installed (for TLS certificates)

## Installation

### 1. Create namespace and ConfigMap

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
```

### 2. Update ConfigMap with your values

Edit `k8s/configmap.yaml` with your actual contract ID, RPC URL, and network passphrase:

```bash
kubectl edit configmap fund-my-cause-config -n fund-my-cause
```

### 3. Deploy the application

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

Or deploy all at once:

```bash
kubectl apply -f k8s/
```

## Verification

Check deployment status:

```bash
kubectl get deployments -n fund-my-cause
kubectl get pods -n fund-my-cause
kubectl get svc -n fund-my-cause
kubectl get ingress -n fund-my-cause
```

View logs:

```bash
kubectl logs -n fund-my-cause -l app=fund-my-cause-frontend -f
```

## Scaling

Scale the deployment:

```bash
kubectl scale deployment fund-my-cause-frontend -n fund-my-cause --replicas=5
```

## Updating

Update the image:

```bash
kubectl set image deployment/fund-my-cause-frontend \
  frontend=fund-my-cause:v1.0.0 \
  -n fund-my-cause
```

## Cleanup

Remove all resources:

```bash
kubectl delete namespace fund-my-cause
```

## Ingress Configuration

Update the hostname in `k8s/ingress.yaml`:

```yaml
- host: your-domain.com
```

Then apply:

```bash
kubectl apply -f k8s/ingress.yaml
```

## Resource Limits

Current resource requests and limits:
- CPU: 250m request, 500m limit
- Memory: 256Mi request, 512Mi limit

Adjust in `k8s/deployment.yaml` based on your needs.

## Health Checks

- Liveness probe: Checks every 10 seconds after 30s initial delay
- Readiness probe: Checks every 5 seconds after 10s initial delay

Both probes check the HTTP endpoint on port 3000.
