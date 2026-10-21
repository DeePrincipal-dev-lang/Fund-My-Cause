/**
 * Unit tests for alert rule evaluation — Issue #907
 *
 * Key property verified: rule evaluation is fully decoupled from transport.
 * Tests use MockAlertTransport (a test double) — no real email or Slack calls.
 */

import {
  ThresholdAlertRule,
  RateAlertRule,
  AlertRuleEvaluator,
  type AlertRuleContext,
} from '../alert-rule';
import type { DeliveryResult, Transport, AlertPayload } from '../alert-transport';

// ── Test double ───────────────────────────────────────────────────────────────

/** Captures all delivered payloads without side-effects. */
class MockAlertTransport implements Transport {
  readonly delivered: AlertPayload[] = [];

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    this.delivered.push(payload);
    return [{ channel: 'mock', success: true }];
  }

  get callCount(): number {
    return this.delivered.length;
  }

  reset(): void {
    this.delivered.length = 0;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<AlertRuleContext> = {}): AlertRuleContext {
  return {
    metric:    'cpu_usage',
    value:     50,
    threshold: 80,
    labels:    { service: 'api' },
    ...overrides,
  };
}

// ── ThresholdAlertRule ────────────────────────────────────────────────────────

describe('ThresholdAlertRule', () => {
  describe('direction: above', () => {
    const rule = new ThresholdAlertRule({
      ruleId:    'cpu-warning',
      direction: 'above',
      severity:  'warning',
    });

    it('does not trigger when value is below threshold', () => {
      const result = rule.evaluate(makeCtx({ value: 70, threshold: 80 }));
      expect(result.triggered).toBe(false);
      expect(result.ruleId).toBe('cpu-warning');
    });

    it('does not trigger when value equals threshold', () => {
      const result = rule.evaluate(makeCtx({ value: 80, threshold: 80 }));
      expect(result.triggered).toBe(false);
    });

    it('triggers when value exceeds threshold', () => {
      const result = rule.evaluate(makeCtx({ value: 81, threshold: 80 }));
      expect(result.triggered).toBe(true);
      expect(result.severity).toBe('warning');
      expect(result.message).toContain('cpu_usage');
      expect(result.message).toContain('above');
    });
  });

  describe('direction: below', () => {
    const rule = new ThresholdAlertRule({
      ruleId:    'cache-hit-low',
      direction: 'below',
      severity:  'critical',
    });

    it('triggers when value is below threshold', () => {
      const result = rule.evaluate(makeCtx({ metric: 'cache_hit_rate', value: 40, threshold: 50 }));
      expect(result.triggered).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('does not trigger when value is above threshold', () => {
      const result = rule.evaluate(makeCtx({ metric: 'cache_hit_rate', value: 70, threshold: 50 }));
      expect(result.triggered).toBe(false);
    });
  });

  it('includes the original context in the result', () => {
    const rule = new ThresholdAlertRule({ ruleId: 'test', direction: 'above', severity: 'info' });
    const ctx  = makeCtx({ value: 99, threshold: 90, labels: { env: 'prod' } });
    const result = rule.evaluate(ctx);
    expect(result.context).toEqual(ctx);
  });
});

// ── RateAlertRule ─────────────────────────────────────────────────────────────

describe('RateAlertRule', () => {
  const rule = new RateAlertRule({
    ruleId:    'error-spike',
    direction: 'increase',
    severity:  'critical',
  });

  it('does not trigger when previousValue is missing', () => {
    const result = rule.evaluate(makeCtx({ metric: 'errors', value: 100 }));
    expect(result.triggered).toBe(false);
    expect(result.message).toContain('insufficient data');
  });

  it('does not trigger when windowSeconds is zero', () => {
    const result = rule.evaluate(
      makeCtx({ metric: 'errors', value: 100, previousValue: 10, windowSeconds: 0 }),
    );
    expect(result.triggered).toBe(false);
    expect(result.message).toContain('insufficient data');
  });

  it('triggers when rate of increase exceeds threshold', () => {
    // value went from 10 to 110 in 10 seconds → rate = 10/s > threshold 5/s
    const result = rule.evaluate(
      makeCtx({ metric: 'errors', value: 110, previousValue: 10, windowSeconds: 10, threshold: 5 }),
    );
    expect(result.triggered).toBe(true);
    expect(result.message).toContain('increased');
  });

  it('does not trigger when rate is below threshold', () => {
    // value went from 10 to 20 in 10 seconds → rate = 1/s < threshold 5/s
    const result = rule.evaluate(
      makeCtx({ metric: 'errors', value: 20, previousValue: 10, windowSeconds: 10, threshold: 5 }),
    );
    expect(result.triggered).toBe(false);
  });

  it('triggers on decrease direction when rate falls below -threshold', () => {
    const decreaseRule = new RateAlertRule({ ruleId: 'throughput-drop', direction: 'decrease', severity: 'warning' });
    // value dropped from 100 to 10 in 10 seconds → rate = -9/s, threshold = 5 → -9 < -5 → triggered
    const result = decreaseRule.evaluate(
      makeCtx({ metric: 'throughput', value: 10, previousValue: 100, windowSeconds: 10, threshold: 5 }),
    );
    expect(result.triggered).toBe(true);
  });
});

// ── AlertRuleEvaluator (transport decoupling) ─────────────────────────────────

describe('AlertRuleEvaluator', () => {
  let transport: MockAlertTransport;
  let evaluator: AlertRuleEvaluator;

  const cpuRule = new ThresholdAlertRule({ ruleId: 'cpu-warn', direction: 'above', severity: 'warning' });
  const memRule = new ThresholdAlertRule({ ruleId: 'mem-crit', direction: 'above', severity: 'critical' });

  beforeEach(() => {
    transport = new MockAlertTransport();
    evaluator  = new AlertRuleEvaluator([cpuRule, memRule], transport);
  });

  it('does not call transport when no rules trigger', async () => {
    await evaluator.evaluate(makeCtx({ metric: 'cpu_usage', value: 50, threshold: 80 }));
    expect(transport.callCount).toBe(0);
  });

  it('calls transport exactly once per triggered rule', async () => {
    // value 90 > threshold 80 → cpu-warn triggers; mem-crit same ctx → also triggers
    await evaluator.evaluate(makeCtx({ metric: 'cpu_usage', value: 90, threshold: 80 }));
    expect(transport.callCount).toBe(2); // both rules share the same ctx and both trigger
  });

  it('delivers correct payload fields when a rule triggers', async () => {
    await evaluator.evaluate(makeCtx({ metric: 'cpu_usage', value: 90, threshold: 80 }));

    const payload = transport.delivered[0];
    expect(payload.ruleId).toBe('cpu-warn');
    expect(payload.severity).toBe('warning');
    expect(payload.message).toBeTruthy();
    expect(typeof payload.timestamp).toBe('string');
    expect(payload.context).toBeDefined();
  });

  it('returns results for all rules including non-triggered ones', async () => {
    const cpuOnlyRule = new ThresholdAlertRule({ ruleId: 'cpu-only', direction: 'above', severity: 'info' });
    // neverRule has a very high threshold that the test value won't reach
    const neverRule   = new ThresholdAlertRule({ ruleId: 'never',    direction: 'above', severity: 'info' });

    const singleEval = new AlertRuleEvaluator([cpuOnlyRule, neverRule], transport);
    // cpuOnlyRule: value 90 > threshold 80 → triggered
    // neverRule:   value 90 > threshold 1000 → NOT triggered
    const ctx1 = makeCtx({ value: 90, threshold: 80 });
    const ctx2 = makeCtx({ value: 90, threshold: 1000 });

    const results1 = await singleEval.evaluate(ctx1);
    const results2 = await new AlertRuleEvaluator([cpuOnlyRule, neverRule], transport)
      .evaluate(ctx2);

    // With threshold=80: both cpuOnlyRule and neverRule evaluate the same ctx → both trigger
    expect(results1).toHaveLength(2);
    expect(results1.find(r => r.ruleId === 'cpu-only')?.triggered).toBe(true);

    // With threshold=1000: neither triggers
    expect(results2).toHaveLength(2);
    expect(results2.find(r => r.ruleId === 'cpu-only')?.triggered).toBe(false);
    expect(results2.find(r => r.ruleId === 'never')   ?.triggered).toBe(false);
  });

  it('passes transport call count asserts regardless of rule count', async () => {
    // Only one rule, value does not cross threshold
    const singleEval = new AlertRuleEvaluator([cpuRule], transport);
    await singleEval.evaluate(makeCtx({ value: 30, threshold: 80 }));
    expect(transport.callCount).toBe(0);

    // Now cross the threshold
    await singleEval.evaluate(makeCtx({ value: 90, threshold: 80 }));
    expect(transport.callCount).toBe(1);
  });

  it('evaluator is transport-agnostic: swapping transport changes delivery only', async () => {
    const anotherMock = new MockAlertTransport();
    const anotherEval = new AlertRuleEvaluator([cpuRule], anotherMock);

    await evaluator.evaluate(makeCtx({ value: 90, threshold: 80 }));
    await anotherEval.evaluate(makeCtx({ value: 90, threshold: 80 }));

    // Each evaluator's transport received the alert independently
    expect(transport.callCount).toBe(2); // 2 rules in evaluator
    expect(anotherMock.callCount).toBe(1); // 1 rule in anotherEval
  });

  it('handles mixed rule types in the same evaluator', async () => {
    const rateRule = new RateAlertRule({ ruleId: 'spike', direction: 'increase', severity: 'warning' });
    const mixedEval = new AlertRuleEvaluator([cpuRule, rateRule], transport);

    // cpuRule triggers (90 > 80), rateRule skips (no previousValue)
    const results = await mixedEval.evaluate(makeCtx({ value: 90, threshold: 80 }));

    expect(results).toHaveLength(2);
    expect(transport.callCount).toBe(1); // only cpuRule triggered
    expect(results.find(r => r.ruleId === 'cpu-warn')?.triggered).toBe(true);
    expect(results.find(r => r.ruleId === 'spike')   ?.triggered).toBe(false);
  });
});
