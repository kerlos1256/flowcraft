import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMembership, updateMemberPermissions, removeMember } from '@/lib/workspace/data';
import { membershipCan } from '@/lib/workspace/permissions';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import { logAudit } from '@/lib/workspace/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function activeMember(workspaceId: string, userId: string) {
  const m = await getMembership(workspaceId, userId);
  return m && m.status === 'active' ? m : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string; mid: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me || !membershipCan(me, 'member.manage_permissions'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { permissions?: unknown };
  try {
    const updated = await updateMemberPermissions(params.id, params.mid, body.permissions, me);
    await logAudit(params.id, me.displayName, 'permissions.changed', updated.displayName);
    return NextResponse.json({ id: updated.id, permissions: updated.permissions });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; mid: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me || !membershipCan(me, 'member.remove')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const removedName = await removeMember(params.id, params.mid);
    await logAudit(params.id, me.displayName, 'member.removed', removedName);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
