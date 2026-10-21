/**
 * Circuit breaker unit tests — Issue #906
 *
 * Uses an injectable `now` function to control time without fake timers.
 * Written for vitest (the indexer's test runner).
 */

import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '@fund-my-cause/shared-utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNow(initialMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = initialMs;
  return {
    now:     () => t,
    advance: (ms) => { t += ms; },
  };
}

const successFn = () => Promise.resolve('ok');
const failFn = (msg = 'upstream error') => (): Promise<never> =>
  Promise.reject(new Error(msg));

// ── Initial state ─────────────────────────────────────────────────────────────

describe('CircuitBreaker — initial state', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.currentState).toBe('CLOSED');
  });

  it('starts with zero metrics', () => {
    const cb = new CircuitBreaker();
    const m  = cb.getMetrics();
    expect(m.totalCalls).toBe(0);
    expect(m.successfulCalls).toBe(0);
    expect(m.failedCalls).toBe(0);
    expect(m.circuitOpenRejections).toBe(0);
    expect(m.failureCount).toBe(0);
    expect(m.openedAt).toBeNull();
  });
});

// ── CLOSED behaviour ──────────────────────────────────────────────────────────

describe('CircuitBreaker — CLOSED state', () => {
  it('forwards successful calls', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.call(successFn);
    expect(result).toBe('ok');
  });

  it('increments successfulCalls on success', async () => {
    const cb = new CircuitBreaker();
    await cb.call(successFn);
    await cb.call(successFn);
    expect(cb.getMetrics().successfulCalls).toBe(2);
  });

  it('does not trip after fewer failures than threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    for (let i = 0; i < 4; i++) {
      await cb.call(failFn()).catch(() => {});
    }
    expect(cb.currentState).toBe('CLOSED');
  });

  it('trips to OPEN after failureThreshold consecutive failures', async () => {
    const clock = makeNow();
    const cb    = new CircuitBreaker({ failureThreshold: 3, now: clock.now });

    for (let i = 0; i < 3; i++) {
      await cb.call(failFn()).catch(() => {});
    }
    expect(cb.currentState).toBe('OPEN');
  });

  it('resets failureCount on a successful call', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    await cb.call(failFn()).catch(() => {});
    await cb.call(failFn()).catch(() => {});
    await cb.call(successFn);
    expect(cb.getMetrics().failureCount).toBe(0);
    expect(cb.currentState).toBe('CLOSED');
  });

  it('records failedCalls metric', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 10 });
    await cb.call(failFn()).catch(() => {});
    await cb.call(failFn()).catch(() => {});
    expect(cb.getMetrics().failedCalls).toBe(2);
  });
});

// ── OPEN behaviour ────────────────────────────────────────────────────────────

async function buildOpenBreaker(failureThreshold = 3) {
  const clock = makeNow();
  const cb    = new CircuitBreaker({ failureThreshold, cooldownMs: 30_000, now: clock.now });
  for (let i = 0; i < failureThreshold; i++) {
    await cb.call(failFn()).catch(() => {});
  }
  return { cb, clock };
}

describe('CircuitBreaker — OPEN state', () => {
  it('rejects calls with CircuitOpenError', async () => {
    const { cb } = await buildOpenBreaker();
    await expect(cb.call(successFn)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('does NOT invoke the wrapped function when OPEN', async () => {
    const { cb } = await buildOpenBreaker();
    const spy = vi.fn().mockResolvedValue('should-not-be-called');
    await cb.call(spy).catch(() => {});
    expect(spy).not.toHaveBeenCalled();
  });

  it('increments circuitOpenRejections', async () => {
    const { cb } = await buildOpenBreaker();
    await cb.call(successFn).catch(() => {});
    await cb.call(successFn).catch(() => {});
    expect(cb.getMetrics().circuitOpenRejections).toBe(2);
  });

  it('stays OPEN while cooldown has not elapsed', async () => {
    const { cb, clock } = await buildOpenBreaker();
    clock.advance(29_999);
    expect(cb.currentState).toBe('OPEN');
  });

  it('transitions to HALF_OPEN after cooldownMs elapses', async () => {
    const { cb, clock } = await buildOpenBreaker();
    clock.advance(30_000);
    expect(cb.currentState).toBe('HALF_OPEN');
  });
});

// ── HALF_OPEN behaviour ───────────────────────────────────────────────────────

async function buildHalfOpenBreaker() {
  const clock = makeNow();
  const cb    = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 10_000, now: clock.now });

  for (let i = 0; i < 3; i++) {
    await cb.call(failFn()).catch(() => {});
  }
  expect(cb.currentState).toBe('OPEN');
  clock.advance(10_001);
  expect(cb.currentState).toBe('HALF_OPEN');

  return { cb, clock };
}

describe('CircuitBreaker — HALF_OPEN state', () => {
  it('allows a trial call through', async () => {
    const { cb } = await buildHalfOpenBreaker();
    await expect(cb.call(successFn)).resolves.toBe('ok');
  });

  it('transitions to CLOSED after a successful trial', async () => {
    const { cb } = await buildHalfOpenBreaker();
    await cb.call(successFn);
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.getMetrics().failureCount).toBe(0);
  });

  it('transitions back to OPEN after a failed trial', async () => {
    const { cb } = await buildHalfOpenBreaker();
    await cb.call(failFn()).catch(() => {});
    expect(cb.currentState).toBe('OPEN');
  });

  it('resets the cooldown timer when the trial fails', async () => {
    const { cb, clock } = await buildHalfOpenBreaker();
    await cb.call(failFn()).catch(() => {});

    clock.advance(9_999);
    expect(cb.currentState).toBe('OPEN');

    clock.advance(2);
    expect(cb.currentState).toBe('HALF_OPEN');
  });
});

