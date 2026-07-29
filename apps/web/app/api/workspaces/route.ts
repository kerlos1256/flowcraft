import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createWorkspace, listMyWorkspaces } from '@/lib/workspace/data';
import { setActiveWorkspaceCookie } from '@/lib/workspace/tenant';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await listMyWorkspaces(s.sub));
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  try {
    const ws = await createWorkspace(s.sub, String(body.name ?? ''));
    setActiveWorkspaceCookie(ws.id); // switch into the new workspace immediately
    return NextResponse.json({ id: ws.id, name: ws.name });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
