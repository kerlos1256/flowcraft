import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMembership, transferOwnership } from '@/lib/workspace/data';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import { logAudit } from '@/lib/workspace/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Transfer workspace ownership to another active member. Owner-only. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !me.isOwner) {
    return NextResponse.json({ error: 'only the owner can transfer ownership' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { membershipId?: string };
  if (!body.membershipId) return NextResponse.json({ error: 'membershipId required' }, { status: 400 });
  try {
    const newOwner = await transferOwnership(params.id, body.membershipId);
    await logAudit(params.id, me.displayName, 'ownership.transferred', newOwner);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
