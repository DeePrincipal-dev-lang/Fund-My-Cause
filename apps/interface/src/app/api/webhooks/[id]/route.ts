/**
 * GET    /api/webhooks/[id]/log       — Delivery log
 * GET    /api/webhooks/[id]/dlq       — Dead-letter queue
 * PATCH  /api/webhooks/[id]           — Update webhook
 * DELETE /api/webhooks/[id]           — Delete webhook
 * POST   /api/webhooks/[id]/rotate    — Rotate signing secret
 *
 * Issue #677
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  updateWebhook,
  deleteWebhook,
  getDeliveryLog,
  getDeadLetterQueue,
  rotateSecret,
  type WebhookEventType,
} from '@/lib/webhooks/webhook.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = req.headers.get('x-wallet-address');
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pathname } = req.nextUrl;
  const isDlq = pathname.endsWith('/dlq');
  const isLog = pathname.endsWith('/log');

  try {
    if (isDlq) {
      const dlq = getDeadLetterQueue(id, ownerId);
      return NextResponse.json({ success: true, data: dlq });
    }
    if (isLog) {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
      const log = getDeliveryLog(id, ownerId, limit);
      return NextResponse.json({ success: true, data: log });
    }
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: String(err) } }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = req.headers.get('x-wallet-address');
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pathname } = req.nextUrl;
  if (pathname.endsWith('/rotate')) {
    try {
      const newSecret = rotateSecret(id, ownerId);
      return NextResponse.json({ success: true, data: { secret: newSecret } });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  }

  const updates = await req.json() as { url?: string; events?: WebhookEventType[]; active?: boolean };
  try {
    const updated = updateWebhook(id, ownerId, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = _req.headers.get('x-wallet-address');
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    deleteWebhook(id, ownerId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
