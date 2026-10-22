# Deployment Runbook: Indexer & Monitoring Service

## Overview

This runbook provides procedures for restarting, redeploying, and troubleshooting the `services/indexer` and `services/monitoring-service` during incidents.

**Last Updated**: 2026-09-24  
**Maintained By**: Infrastructure Team  
**Escalation Contact**: See [Escalation](#escalation)

---

## Quick Reference

| Service | Health Check | Restart | Status | Logs |
|---------|--------------|---------|--------|------|
| **Indexer** | `/health` (3001) | `kubectl rollout restart deployment/indexer` | `kubectl get deployment/indexer` | `kubectl logs -f deployment/indexer` |
| **Monitoring** | `/health` (9091) | `kubectl rollout restart deployment/monitoring-service` | `kubectl get deployment/monitoring-service` | `kubectl logs -f deployment/monitoring-service` |

All `kubectl` commands in this runbook target the `fund-my-cause` namespace
(declared in [`k8s/namespace.yaml`](../../k8s/namespace.yaml)).

---

## Prerequisites

Before proceeding, ensure you have:

- `kubectl` configured with access to the production cluster
- Appropriate permissions to deploy and restart services
- Access to the relevant Slack channels (#incidents, #infrastructure)
- A terminal with bash shell
- Familiarity with Kubernetes commands

**Verification**:
```bash
kubectl cluster-info
kubectl auth can-i create deployments --namespace=fund-my-cause
```

---

## Service: Indexer

### Health Check

**Endpoint**: `http://<indexer-host>:3001/health`

**Expected Response** (HTTP 200 when healthy, 202 when degraded, 503 when unhealthy):
```json
{
  "status": "healthy",
  "uptime": 9000000,
  "lastEventTime": 1790647500000,
  "lastLedger": 1234567,
  "eventsProcessed": 4821
}
```

> `uptime` and `lastEventTime` are milliseconds since epoch / since process
> start. During the first 30s after boot the service reports `degraded`
> until it ingests its first event.

**Check Command**:
```bash
kubectl exec -it deployment/indexer -n fund-my-cause -- curl http://localhost:3001/health
# or
curl http://<indexer-lb>:3001/health
```

### Restart Procedure

#### 1. Graceful Restart (Recommended)

```bash
# Initiate rolling restart - maintains 1 replica at all times
kubectl rollout restart deployment/indexer -n fund-my-cause

# Monitor progress
kubectl rollout status deployment/indexer -n fund-my-cause --timeout=5m
```

**Expected Behavior**:
- Pods terminate gracefully (30-60 seconds)
- New pods start
- Readiness probe passes
- Service continues without downtime

#### 2. Hard Restart (Emergency)

```bash
# Scale down
kubectl scale deployment/indexer --replicas=0 -n fund-my-cause

# Wait 10 seconds
sleep 10

# Scale up
kubectl scale deployment/indexer --replicas=3 -n fund-my-cause

# Verify
kubectl get pods -l app=indexer -n fund-my-cause
```

### Environment Variables Required

Source: `services/indexer/.env.example`

```bash
# Soroban RPC
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org:443"
CROWDFUND_CONTRACT_ID=gC...
REGISTRY_CONTRACT_ID=gC...        # optional — only if ingesting registry events

# Server
PORT=3001
LOG_LEVEL=info

# Store / RPC tuning (optional, defaults shown)
STORE_MAX_EVENT_CAPACITY=100000
STORE_EVENT_BATCH_SIZE=500
STORE_STALE_LEDGER_THRESHOLD_MS=60000
RPC_REQUEST_TIMEOUT_MS=30000
RPC_MAX_CONCURRENT_REQUESTS=5
RPC_RETRY_ATTEMPTS=3
```

### Rollback Procedure

```bash
# Check rollout history
kubectl rollout history deployment/indexer -n fund-my-cause

# Rollback to previous version
kubectl rollout undo deployment/indexer -n fund-my-cause

# Rollback to specific revision
kubectl rollout undo deployment/indexer --to-revision=5 -n fund-my-cause

# Verify rollback
kubectl rollout status deployment/indexer -n fund-my-cause
```

### Monitoring During Restart

```bash
# Watch logs in real-time
kubectl logs -f deployment/indexer -n fund-my-cause --all-containers=true

# Check pod status
watch kubectl get pods -l app=indexer -n fund-my-cause

# Monitor resource usage
kubectl top pods -l app=indexer -n fund-my-cause
```

---

## Service: Monitoring Service

### Health Check

**Endpoint**: `http://<monitoring-host>:9091/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-24T15:45:00.000Z",
  "uptime": 447112.481,
  "version": "1.0.0",
  "services": {
    "incident_engine": "ok",
    "pagerduty": "ok"
  }
}
```

> Probes: `/healthz` (liveness) and `/readyz` (readiness) are also exposed on
> the same port.

**Check Command**:
```bash
kubectl exec -it deployment/monitoring-service -n fund-my-cause -- curl http://localhost:9091/health
# or
curl http://<monitoring-lb>:9091/health
```

### Restart Procedure

#### 1. Graceful Restart (Recommended)

```bash
# Initiate rolling restart
kubectl rollout restart deployment/monitoring-service -n fund-my-cause

# Monitor progress
kubectl rollout status deployment/monitoring-service -n fund-my-cause --timeout=5m
```

#### 2. Hard Restart (Emergency)

```bash
# Scale down
kubectl scale deployment/monitoring-service --replicas=0 -n fund-my-cause

# Wait 10 seconds
sleep 10

# Scale up
kubectl scale deployment/monitoring-service --replicas=2 -n fund-my-cause

# Verify
kubectl get pods -l app=monitoring-service -n fund-my-cause
```

### Environment Variables Required

Source: `services/monitoring-service/.env.example`

```bash
# Server
PORT=9091

# PagerDuty integration (incident creation + Events API v2)
PAGERDUTY_API_KEY=your-pagerduty-api-key
PAGERDUTY_SERVICE_ID=your-pagerduty-service-id
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
```

### Rollback Procedure

```bash
# Check rollout history
kubectl rollout history deployment/monitoring-service -n fund-my-cause

# Rollback to previous version
kubectl rollout undo deployment/monitoring-service -n fund-my-cause

# Verify rollback
kubectl rollout status deployment/monitoring-service -n fund-my-cause
```

### Monitoring During Restart

```bash
# Watch logs
kubectl logs -f deployment/monitoring-service -n fund-my-cause

# Check pod status
watch kubectl get pods -l app=monitoring-service -n fund-my-cause

# Verify service endpoints
kubectl get svc monitoring-service -n fund-my-cause
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod for detailed error
kubectl describe pod <pod-name> -n fund-my-cause

# Check resource constraints
kubectl top nodes
kubectl top pods -n fund-my-cause

# View init container logs
kubectl logs <pod-name> -c init-container -n fund-my-cause
```

### Connectivity Issues

```bash
# Test service connectivity
kubectl run -it debug --image=curl --restart=Never -- \
  curl http://indexer:3001/health

# Check DNS resolution
kubectl exec -it <pod-name> -- nslookup indexer
kubectl exec -it <pod-name> -- nslookup monitoring-service

# Verify network policies
kubectl get networkpolicy -n fund-my-cause
```

### High CPU/Memory Usage

```bash
# Check resource limits
kubectl describe deployment/indexer -n fund-my-cause | grep -A 5 "Limits"

# Adjust if needed
kubectl set resources deployment/indexer \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=1000m,memory=1Gi \
  -n fund-my-cause

# Monitor again
watch kubectl top pods -l app=indexer -n fund-my-cause
```

### Stuck in CrashLoopBackOff

```bash
# Check logs
kubectl logs <pod-name> --tail=100 -n fund-my-cause

# If due to missing contract IDs, verify the ConfigMap:
kubectl get configmap indexer-config -n fund-my-cause -o yaml

# If due to RPC endpoint:
kubectl exec -it <pod-name> -- \
  curl https://soroban-testnet.stellar.org:443
```

---

## Deployment Process

### Blue-Green Deployment

```bash
# Current version is "blue", deploying new "green"
kubectl apply -f k8s/indexer-deployment.yaml

# After verification, switch traffic
kubectl patch service indexer -p '{"spec":{"selector":{"version":"green"}}}'

# Scale down old version
kubectl scale deployment/indexer-blue --replicas=0
```

### Canary Deployment

```bash
# Deploy to 1 replica with new version
kubectl set image deployment/indexer \
  indexer=registry.io/indexer:v1.1.0 \
  --record -n fund-my-cause

# Monitor metrics
kubectl top pods -l app=indexer -n fund-my-cause

# Complete rollout after 5 minutes of stability
kubectl rollout status deployment/indexer -n fund-my-cause
```

---

## Verification Checklist

### Post-Restart Verification

- [ ] Pods are in Running state: `kubectl get pods -l app=indexer`
- [ ] Health check passes: `curl http://<service>:port/health`
- [ ] No error logs: `kubectl logs deployment/indexer --tail=50`
- [ ] Metrics being collected: Check Prometheus dashboard
- [ ] Performance stable: `kubectl top pods -l app=indexer`
- [ ] Database connectivity OK: Check application metrics
- [ ] Alert status clear: Check monitoring alerts

### Application-Specific Checks

**Indexer**:
- [ ] Latest ledger is being indexed
- [ ] Sync lag is < 1 minute
- [ ] No database connection errors
- [ ] RPC endpoint responding

**Monitoring Service**:
- [ ] Metrics scraped successfully
- [ ] Alert evaluation running
- [ ] Dashboard loading correctly
- [ ] No Prometheus scrape failures

---

## Escalation

### Support Chain

1. **On-Call Infrastructure** (15 min response)
   - Slack: @infrastructure-oncall
   - PagerDuty: Infrastructure Team

2. **Service Owners** (30 min response)
   - Indexer: indexer-team@company.com
   - Monitoring: platform-team@company.com

3. **Engineering Manager** (1 hour response)
   - Slack: @eng-manager

### Severity Levels

| Level | Response | Action |
|-------|----------|--------|
| **SEV-1** | Immediate | All hands, CEO notified |
| **SEV-2** | 15 minutes | Team mobilized |
| **SEV-3** | 1 hour | Standard incident |
| **SEV-4** | Next business day | Low priority |

### Incident Communication

1. **Initial**: Post to #incidents with brief description
2. **Updates**: Every 5 minutes during SEV-1/2
3. **Resolution**: Document in incident system with timeline

---

## Cross-Links

- **Deployment Manifests**:
  - [`k8s/indexer-deployment.yaml`](../../k8s/indexer-deployment.yaml) — Deployment, Service, and ConfigMap for the indexer
  - [`k8s/monitoring-service-deployment.yaml`](../../k8s/monitoring-service-deployment.yaml) — Deployment and Service for the monitoring service
  - [`k8s/namespace.yaml`](../../k8s/namespace.yaml) — target namespace (`fund-my-cause`)
  - Both manifests carry a `runbook.url` annotation pointing back at this document
- **Application Configuration**: `services/indexer/.env.example`, `services/monitoring-service/.env.example`
- **Monitoring Dashboards**: https://grafana.internal/d/indexer
- **Incident Playbook**: See [Incident Response Guide](../incident-response.md)
- **Related Issues**: #1274, #1349

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-24 | 1.0 | Initial runbook creation |
| 2026-09-28 | 1.1 | Correct health-check ports (3001 / 9091), sync env vars with each service's `.env.example`, switch commands to the `fund-my-cause` namespace, cross-link `k8s/` manifests (#1349) |

## Approvals

- [ ] Infrastructure Lead
- [ ] On-Call Manager
- [ ] Service Owner
