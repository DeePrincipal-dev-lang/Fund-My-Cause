/**
 * Unit tests for alert transport implementations.
 *
 * These tests exercise the Transport contract directly: every channel returns
 * DeliveryResult[] from send() and either delivers or reports a per-channel
 * failure without crashing the rest of the pipeline.
 */

import {
  AlertTransport,
  EmailAlertTransport,
  SlackAlertTransport,
  CompositeAlertTransport,
  type AlertPayload,
  type DeliveryResult,
} from '../alert-transport';

// ── Sample payload ────────────────────────────────────────────────────────────

const SAMPLE_PAYLOAD: AlertPayload = {
  ruleId:    'cpu-critical',
  severity:  'critical',
  message:   'CPU usage is 95 (above threshold 80)',
  context:   { metric: 'cpu_usage', value: 95, threshold: 80, service: 'api' },
  timestamp: '2026-07-29T15:00:00.000Z',
};

// ── EmailAlertTransport ───────────────────────────────────────────────────────

describe('EmailAlertTransport', () => {
  it('resolves without throwing for a valid payload', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });
    await expect(transport.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('returns a successful delivery result', async () => {
    const transport = new EmailAlertTransport({ to: 'ops@example.com' });

    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(results).toEqual([{ channel: 'email', success: true }]);
  });

  it('accepts a custom subject prefix', async () => {
    const transport = new EmailAlertTransport({
      to: 'ops@example.com',
      subjectPrefix: '[PROD]',
    });

    await expect(transport.send(SAMPLE_PAYLOAD)).resolves.toHaveLength(1);
  });
});

// ── SlackAlertTransport ───────────────────────────────────────────────────────

describe('SlackAlertTransport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves without throwing when no webhookUrl is set (simulated mode)', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });
    await expect(transport.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('returns a successful delivery result in simulated mode', async () => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });

    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(results).toEqual([{ channel: 'slack', success: true }]);
  });

  it.each([
    ['critical', 'critical'],
    ['warning', 'warning'],
    ['info', 'info'],
  ] as const)('accepts %s severity', async (_label, severity) => {
    const transport = new SlackAlertTransport({ channel: '#alerts' });

    const results = await transport.send({ ...SAMPLE_PAYLOAD, severity });

    expect(results[0]?.success).toBe(true);
  });

  it('uses fetch to POST when webhookUrl is provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const transport = new SlackAlertTransport({
      channel:    '#alerts',
      webhookUrl: 'https://hooks.slack.com/services/T000/B000/test',
    });
    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.slack.com/services/T000/B000/test');
    expect(opts.method).toBe('POST');
    expect(results).toEqual([
      { channel: 'slack', success: true, statusCode: 200, error: undefined },
    ]);
  });

  it('reports a failure when webhookUrl returns a non-ok response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    global.fetch = mockFetch as unknown as typeof fetch;

    const transport = new SlackAlertTransport({
      channel:    '#alerts',
      webhookUrl: 'https://hooks.slack.com/services/bad',
    });

    const results = await transport.send(SAMPLE_PAYLOAD);
    expect(results[0]).toMatchObject({
      channel: 'slack',
      success: false,
      statusCode: 500,
    });
    await expect(transport.deliver(SAMPLE_PAYLOAD)).rejects.toThrow('HTTP 500');
  });
});

// ── AlertTransport webhook ────────────────────────────────────────────────────

describe('AlertTransport', () => {
  it('returns DeliveryResult[] from send()', async () => {
    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'https://example.com/alerts' }],
    });
    const post = jest
      .spyOn((transport as unknown as { http: { post: jest.Mock } }).http, 'post')
      .mockResolvedValue({ status: 202 });

    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(post).toHaveBeenCalledWith(
      'https://example.com/alerts',
      SAMPLE_PAYLOAD,
      { headers: {} },
    );
    expect(results).toEqual([
      { channel: 'webhook', success: true, statusCode: 202 },
    ]);
  });

  it('captures per-channel errors without crashing the pipeline', async () => {
    const transport = new AlertTransport({
      channels: [{ type: 'webhook', url: 'https://example.com/alerts' }],
    });
    jest
      .spyOn((transport as unknown as { http: { post: jest.Mock } }).http, 'post')
      .mockRejectedValue(new Error('Network unreachable'));

    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(results).toEqual([
      {
        channel: 'webhook',
        success: false,
        error: 'Network unreachable',
      },
    ]);
  });

  it('delivers to multiple channels independently', async () => {
    const transport = new AlertTransport({
      channels: [
        { type: 'webhook', url: 'https://example.com/alerts' },
        { type: 'slack', webhookUrl: 'https://hooks.slack.com/services/test' },
      ],
    });
    const http = (transport as unknown as { http: { post: jest.Mock } }).http;
    http.post = jest
      .fn()
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error('Slack down'));

    const results = await transport.send(SAMPLE_PAYLOAD);

    expect(results).toEqual([
      { channel: 'webhook', success: true, statusCode: 200 },
      { channel: 'slack', success: false, error: 'Slack down' },
    ]);
  });
});

// ── CompositeAlertTransport ───────────────────────────────────────────────────

class CaptureTransport {
  readonly received: AlertPayload[] = [];
  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    this.received.push(payload);
    return [{ channel: 'capture', success: true }];
  }
}

class FailingTransport {
  async send(_payload: AlertPayload): Promise<never> {
    throw new Error('Simulated transport failure');
  }
}

describe('CompositeAlertTransport', () => {
  it('throws when constructed with an empty transports array', () => {
    expect(() => new CompositeAlertTransport([])).toThrow();
  });

  it('fans out to all transports', async () => {
    const t1 = new CaptureTransport();
    const t2 = new CaptureTransport();
    const composite = new CompositeAlertTransport([t1, t2]);

    await composite.deliver(SAMPLE_PAYLOAD);

    expect(t1.received).toHaveLength(1);
    expect(t2.received).toHaveLength(1);
    expect(t1.received[0]).toEqual(SAMPLE_PAYLOAD);
    expect(t2.received[0]).toEqual(SAMPLE_PAYLOAD);
  });

  it('delivers to healthy transports even when one fails', async () => {
    const good    = new CaptureTransport();
    const failing = new FailingTransport();
    const composite = new CompositeAlertTransport([failing, good]);

    const results = await composite.send(SAMPLE_PAYLOAD);

    expect(good.received).toHaveLength(1);
    expect(results).toEqual([
      {
        channel: 'unknown',
        success: false,
        error: 'Simulated transport failure',
      },
      { channel: 'capture', success: true },
    ]);
  });

  it('reports failure details when a transport errors', async () => {
    const composite = new CompositeAlertTransport([new FailingTransport()]);
    const results = await composite.send(SAMPLE_PAYLOAD);

    expect(results).toEqual([
      {
        channel: 'unknown',
        success: false,
        error: 'Simulated transport failure',
      },
    ]);
  });

  it('resolves even if all transports fail', async () => {
    const composite = new CompositeAlertTransport([new FailingTransport(), new FailingTransport()]);
    await expect(composite.deliver(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it('delivers identical payload object to each transport', async () => {
    const t1 = new CaptureTransport();
    const t2 = new CaptureTransport();
    const composite = new CompositeAlertTransport([t1, t2]);

    await composite.deliver(SAMPLE_PAYLOAD);

    expect(t1.received[0]).toEqual(t2.received[0]);
  });
});
