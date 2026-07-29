import { NextResponse } from 'next/server';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { getWidget, updateWidget, deleteWidget } from '@/lib/widget-data';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import type { WidgetConfig, WidgetPlacement } from '@/lib/widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const w = await getWidget(params.id, t);
  return w ? NextResponse.json(w) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    placement?: WidgetPlacement;
    config?: WidgetConfig;
    workflowId?: string;
  };
  try {
    requirePermission(t, 'widget.edit');
    assertWritable(t);
    const w = await updateWidget(params.id, t, body);
    return w ? NextResponse.json(w) : NextResponse.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requirePermission(t, 'widget.delete');
    assertWritable(t);
    const okDel = await deleteWidget(params.id, t);
    return new NextResponse(null, { status: okDel ? 204 : 404 });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
