import { NextResponse } from 'next/server';
import { getWidgetPublic } from '@/lib/widget-data';
import { publicWidgetConfig } from '@/lib/widgets';
import { cors, corsPreflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public: the render config for the embed (secrets stripped). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const w = await getWidgetPublic(params.id);
  if (!w) return cors(NextResponse.json({ error: 'not found' }, { status: 404 }));
  return cors(NextResponse.json(publicWidgetConfig(w)));
}

export function OPTIONS() {
  return corsPreflight();
}
