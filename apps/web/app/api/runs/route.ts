import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/data';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const workflowId = new URL(req.url).searchParams.get('workflowId') ?? undefined;
  return NextResponse.json(await listRuns(s.sub, workflowId));
}
