/**
 * GET /api/search — Issue #674
 *
 * Full-text search endpoint with ranking and typo tolerance.
 *
 * Query params:
 *   q        - search query (required)
 *   category - filter by category
 *   status   - filter by status
 *   page     - page number (default: 1)
 *   pageSize - results per page (default: 20, max: 100)
 *
 * @example GET /api/search?q=solar&category=environment&page=1&pageSize=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchCampaigns } from '@/services/search.service';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);

  if (!q.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_QUERY', message: 'q parameter is required' } },
      { status: 400 },
    );
  }

  try {
    const result = await searchCampaigns({ query: q, category, status, page, pageSize });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[search] error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: 'Search failed' } },
      { status: 500 },
    );
  }
}
