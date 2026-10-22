import type { AlertPayload } from '../alert-transport';
import { NotifierTransport } from '../notifier';
import { PagerDutyIntegration, PagerDutyTransport } from '../pagerduty-integration';

const ALERT: AlertPayload = {
  ruleId: 'cpu-critical',
  severity: 'critical',
  message: 'CPU usage is 95%',
  context: { service: 'api', environment: 'production' },
  timestamp: '2026-10-21T10:00:00.000Z',
};

describe('Transport contract', () => {
  it('delivers through the generic notifier', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const transport = new NotifierTransport('email', handler);

    const results = await transport.send(ALERT);

    expect(handler).toHaveBeenCalledWith(ALERT);
    expect(results).toEqual([{ channel: 'email', success: true }]);
  });

  it('captures generic notifier failures without throwing', async () => {
    const transport = new NotifierTransport('email', async () => {
      throw new Error('smtp unavailable');
    });

    const results = await transport.send(ALERT);

    expect(results).toEqual([
      { channel: 'email', success: false, error: 'smtp unavailable' },
    ]);
  });

  it('delivers through PagerDuty', async () => {
    const createIncident = jest.fn().mockResolvedValue({ id: 'PD-1' });
    const integration = { createIncident } as unknown as PagerDutyIntegration;
    const transport = new PagerDutyTransport({
      integration,
      serviceId: 'service-1',
    });

    const results = await transport.send(ALERT);

    expect(createIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        description: ALERT.message,
        severity: 'critical',
        service_id: 'service-1',
      }),
    );
    expect(results).toEqual([{ channel: 'pagerduty', success: true }]);
  });

  it('captures PagerDuty failures without throwing', async () => {
    const integration = {
      createIncident: jest.fn().mockRejectedValue(new Error('unauthorized')),
    } as unknown as PagerDutyIntegration;
    const transport = new PagerDutyTransport({
      integration,
      serviceId: 'service-1',
    });

    const results = await transport.send(ALERT);

    expect(results).toEqual([
      { channel: 'pagerduty', success: false, error: 'unauthorized' },
    ]);
  });
});
