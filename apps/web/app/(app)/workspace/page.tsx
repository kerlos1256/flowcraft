import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getOwnedWorkspace,
  getMembership,
  listMembers,
  listInvites,
  listMyWorkspaces,
  listDeactivatedMemberships,
} from '@/lib/workspace/data';
import { availableSeats, listSeats, seatCount, ensureBaseSeats, BASE_SEATS, MAX_SEATS } from '@/lib/workspace/seats';
import { getWorkspaceUsage } from '@/lib/workspace/usage';
import { listAudit } from '@/lib/workspace/audit';
import { resolveTenant } from '@/lib/workspace/tenant';
import { WorkspaceManager } from '@/components/workspace/workspace-manager';
import type { WorkspaceDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const session = (await getSession())!;
  const [user, ownedWs, memberships, deactivated, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.sub }, select: { plan: true, name: true } }),
    getOwnedWorkspace(session.sub),
    listMyWorkspaces(session.sub),
    listDeactivatedMemberships(session.sub),
    resolveTenant(),
  ]);
  const activeId = tenant?.kind === 'workspace' ? tenant.workspaceId : null;

  let owned: WorkspaceDetail | null = null;
  if (ownedWs) {
    const me = await getMembership(ownedWs.id, session.sub);
    const members = await listMembers(ownedWs.id);
    const owner = members.find((m) => m.isOwner);
    if (owner) await ensureBaseSeats(ownedWs.id, owner.id);
    const [invites, seatsLeft, seatList, total, usage, audit] = await Promise.all([
      listInvites(ownedWs.id),
      availableSeats(ownedWs.id),
      listSeats(ownedWs.id),
      seatCount(ownedWs.id),
      getWorkspaceUsage(ownedWs.id),
      listAudit(ownedWs.id, 40),
    ]);
    if (me) {
      owned = {
        workspace: { id: ownedWs.id, name: ownedWs.name, status: ownedWs.status, ownerUserId: ownedWs.ownerUserId },
        me,
        members,
        invites,
        seats: { base: BASE_SEATS, available: seatsLeft, total, max: MAX_SEATS },
        seatList,
        usage,
        audit,
      };
    }
  }

  return (
    <WorkspaceManager
      plan={user?.plan ?? 'free'}
      userName={user?.name ?? 'You'}
      owned={owned}
      memberships={memberships}
      deactivated={deactivated}
      activeId={activeId}
    />
  );
}
