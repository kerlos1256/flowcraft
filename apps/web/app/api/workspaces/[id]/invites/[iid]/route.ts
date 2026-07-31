import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMembership, revokeInvite } from '@/lib/workspace/data';
import { membershipCan } from '@/lib/workspace/permissions';
import { logAudit } from '@/lib/workspace/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string; iid: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !membershipCan(me, 'member.invite'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await revokeInvite(params.id, params.iid);
  await logAudit(params.id, me.displayName, 'invite.revoked');
  return new NextResponse(null, { status: 204 });
}
