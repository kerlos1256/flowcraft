import { NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { limitErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await listWorkflows(s.sub));
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled workflow';
  try {
    return NextResponse.json(await createWorkflow(s.sub, name), { status: 201 });
  } catch (e) {
    return limitErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
