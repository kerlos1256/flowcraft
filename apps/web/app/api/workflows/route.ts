import { NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/data';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { limitErrorResponse } from '@/lib/api-errors';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await listWorkflows(t));
}

export async function POST(req: Request) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled workflow';
  try {
    requirePermission(t, 'workflow.create');
    assertWritable(t);
    return NextResponse.json(await createWorkflow(t, name), { status: 201 });
  } catch (e) {
    return limitErrorResponse(e) ?? workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
