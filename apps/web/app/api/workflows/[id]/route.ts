import { NextResponse } from 'next/server';
import type { FlowGraph, WorkflowStatus } from '@flowcraft/shared-types';
import { getWorkflow, updateWorkflow, deleteWorkflow } from '@/lib/data';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { limitErrorResponse } from '@/lib/api-errors';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const wf = await getWorkflow(params.id, t);
  return wf ? NextResponse.json(wf) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    graph?: FlowGraph;
    status?: WorkflowStatus;
  };
  try {
    requirePermission(t, 'workflow.edit');
    if (body.status === 'active') requirePermission(t, 'workflow.activate');
    assertWritable(t);
    const wf = await updateWorkflow(params.id, t, body);
    return wf ? NextResponse.json(wf) : NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return limitErrorResponse(e) ?? workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requirePermission(t, 'workflow.delete');
    assertWritable(t);
    const ok = await deleteWorkflow(params.id, t);
    return new NextResponse(null, { status: ok ? 204 : 404 });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
