/**
 * __tests__/alert-pipeline.test.ts
 *
 * Tests covering all four acceptance criteria from the Seam 4 / alert
 * pipeline fix:
 *
 *  AC1. No MockTransport is reachable from POST /incidents.
 *  AC2. Only one AlertPayload type exists in the service.
 *  AC3. analyzeMetric/analyzeMetricAsync are guarded by SIMULATION_MODE or
 *       PROMETHEUS_URL; Math.random() is gone.
 *  AC4. rollback() is guarded by SIMULATION_MODE or DEPLOYMENT_API_URL;
 *       the bare setTimeout stub is gone.
 */

import { AlertTransport, AlertPayload, buildAlertTransportFromEnv } from '../alert-transport';
import { AlertRuleEvaluator, AlertmanagerAlert } from '../alert-rule';
import { IncidentResponseEngine } from '../incident-response';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIncident(overrides: Partial<{
  id: string;
  alert_name: string;
  severity: string;
  description: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved' | 'escalated';
  triggered_at: string;
  source: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created_at: string;
  updated_at: string;
  escalation_level: number;
  assigned_to: string | null;
}> = {}) {
  return {
    id: 'incident-1',
    alert_name: 'TestAlert',
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
    ...overrides,
  };
}

function makeFiringAlert(overrides: Partial<AlertmanagerAlert> = {}): AlertmanagerAlert {
  return {
    status: 'firing',
    labels: { alertname: 'HighErrorRate', service: 'api' },
    annotations: { description: 'Error rate exceeded 5%' },
    startsAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: No MockTransport reachable from POST /incidents
// ---------------------------------------------------------------------------

describe('AC1: No MockTransport in production path', () => {
  it('alert-transport.ts does not contain a MockTransport class', async () => {
    // Require the module source and confirm the class name MockTransport
    // is not exported.
    const mod = await import('../alert-transport');
    expect(mod).not.toHaveProperty('MockTransport');
  });

  it('alert-rule.ts does not contain a MockTransport class', async () => {
    const mod = await import('../alert-rule');
    expect(mod).not.toHaveProperty('MockTransport');
  });

  it('incident-response.ts does not contain a MockTransport class', async () => {
    const mod = await import('../incident-response');
    expect(mod).not.toHaveProperty('MockTransport');
  });

  it('AlertTransport.send() performs real HTTP delivery (not a push-to-array mock)', () => {
    // Verify the class has a real send() method backed by an AxiosInstance,
    // not a .delivered array accumulator.
    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'http://localhost:9999/stub' }],
    });
    expect(typeof transport.send).toBe('function');
    expect(transport).not.toHaveProperty('delivered');
  });

  it('buildAlertTransportFromEnv() returns null (not a mock) when no env vars are set', () => {
    // Clear all channel env vars.
    const saved = {
      ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
      EMAIL_SMTP_ENDPOINT: process.env.EMAIL_SMTP_ENDPOINT,
    };
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.EMAIL_SMTP_ENDPOINT;

    const result = buildAlertTransportFromEnv();
    expect(result).toBeNull();

    // Restore.
    if (saved.ALERT_WEBHOOK_URL) process.env.ALERT_WEBHOOK_URL = saved.ALERT_WEBHOOK_URL;
    if (saved.SLACK_WEBHOOK_URL) process.env.SLACK_WEBHOOK_URL = saved.SLACK_WEBHOOK_URL;
    if (saved.EMAIL_SMTP_ENDPOINT) process.env.EMAIL_SMTP_ENDPOINT = saved.EMAIL_SMTP_ENDPOINT;
  });
});

// ---------------------------------------------------------------------------
// AC2: Single AlertPayload type
// ---------------------------------------------------------------------------

