import { NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Webhook trigger — same durable execution, external entry point. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const run = await runWorkflow(params.id, 'webhook', body ?? {});
  return run ? NextResponse.json(run, { status: 202 }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
