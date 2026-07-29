import { NextResponse } from 'next/server';
import { createWorkflowFromTemplate } from '@/lib/data';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { limitErrorResponse } from '@/lib/api-errors';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fork a curated template into the current tenant (personal or workspace). */
export async function POST(req: Request) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  try {
    requirePermission(t, 'workflow.create');
    assertWritable(t);
    const wf = await createWorkflowFromTemplate(t, body.slug);
    return wf ? NextResponse.json(wf, { status: 201 }) : NextResponse.json({ error: 'unknown template' }, { status: 404 });
  } catch (e) {
    return limitErrorResponse(e) ?? workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
