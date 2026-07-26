import { NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual "Run Now" — creates a run and fires the durable Inngest event. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { payload?: Record<string, unknown> };
  const run = await runWorkflow(params.id, 'manual', body.payload ?? {});
  return run ? NextResponse.json(run, { status: 202 }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
