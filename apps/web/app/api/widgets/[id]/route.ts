import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWidget, updateWidget, deleteWidget } from '@/lib/widget-data';
import type { WidgetConfig, WidgetPlacement } from '@/lib/widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const w = await getWidget(params.id, s.sub);
  return w ? NextResponse.json(w) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    placement?: WidgetPlacement;
    config?: WidgetConfig;
    workflowId?: string;
  };
  const w = await updateWidget(params.id, s.sub, body);
  return w ? NextResponse.json(w) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const okDel = await deleteWidget(params.id, s.sub);
  return new NextResponse(null, { status: okDel ? 204 : 404 });
}
