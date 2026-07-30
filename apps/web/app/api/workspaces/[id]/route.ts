import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMembership, listMembers, listInvites, renameWorkspace, deleteWorkspace } from '@/lib/workspace/data';
import { availableSeats, listSeats, seatCount, ensureBaseSeats, BASE_SEATS, MAX_SEATS } from '@/lib/workspace/seats';
import { getWorkspaceUsage } from '@/lib/workspace/usage';
import { membershipCan } from '@/lib/workspace/permissions';
import { setActiveWorkspaceCookie } from '@/lib/workspace/tenant';
import { workspaceErrorResponse } from '@/lib/workspace/http';

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
  if (!me) return NextResponse.json({ error: 'not a member' }, { status: 403 });

  const ws = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, status: true, ownerUserId: true },
  });
  if (!ws) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const members = await listMembers(params.id);
  const owner = members.find((m) => m.isOwner);
  if (owner) await ensureBaseSeats(params.id, owner.id); // backfill for pre-seat workspaces

  const [invites, seatsLeft, seatList, total, usage] = await Promise.all([
    listInvites(params.id),
    availableSeats(params.id),
    listSeats(params.id),
    seatCount(params.id),
    getWorkspaceUsage(params.id),
  ]);
  return NextResponse.json({
    workspace: ws,
    me,
    members,
    invites,
    seats: { base: BASE_SEATS, available: seatsLeft, total, max: MAX_SEATS },
    seatList,
    usage,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me || !membershipCan(me, 'workspace.manage')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  try {
    const ws = await renameWorkspace(params.id, String(body.name ?? ''));
    return NextResponse.json({ id: ws.id, name: ws.name });
  } catch (e) {
    return workspaceErrorResponse(e) ?? NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await activeMember(params.id, s.sub);
  if (!me || !me.isOwner) return NextResponse.json({ error: 'only the owner can delete the workspace' }, { status: 403 });
  await deleteWorkspace(params.id);
  setActiveWorkspaceCookie(null);
  return new NextResponse(null, { status: 204 });
}
