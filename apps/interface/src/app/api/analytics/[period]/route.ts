/**
 * POST /api/analytics/[period] — Issue #676
 *
 * Trigger aggregation for a specific period (for scheduled job / admin use).
 * Returns the freshly computed rollup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAggregationJob, type RollupPeriod } from '@/lib/analytics/aggregation';

const VALID_PERIODS: RollupPeriod[] = ['hourly', 'daily', 'weekly', 'monthly'];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  const { period: rawPeriod } = await params;
  const period = rawPeriod as RollupPeriod;
  if (!VALID_PERIODS.includes(period)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PERIOD', message: `period must be one of: ${VALID_PERIODS.join(', ')}` } },
      { status: 400 },
    );
  }

  try {
    const rollup = await runAggregationJob(period);
    return NextResponse.json({ success: true, data: rollup, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[analytics/trigger] error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'AGGREGATION_ERROR', message: 'Aggregation failed' } },
      { status: 500 },
    );
  }
}
