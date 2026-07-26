import { NextResponse } from 'next/server';
import { runWorkflowByWebhook } from '@/lib/data';
import { limitErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public webhook trigger — external systems call this with the workflow id.
 * No session (the caller isn't the owner); the id acts as the capability.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const run = await runWorkflowByWebhook(params.id, body ?? {});
    return run ? NextResponse.json(run, { status: 202 }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return limitErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
