# Autoscaling Configuration Rationale

## Overview
This document explains how the current autoscaling values were derived and why they are set to their current values.

## Current Configuration

### API Service HPA

| Setting | Value | Rationale |
|---------|-------|-----------|
| minReplicas | 2 | Minimum for HA during low traffic |
| maxReplicas | 10 | Scale up to handle peak load |
| targetCPU | 70% | Balance performance and cost |
| targetMemory | 80% | Memory-sensitive workload |

### Indexer Service HPA

| Setting | Value | Rationale |
|---------|-------|-----------|
| minReplicas | 1 | Low baseline requirement |
| maxReplicas | 5 | Moderate scaling needs |
| targetCPU | 60% | CPU-intensive workload |

### Worker Service HPA

| Setting | Value | Rationale |
|---------|-------|-----------|
| minReplicas | 2 | Ensure processing capacity |
| maxReplicas | 8 | Scale for queue backlog |
| targetCPU | 65% | Balanced workload |

## Derivation History

### 2024-01-15: Initial Tuning
- **Event:** Load testing results
- **Action:** Set baseline values based on load test
- **Result:** Stable performance at 70% CPU

### 2024-02-01: Post-Incident Tuning
- **Event:** Memory exhaustion incident
- **Action:** Increased memory limits and lowered CPU target
- **Result:** Improved stability

### 2024-03-15: Performance Optimization
- **Event:** Slower response times
- **Action:** Increased maxReplicas and adjusted thresholds
- **Result:** Better latency at peak load

## Monitoring

### Key Metrics
- CPU utilization
- Memory utilization
- Request rate
- Response time
- Pod count

### Alert Thresholds
- CPU > 80% for 5 min → Warning
- CPU > 90% for 2 min → Critical
- Memory > 85% for 5 min → Warning
- Memory > 95% for 2 min → Critical
- Pod count at max → Warning

## Related Documentation
- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Metrics Server](metrics-server.md)
- [Load Testing Results](load-test-results.md)
