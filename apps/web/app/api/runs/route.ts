import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/data';
import { resolveTenant } from '@/lib/workspace/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const workflowId = new URL(req.url).searchParams.get('workflowId') ?? undefined;
  return NextResponse.json(await listRuns(t, workflowId));
}
