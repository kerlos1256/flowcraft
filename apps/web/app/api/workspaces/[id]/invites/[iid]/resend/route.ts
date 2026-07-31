import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMembership, resendInvite } from '@/lib/workspace/data';
import { membershipCan } from '@/lib/workspace/permissions';
import { logAudit } from '@/lib/workspace/audit';
import { sendWorkspaceInvite } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string; iid: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !membershipCan(me, 'member.invite')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const res = await resendInvite(params.id, params.iid);
  if (!res) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await logAudit(params.id, me.displayName, 'invite.resent', res.email);

  const ws = await prisma.workspace.findUnique({ where: { id: params.id }, select: { name: true } });
  const { sent } = await sendWorkspaceInvite({
    to: res.email,
    workspaceName: ws?.name ?? 'the workspace',
    inviterName: me.displayName,
    link: res.link,
  });
  return NextResponse.json({ link: res.link, emailed: sent });
}
