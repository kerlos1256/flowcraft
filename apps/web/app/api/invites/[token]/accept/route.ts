import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { acceptInvite } from '@/lib/workspace/data';
import { setActiveWorkspaceCookie } from '@/lib/workspace/tenant';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { displayName?: string };
  try {
    const workspaceId = await acceptInvite(params.token, s.sub, String(body.displayName ?? ''));
    setActiveWorkspaceCookie(workspaceId); // drop the member straight into the workspace
    return NextResponse.json({ workspaceId });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
