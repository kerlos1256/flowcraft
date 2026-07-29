import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getOwnedWorkspace,
  getMembership,
  listMembers,
  listInvites,
  availableSeats,
  listMyWorkspaces,
  BASE_SEATS,
} from '@/lib/workspace/data';
import { resolveTenant } from '@/lib/workspace/tenant';
import { WorkspaceManager } from '@/components/workspace/workspace-manager';
import type { WorkspaceDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const session = (await getSession())!;
  const [user, ownedWs, memberships, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.sub }, select: { plan: true, name: true } }),
    getOwnedWorkspace(session.sub),
    listMyWorkspaces(session.sub),
    resolveTenant(),
  ]);
  const activeId = tenant?.kind === 'workspace' ? tenant.workspaceId : null;

  let owned: WorkspaceDetail | null = null;
  if (ownedWs) {
    const [me, members, invites, seatsLeft] = await Promise.all([
      getMembership(ownedWs.id, session.sub),
      listMembers(ownedWs.id),
      listInvites(ownedWs.id),
      availableSeats(ownedWs.id),
    ]);
    if (me) {
      owned = {
        workspace: { id: ownedWs.id, name: ownedWs.name, status: ownedWs.status, ownerUserId: ownedWs.ownerUserId },
        me,
        members,
        invites,
        seats: { base: BASE_SEATS, available: seatsLeft },
      };
    }
  }

  return (
    <WorkspaceManager
      plan={user?.plan ?? 'free'}
      userName={user?.name ?? 'You'}
      owned={owned}
      memberships={memberships}
      activeId={activeId}
    />
  );
}
