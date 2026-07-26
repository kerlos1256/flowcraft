import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const workflowId = new URL(req.url).searchParams.get('workflowId') ?? undefined;
  return NextResponse.json(await listRuns(workflowId));
}
