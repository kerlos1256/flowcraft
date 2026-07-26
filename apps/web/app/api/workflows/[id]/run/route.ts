import { NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { limitErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual "Run Now" — owner only. Fires the durable Inngest event. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { payload?: Record<string, unknown> };
  try {
    const run = await runWorkflow(params.id, s.sub, body.payload ?? {});
    return run ? NextResponse.json(run, { status: 202 }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return limitErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
