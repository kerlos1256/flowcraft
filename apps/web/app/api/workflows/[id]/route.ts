import { NextResponse } from 'next/server';
import type { FlowGraph, WorkflowStatus } from '@flowcraft/shared-types';
import { getWorkflow, updateWorkflow, deleteWorkflow } from '@/lib/data';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const wf = await getWorkflow(params.id, s.sub);
  return wf ? NextResponse.json(wf) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    graph?: FlowGraph;
    status?: WorkflowStatus;
  };
  const wf = await updateWorkflow(params.id, s.sub, body);
  return wf ? NextResponse.json(wf) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ok = await deleteWorkflow(params.id, s.sub);
  return new NextResponse(null, { status: ok ? 204 : 404 });
}
