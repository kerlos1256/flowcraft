import { NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/data';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { limitErrorResponse } from '@/lib/api-errors';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual "Run Now" — requires run access in the current tenant. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { payload?: Record<string, unknown> };
  try {
    requirePermission(t, 'workflow.run');
    assertWritable(t);
    const run = await runWorkflow(params.id, t, body.payload ?? {});
    return run ? NextResponse.json(run, { status: 202 }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return limitErrorResponse(e) ?? workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
