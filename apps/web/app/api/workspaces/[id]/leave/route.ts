import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { leaveWorkspace } from '@/lib/workspace/data';
import { setActiveWorkspaceCookie } from '@/lib/workspace/tenant';
import { workspaceErrorResponse } from '@/lib/workspace/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await leaveWorkspace(params.id, s.sub);
    setActiveWorkspaceCookie(null);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
