import { IncidentResponseEngine } from '../incident-response';

describe('IncidentResponseEngine', () => {
  let engine: IncidentResponseEngine;

  beforeEach(() => {
    engine = new IncidentResponseEngine();
  });

  describe('Incident Management', () => {
    it('should store and retrieve an incident', () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'HighErrorRate',
        severity: 'critical',
        description: 'Error rate is high',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: { service: 'api' },
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const retrieved = engine.getIncident('incident-1');

      expect(retrieved).toEqual(incident);
    });

    it('should update an incident', () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'HighErrorRate',
        severity: 'critical',
        description: 'Error rate is high',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const updated = engine.updateIncident('incident-1', {
        status: 'in-progress',
        assigned_to: 'user-1',
      });

      expect(updated?.status).toBe('in-progress');
      expect(updated?.assigned_to).toBe('user-1');
    });

    it('should list incidents with filters', () => {
      const incident1 = {
        id: 'incident-1',
        alert_name: 'HighErrorRate',
        severity: 'critical',
        description: 'Error rate is high',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      const incident2 = {
        ...incident1,
        id: 'incident-2',
        severity: 'warning',
        status: 'resolved' as const,
      };

      engine.storeIncident(incident1);
      engine.storeIncident(incident2);

      const critical = engine.listIncidents({ severity: 'critical' });
      const resolved = engine.listIncidents({ status: 'resolved' });

      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe('incident-1');
      expect(resolved).toHaveLength(1);
      expect(resolved[0].id).toBe('incident-2');
    });

    it('should handle incident not found', () => {
      const result = engine.getIncident('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('Remediation Actions', () => {
    it('should execute scale_up remediation', async () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'HighLoad',
        severity: 'critical',
        description: 'High load detected',
        category: 'infrastructure',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-1', 'scale_up', {
        service: 'api',
        replicas: 5,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('scale_up');
      expect(result.execution_details?.service).toBe('api');
    });

    it('should execute clear_cache remediation', async () => {
      const incident = {
        id: 'incident-2',
        alert_name: 'CacheMiss',
        severity: 'warning',
        description: 'High cache miss rate',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-2', 'clear_cache');

      expect(result.success).toBe(true);
      expect(result.action).toBe('clear_cache');
    });

    it('should execute restart_service remediation', async () => {
      const incident = {
        id: 'incident-3',
        alert_name: 'ServiceHang',
        severity: 'critical',
        description: 'Service is hanging',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-3', 'restart_service', {
        service: 'api',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('restart_service');
    });

    it('should execute kill_long_queries remediation', async () => {
      const incident = {
        id: 'incident-4',
        alert_name: 'SlowQueries',
        severity: 'warning',
        description: 'Slow database queries',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-4', 'kill_long_queries', {
        threshold_ms: 3000,
      });

      expect(result.success).toBe(true);
      expect(result.execution_details?.queries_killed).toBeGreaterThanOrEqual(0);
    });

    it('should execute enable_circuit_breaker remediation', async () => {
      const incident = {
        id: 'incident-5',
        alert_name: 'HighErrorRate',
        severity: 'critical',
        description: 'High error rate in API',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-5', 'enable_circuit_breaker', {
        service: 'api',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('enable_circuit_breaker');
    });

    it('should execute reduce_workload remediation', async () => {
      const incident = {
        id: 'incident-6',
        alert_name: 'OverLoad',
        severity: 'warning',
        description: 'System overload',
        category: 'infrastructure',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-6', 'reduce_workload', {
        reduction_percentage: 40,
      });

      expect(result.success).toBe(true);
    });

    it('should execute enable_maintenance_mode remediation', async () => {
      const incident = {
        id: 'incident-7',
        alert_name: 'CriticalIssue',
        severity: 'critical',
        description: 'Critical system issue',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-7', 'enable_maintenance_mode', {
        duration_minutes: 20,
      });

      expect(result.success).toBe(true);
    });

    it('should execute failover_backup remediation', async () => {
      const incident = {
        id: 'incident-8',
        alert_name: 'RegionDown',
        severity: 'critical',
        description: 'Region is down',
        category: 'infrastructure',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-8', 'failover_backup', {
        primary: 'us-east-1',
        backup: 'us-west-2',
      });

      expect(result.success).toBe(true);
    });

    it('should fail for unknown action', async () => {
      const incident = {
        id: 'incident-9',
        alert_name: 'Test',
        severity: 'info',
        description: 'Test incident',
        category: 'test',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.executeRemediation('incident-9', 'unknown_action');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown action');
    });

    it('should fail for nonexistent incident', async () => {
      const result = await engine.executeRemediation('nonexistent', 'scale_up');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('Escalation', () => {
    it('should escalate incident through levels', () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'Test',
        severity: 'critical',
        description: 'Test incident',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);

      let escalated = engine.escalateIncident('incident-1');
      expect(escalated?.escalation_level).toBe(2);

      escalated = engine.escalateIncident('incident-1');
      expect(escalated?.escalation_level).toBe(3);

      escalated = engine.escalateIncident('incident-1');
      expect(escalated?.escalation_level).toBe(4);
    });

    it('should get escalation info', () => {
      const info = engine.getEscalationInfo(2);
      expect(info?.title).toBe('On-Call');
      expect(info?.delay_minutes).toBe(5);
    });
  });

  describe('Analysis', () => {
    beforeEach(() => {
      // analyzeMetric() requires either PROMETHEUS_URL or SIMULATION_MODE=true.
      // Tests here exercise the explicit simulation path.
      process.env.SIMULATION_MODE = 'true';
    });

    afterEach(() => {
      delete process.env.SIMULATION_MODE;
    });

    it('should analyze metric', () => {
      const analysis = engine.analyzeMetric('cpu_usage', 80, 300);

      expect(analysis.metric).toBe('cpu_usage');
      expect(analysis.threshold).toBe(80);
      expect(analysis.current_value).toBeGreaterThanOrEqual(0);
      expect(analysis.anomalous).toBeDefined();
    });

    it('should provide recommendations for CPU metric', () => {
      const analysis = engine.analyzeMetric('cpu_usage', 0.1, 300); // Very low threshold
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for error metric', () => {
      const analysis = engine.analyzeMetric('error_rate', 0.1, 300); // Very low threshold
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Rollback', () => {
    beforeEach(() => {
      // rollback() requires either DEPLOYMENT_API_URL or SIMULATION_MODE=true.
      process.env.SIMULATION_MODE = 'true';
    });

    afterEach(() => {
      delete process.env.SIMULATION_MODE;
    });
    it('should rollback deployment', async () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'DeploymentIssue',
        severity: 'critical',
        description: 'Issue after deployment',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      const result = await engine.rollback('incident-1', 'deployment-123');

      expect(result.success).toBe(true);
      expect(result.action).toBe('rollback');
      expect(result.execution_details?.deployment_id).toBe('deployment-123');
    });

    it('should mark incident as resolved after rollback', async () => {
      const incident = {
        id: 'incident-1',
        alert_name: 'DeploymentIssue',
        severity: 'critical',
        description: 'Issue after deployment',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      engine.storeIncident(incident);
      await engine.rollback('incident-1', 'deployment-123');

      const updated = engine.getIncident('incident-1');
      expect(updated?.status).toBe('resolved');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', () => {
      const incident1 = {
        id: 'incident-1',
        alert_name: 'HighErrorRate',
        severity: 'critical',
        description: 'Error rate is high',
        category: 'application',
        status: 'open' as const,
        triggered_at: new Date().toISOString(),
        source: 'alertmanager',
        labels: {},
        annotations: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        escalation_level: 1,
        assigned_to: null,
      };

      const incident2 = {
        ...incident1,
        id: 'incident-2',
        status: 'resolved' as const,
      };

      engine.storeIncident(incident1);
      engine.storeIncident(incident2);

      const stats = engine.getStatistics();

      expect(stats.total_incidents).toBe(2);
      expect(stats.by_status.open).toBe(1);
      expect(stats.by_status.resolved).toBe(1);
      expect(stats.by_severity.critical).toBe(2);
    });
  });

  describe('Available Actions', () => {
    it('should list available remediation actions', () => {
      const actions = engine.getAvailableActions();

      expect(actions).toContain('scale_up');
      expect(actions).toContain('clear_cache');
      expect(actions).toContain('restart_service');
      expect(actions).toContain('kill_long_queries');
      expect(actions).toContain('enable_circuit_breaker');
      expect(actions).toContain('reduce_workload');
      expect(actions).toContain('enable_maintenance_mode');
      expect(actions).toContain('failover_backup');
    });
  });
});
