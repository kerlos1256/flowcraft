import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMembership, createInvite, listInvites } from '@/lib/workspace/data';
import { membershipCan } from '@/lib/workspace/permissions';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import { logAudit } from '@/lib/workspace/audit';
import { sendWorkspaceInvite } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function activeMember(workspaceId: string, userId: string) {
  const m = await getMembership(workspaceId, userId);
  return m && m.status === 'active' ? m : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await listInvites(params.id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me || !membershipCan(me, 'member.invite')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; permissions?: unknown };
  try {
    const invite = await createInvite(params.id, s.sub, String(body.email ?? ''), body.permissions, me);
    await logAudit(params.id, me.displayName, 'invite.sent', invite.email);
    const ws = await prisma.workspace.findUnique({ where: { id: params.id }, select: { name: true } });
    const { sent } = await sendWorkspaceInvite({
      to: invite.email,
      workspaceName: ws?.name ?? 'the workspace',
      inviterName: me.displayName,
      link: invite.link,
    });
    return NextResponse.json({ id: invite.id, email: invite.email, link: invite.link, emailed: sent });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
