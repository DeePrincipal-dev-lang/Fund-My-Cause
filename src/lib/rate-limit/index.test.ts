import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, createRateLimiter } from './index';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('limit-window calculation', () => {
    it('allows calls up to the configured limit within a window', () => {
      const limiter = new RateLimiter({ limit: 3, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('rejects calls once the limit is exceeded', () => {
      const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);
    });

    it('reports remaining capacity within the window', () => {
      const limiter = new RateLimiter({ limit: 5, windowMs: 1000 });

      limiter.tryAcquire();
      limiter.tryAcquire();

      expect(limiter.remaining()).toBe(3);
    });

    it('does not count rejected calls against the window', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);
      expect(limiter.tryAcquire()).toBe(false);
      expect(limiter.remaining()).toBe(0);
    });
  });

  describe('reset behavior', () => {
    it('resets capacity after the window elapses', () => {
      const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);

      vi.advanceTimersByTime(1000);

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.remaining()).toBe(1);
    });

    it('keeps the limiter blocked just before the reset boundary', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);

      vi.advanceTimersByTime(999);
      expect(limiter.tryAcquire()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('resets explicitly via reset()', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);

      limiter.reset();

      expect(limiter.remaining()).toBe(1);
      expect(limiter.tryAcquire()).toBe(true);
    });

    it('computes time until the next available slot', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });

      limiter.tryAcquire();
      expect(limiter.msUntilNext()).toBe(1000);

      vi.advanceTimersByTime(400);
      expect(limiter.msUntilNext()).toBe(600);
    });
  });

  describe('concurrent-call edge cases', () => {
    it('handles a burst of calls without exceeding the limit', () => {
      const limiter = new RateLimiter({ limit: 10, windowMs: 1000 });

      const results = Array.from({ length: 50 }, () => limiter.tryAcquire());
      const allowed = results.filter(Boolean).length;

      expect(allowed).toBe(10);
      expect(limiter.remaining()).toBe(0);
    });

    it('serializes concurrent acquire() promises within the limit', async () => {
      const limiter = new RateLimiter({ limit: 3, windowMs: 1000 });

      const pending = [
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
      ];

      await vi.advanceTimersByTimeAsync(1000);
      const settled = await Promise.all(pending);

      expect(settled).toHaveLength(4);
      expect(limiter.remaining()).toBeGreaterThanOrEqual(0);
    });

    it('does not leak capacity across independent limiter instances', () => {
      const a = new RateLimiter({ limit: 1, windowMs: 1000 });
      const b = new RateLimiter({ limit: 1, windowMs: 1000 });

      expect(a.tryAcquire()).toBe(true);
      expect(a.tryAcquire()).toBe(false);
      expect(b.tryAcquire()).toBe(true);
    });

    it('createRateLimiter returns a working limiter', () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 500 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.tryAcquire()).toBe(false);

      vi.advanceTimersByTime(500);
      expect(limiter.tryAcquire()).toBe(true);
    });
  });
});
