import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMembership } from '@/lib/workspace/data';
import { setActiveWorkspaceCookie } from '@/lib/workspace/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Set the active tenant: a workspace the user actively belongs to, or null = personal. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { workspaceId?: string | null };

  if (!body.workspaceId) {
    setActiveWorkspaceCookie(null);
    return NextResponse.json({ active: null });
  }
  const m = await getMembership(body.workspaceId, s.sub);
  if (!m || m.status !== 'active') return NextResponse.json({ error: 'not a member' }, { status: 403 });
  setActiveWorkspaceCookie(body.workspaceId);
  return NextResponse.json({ active: body.workspaceId });
}