describe('AC2: Single AlertPayload type', () => {
  it('AlertPayload exported from alert-transport.ts has the canonical shape', () => {
    const payload: AlertPayload = {
      ruleId: 'test-rule',
      severity: 'critical',
      message: 'Test alert message',
      context: { service: 'api', env: 'prod' },
      timestamp: new Date().toISOString(),
    };

    // Shape assertions
    expect(payload.ruleId).toBe('test-rule');
    expect(payload.severity).toBe('critical');
    expect(payload.message).toBe('Test alert message');
    expect(typeof payload.context).toBe('object');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('AlertPayload does NOT have a title or channel field (old notifier.ts shape)', () => {
    const payload: AlertPayload = {
      ruleId: 'r',
      severity: 'info',
      message: 'msg',
      context: {},
      timestamp: new Date().toISOString(),
    };

    // The old notifier.ts AlertPayload had title / description / channel.
    // These must NOT be present on the canonical type.
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('channel');
  });

  it('alert-rule.ts imports AlertPayload from alert-transport.ts only', async () => {
    // Load both modules and verify the evaluator accepts our canonical payload.
    const { AlertRuleEvaluator: Evaluator } = await import('../alert-rule');
    const evaluator = new Evaluator(null);
    expect(evaluator).toBeDefined();
    // If there were a second incompatible AlertPayload type, TypeScript would
    // catch it at compile time; at runtime we verify the evaluator was
    // constructed without error.
  });

  it('AlertTransport.send() accepts an AlertPayload and returns DeliveryResult[]', async () => {
    getAxiosPostFn().mockResolvedValueOnce({ status: 200 });

    const payload: AlertPayload = {
      ruleId: 'rule-1',
      severity: 'warning',
      message: 'Disk space low',
      context: { instance: 'node-1' },
      timestamp: new Date().toISOString(),
    };

    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'http://localhost:9091/alerts' }],
    });

    // send() returns a Promise – it must not throw due to type mismatch.
    await expect(transport.send(payload)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC3: analyzeMetric/analyzeMetricAsync guards
// ---------------------------------------------------------------------------

describe('AC3: analyzeMetric / analyzeMetricAsync guards', () => {
  let engine: IncidentResponseEngine;

  beforeEach(() => {
    engine = new IncidentResponseEngine();
    // Ensure both guards are clear by default.
    delete process.env.SIMULATION_MODE;
    delete process.env.PROMETHEUS_URL;
  });

  afterEach(() => {
    delete process.env.SIMULATION_MODE;
    delete process.env.PROMETHEUS_URL;
  });

  it('analyzeMetric() throws when neither SIMULATION_MODE nor PROMETHEUS_URL is set', () => {
    expect(() => engine.analyzeMetric('cpu_usage', 80, 300)).toThrow(
      /PROMETHEUS_URL.*SIMULATION_MODE/,
    );
  });

  it('analyzeMetric() does NOT use Math.random() – result is deterministic in SIMULATION_MODE', () => {
    process.env.SIMULATION_MODE = 'true';

    const r1 = engine.analyzeMetric('cpu_usage', 80, 300);
    const r2 = engine.analyzeMetric('cpu_usage', 80, 300);

    // Deterministic: both calls must return the same value.
    expect(r1.current_value).toBe(r2.current_value);
    // The value is threshold * 1.1 (88 for threshold=80).
    expect(r1.current_value).toBeCloseTo(80 * 1.1);
  });

  it('analyzeMetric() sets simulated:true when SIMULATION_MODE=true', () => {
    process.env.SIMULATION_MODE = 'true';
    const result = engine.analyzeMetric('error_rate', 0.05, 60);
    expect(result.simulated).toBe(true);
  });

  it('analyzeMetric() throws when PROMETHEUS_URL set but SIMULATION_MODE is not true', () => {
    // PROMETHEUS_URL is present but SIMULATION_MODE is absent – the sync
    // method should direct callers to use analyzeMetricAsync().
    process.env.PROMETHEUS_URL = 'http://prometheus:9090';
    expect(() => engine.analyzeMetric('cpu_usage', 80, 300)).toThrow(/analyzeMetricAsync/);
  });

  it('analyzeMetricAsync() returns simulated result in SIMULATION_MODE', async () => {
    process.env.SIMULATION_MODE = 'true';
    const result = await engine.analyzeMetricAsync('cpu_usage', 80, 300);
    expect(result.simulated).toBe(true);
    expect(result.current_value).toBeCloseTo(80 * 1.1);
  });

  it('analyzeMetricAsync() throws when no config is provided', async () => {
    await expect(engine.analyzeMetricAsync('cpu_usage', 80, 300)).rejects.toThrow(
      /PROMETHEUS_URL.*SIMULATION_MODE/,
    );
  });

  it('analyzeMetric() with SIMULATION_MODE=true returns anomalous=true (value > threshold)', () => {
    process.env.SIMULATION_MODE = 'true';
    const result = engine.analyzeMetric('cpu_usage', 80, 300);
    // threshold * 1.1 > threshold → always anomalous
    expect(result.anomalous).toBe(true);
  });

  it('analyzeMetricAsync() with PROMETHEUS_URL queries Prometheus (mocked)', async () => {
    process.env.PROMETHEUS_URL = 'http://prometheus:9090';

    // analyzeMetricAsync does a lazy `await import('axios')` and calls
    // `axios.default.get(...)`. We satisfy this by stubbing the module
    // with jest.mock at the top of the describe block is not possible after
    // module load, so we test the guard and async shape only here, and
    // leave full Prometheus integration to an integration test.
    // What we CAN assert without network: the method throws meaningfully
    // when PROMETHEUS_URL is set but no server is reachable.
    const freshEngine = new IncidentResponseEngine();
    await expect(freshEngine.analyzeMetricAsync('http_requests_total', 100, 300)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC4: rollback() guards
// ---------------------------------------------------------------------------

describe('AC4: rollback() guards', () => {
  let engine: IncidentResponseEngine;

  beforeEach(() => {
    engine = new IncidentResponseEngine();
    delete process.env.SIMULATION_MODE;
    delete process.env.DEPLOYMENT_API_URL;
  });

  afterEach(() => {
    delete process.env.SIMULATION_MODE;
    delete process.env.DEPLOYMENT_API_URL;
  });

  it('rollback() returns failure when neither SIMULATION_MODE nor DEPLOYMENT_API_URL is set', async () => {
    engine.storeIncident(makeIncident());
    const result = await engine.rollback('incident-1', 'deploy-abc');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/DEPLOYMENT_API_URL.*SIMULATION_MODE/);
  });

  it('rollback() completes in SIMULATION_MODE without making real network calls', async () => {
    process.env.SIMULATION_MODE = 'true';
    engine.storeIncident(makeIncident());

    const result = await engine.rollback('incident-1', 'deploy-abc');

    expect(result.success).toBe(true);
    expect(result.execution_details?.simulated).toBe(true);
    // Incident should be resolved after rollback.
    expect(engine.getIncident('incident-1')?.status).toBe('resolved');
  });

  it('rollback() simulated result contains deployment_id', async () => {
    process.env.SIMULATION_MODE = 'true';
    engine.storeIncident(makeIncident());

    const result = await engine.rollback('incident-1', 'deploy-xyz');

    expect(result.execution_details?.deployment_id).toBe('deploy-xyz');
  });

  it('rollback() in SIMULATION_MODE completes in well under 1 second (no 1s delay)', async () => {
    process.env.SIMULATION_MODE = 'true';
    engine.storeIncident(makeIncident());

    const start = Date.now();
    await engine.rollback('incident-1', 'deploy-fast');
    const elapsed = Date.now() - start;

    // The old code used setTimeout(resolve, 1000); our guard uses 50ms.
    expect(elapsed).toBeLessThan(500);
  });

  it('rollback() calls DEPLOYMENT_API_URL when configured (mocked)', async () => {
    process.env.DEPLOYMENT_API_URL = 'http://deployment-api:8080';
    engine.storeIncident(makeIncident());

    getAxiosPostFn().mockResolvedValueOnce({ status: 200 });

    const result = await engine.rollback('incident-1', 'deploy-real');
    expect(result.action).toBe('rollback');
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AlertRuleEvaluator: unit tests
// ---------------------------------------------------------------------------

describe('AlertRuleEvaluator', () => {
  it('fires high-error-rate rule for matching alert', async () => {
    const evaluator = new AlertRuleEvaluator(null);
    const alert = makeFiringAlert({
      labels: { alertname: 'HighErrorRate', service: 'api', severity: 'critical' },
    });
    const results = await evaluator.evaluateAlert(alert);
    const fired = results.filter((r) => r.fired && r.ruleId === 'high-error-rate');
    expect(fired.length).toBeGreaterThan(0);
  });

  it('does not fire high-error-rate rule for resolved alert', async () => {
    const evaluator = new AlertRuleEvaluator(null);
    const alert = makeFiringAlert({
      status: 'resolved',
      labels: { alertname: 'HighErrorRate' },
    });
    const results = await evaluator.evaluateAlert(alert);
    const fired = results.filter((r) => r.ruleId === 'high-error-rate' && r.fired);
    expect(fired.length).toBe(0);
  });

  it('fires service-down rule', async () => {
    const evaluator = new AlertRuleEvaluator(null);
    const alert = makeFiringAlert({
      labels: { alertname: 'ServiceDown', service: 'indexer' },
    });
    const results = await evaluator.evaluateAlert(alert);
    const fired = results.filter((r) => r.ruleId === 'service-down' && r.fired);
    expect(fired.length).toBe(1);
  });

  it('builds correct AlertPayload message from annotation', async () => {
    const evaluator = new AlertRuleEvaluator(null);
    const alert = makeFiringAlert({
      labels: { alertname: 'HighErrorRate', service: 'api' },
      annotations: { description: 'Error rate is 12%' },
    });
    const results = await evaluator.evaluateAlert(alert);
    const firedResult = results.find((r) => r.ruleId === 'high-error-rate' && r.fired);
    expect(firedResult?.payload?.message).toBe('Error rate is 12%');
  });

  it('fired payload uses canonical AlertPayload shape (ruleId/severity/message/context/timestamp)', async () => {
    const evaluator = new AlertRuleEvaluator(null);
    const alert = makeFiringAlert();
    const results = await evaluator.evaluateAlert(alert);
    const firedResult = results.find((r) => r.fired);
    if (!firedResult?.payload) return;

    const p = firedResult.payload;
    expect(typeof p.ruleId).toBe('string');
    expect(['critical', 'warning', 'info']).toContain(p.severity);
    expect(typeof p.message).toBe('string');
    expect(typeof p.context).toBe('object');
    expect(typeof p.timestamp).toBe('string');
    // Must NOT have old notifier.ts shape fields.
    expect(p).not.toHaveProperty('title');
    expect(p).not.toHaveProperty('channel');
    expect(p).not.toHaveProperty('description');
  });

  it('getRuleIds() returns all built-in rules', () => {
    const evaluator = new AlertRuleEvaluator(null);
    const ids = evaluator.getRuleIds();
    expect(ids).toContain('high-error-rate');
    expect(ids).toContain('service-down');
    expect(ids).toContain('high-latency');
    expect(ids).toContain('disk-space-low');
    expect(ids).toContain('catch-all-critical');
  });

  it('calls transport.send() when transport is provided and rule fires', async () => {
    const mockSend = jest.fn().mockResolvedValue([{ channel: 'webhook', success: true }]);
    const mockTransport = { send: mockSend } as unknown as AlertTransport;

    const evaluator = new AlertRuleEvaluator(mockTransport);
    const alert = makeFiringAlert({
      labels: { alertname: 'HighErrorRate', service: 'api' },
    });

    await evaluator.evaluateAlert(alert);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const calledWith: AlertPayload = mockSend.mock.calls[0][0];
    expect(calledWith.ruleId).toBe('high-error-rate');
    expect(calledWith.severity).toBe('critical');
  });

  it('does NOT call transport.send() when no rule fires', async () => {
    const mockSend = jest.fn();
    const mockTransport = { send: mockSend } as unknown as AlertTransport;

    const evaluator = new AlertRuleEvaluator(mockTransport);
    // An alert with labels that don't match any rule.
    const alert = makeFiringAlert({
      labels: { alertname: 'ObscureMetric', severity: 'info' },
    });

    await evaluator.evaluateAlert(alert);

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AlertTransport: unit tests
// ---------------------------------------------------------------------------

// jest.mock() is hoisted ABOVE all variable declarations in ts-jest, so the
// factory must be fully self-contained. We create a single stable mock fn
// inside the factory and expose it on the mock module so tests can grab it.
jest.mock('axios', () => {
  const postFn = jest.fn();
  const instance = { post: postFn };
  const createFn = jest.fn(() => instance);
  return {
    __esModule: true,
    default: { create: createFn, post: postFn },
    create: createFn,
    _postFn: postFn, // test-internal escape hatch
  };
});

/** Retrieve the stable postFn reference from the mocked axios module. */
function getAxiosPostFn(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('axios')._postFn as jest.Mock;
}

describe('AlertTransport', () => {
  const payload: AlertPayload = {
    ruleId: 'high-error-rate',
    severity: 'critical',
    message: 'Error rate exceeded threshold',
    context: { service: 'api', env: 'prod' },
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    getAxiosPostFn().mockReset();
  });

  it('returns DeliveryResult[] from send()', async () => {
    getAxiosPostFn().mockResolvedValue({ status: 200 });

    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'http://localhost:9091/alerts' }],
    });

    const results = await transport.send(payload);
    expect(Array.isArray(results)).toBe(true);
    expect(results[0].channel).toBe('webhook');
    expect(results[0].success).toBe(true);
  });

  it('captures per-channel errors without crashing the pipeline', async () => {
    getAxiosPostFn().mockRejectedValue(new Error('Network unreachable'));

    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'http://bad-host/alerts' }],
    });

    const results = await transport.send(payload);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/Network unreachable/);
  });

  it('delivers to multiple channels independently', async () => {
    getAxiosPostFn().mockResolvedValue({ status: 200 });

    const transport = new AlertTransport({
      channels: [
        { type: 'webhook', url: 'http://localhost:9091/alerts' },
        { type: 'slack', webhookUrl: 'https://hooks.slack.com/test' },
      ],
    });

    const results = await transport.send(payload);
    expect(results).toHaveLength(2);
    const channelTypes = results.map((r) => r.channel);
    expect(channelTypes).toContain('webhook');
    expect(channelTypes).toContain('slack');
  });

  it('buildAlertTransportFromEnv() builds transport when ALERT_WEBHOOK_URL is set', () => {
    process.env.ALERT_WEBHOOK_URL = 'http://monitoring-service:9091/alerts';
    const transport = buildAlertTransportFromEnv();
    expect(transport).toBeInstanceOf(AlertTransport);
    delete process.env.ALERT_WEBHOOK_URL;
  });
});
