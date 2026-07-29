import { NextResponse } from 'next/server';
import { resolveTenant, requirePermission, assertWritable } from '@/lib/workspace/tenant';
import { listWidgets, createWidget } from '@/lib/widget-data';
import { limitErrorResponse } from '@/lib/api-errors';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import type { WidgetPlacement } from '@/lib/widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await listWidgets(t));
}

export async function POST(req: Request) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    type?: string;
    workflowId?: string;
    placement?: WidgetPlacement;
  };
  if (!body.name || !body.type || !body.workflowId) {
    return NextResponse.json({ error: 'name, type and workflowId are required' }, { status: 400 });
  }
  try {
    requirePermission(t, 'widget.create');
    assertWritable(t);
    const w = await createWidget(t, {
      name: body.name.trim(),
      type: body.type,
      workflowId: body.workflowId,
      placement: body.placement,
    });
    return w
      ? NextResponse.json(w, { status: 201 })
      : NextResponse.json({ error: 'Invalid type or workflow.' }, { status: 400 });
  } catch (e) {
    return limitErrorResponse(e) ?? workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