// ── Full outage simulation ────────────────────────────────────────────────────

describe('CircuitBreaker — sustained Horizon downtime simulation', () => {
  it('opens under sustained failure, then recovers when Horizon comes back', async () => {
    const clock = makeNow();
    const cb    = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 5_000, now: clock.now });

    // 1. Simulate 10 consecutive Horizon failures
    for (let i = 0; i < 10; i++) {
      await cb.call(failFn('horizon timeout')).catch(() => {});
    }
    expect(cb.currentState).toBe('OPEN');

    // 2. Calls during outage are immediately rejected
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(successFn)).rejects.toBeInstanceOf(CircuitOpenError);
    }
    expect(cb.getMetrics().circuitOpenRejections).toBe(12);

    // 3. Advance past cooldown → HALF_OPEN
    clock.advance(5_001);
    expect(cb.currentState).toBe('HALF_OPEN');

    // 4. Still down — trial fails → back to OPEN
    await cb.call(failFn('still down')).catch(() => {});
    expect(cb.currentState).toBe('OPEN');

    // 5. Advance past second cooldown
    clock.advance(5_001);
    expect(cb.currentState).toBe('HALF_OPEN');

    // 6. Horizon recovers — trial succeeds → CLOSED
    await cb.call(successFn);
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.getMetrics().failureCount).toBe(0);

    // 7. Normal operation resumes
    const result = await cb.call(successFn);
    expect(result).toBe('ok');
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('CircuitBreaker — reset()', () => {
  it('resets to CLOSED and zeroes all counters', async () => {
    const clock = makeNow();
    const cb    = new CircuitBreaker({ failureThreshold: 2, now: clock.now });

    await cb.call(failFn()).catch(() => {});
    await cb.call(failFn()).catch(() => {});
    expect(cb.currentState).toBe('OPEN');

    cb.reset();

    const m = cb.getMetrics();
    expect(m.state).toBe('CLOSED');
    expect(m.failureCount).toBe(0);
    expect(m.openedAt).toBeNull();
    expect(m.totalCalls).toBe(0);
    expect(m.successfulCalls).toBe(0);
    expect(m.failedCalls).toBe(0);
    expect(m.circuitOpenRejections).toBe(0);
  });
});

// ── getMetrics() ──────────────────────────────────────────────────────────────

describe('CircuitBreaker — getMetrics()', () => {
  it('reports openedAt timestamp when tripped', async () => {
    const clock = makeNow(1_000_000);
    const cb    = new CircuitBreaker({ failureThreshold: 1, now: clock.now });

    await cb.call(failFn()).catch(() => {});
    expect(cb.getMetrics().openedAt).toBe(1_000_000);
  });

  it('tracks totalCalls including OPEN rejections', async () => {
    const clock = makeNow();
    const cb    = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 5_000, now: clock.now });

    await cb.call(successFn);              // 1 total
    await cb.call(failFn()).catch(() => {}); // 2 total
    await cb.call(failFn()).catch(() => {}); // 3 total → OPEN
    await cb.call(successFn).catch(() => {}); // 4 total, rejection

    const m = cb.getMetrics();
    expect(m.totalCalls).toBe(4);
    expect(m.successfulCalls).toBe(1);
    expect(m.failedCalls).toBe(2);
    expect(m.circuitOpenRejections).toBe(1);
  });
});
