import Link from 'next/link';
import { redirect } from 'next/navigation';
import { appConfig } from '@/config/app.config';
import { getSession } from '@/lib/auth';
import { listMyWorkspaces } from '@/lib/workspace/data';
import { resolveTenant } from '@/lib/workspace/tenant';
import { UserMenu } from '@/components/user-menu';
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [workspaces, tenant] = await Promise.all([listMyWorkspaces(session.sub), resolveTenant()]);
  const activeId = tenant?.kind === 'workspace' ? tenant.workspaceId : null;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-5">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="text-lg">{appConfig.logoGlyph}</span>
            {appConfig.name}
          </Link>
          <nav className="ml-6 hidden items-center gap-4 sm:flex">
            <Link href="/app" className="text-sm text-muted hover:text-foreground">
              Workflows
            </Link>
            <Link href="/widgets" className="text-sm text-muted hover:text-foreground">
              Widgets
            </Link>
            <Link href="/workspace" className="text-sm text-muted hover:text-foreground">
              Workspace
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />
            <UserMenu name={session.name} email={session.email} />
          </div>
        </div>
      </header>
      {tenant?.kind === 'workspace' && tenant.workspaceStatus !== 'active' && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          ⚠ <b>{tenant.workspaceName}</b> is read-only — its subscription needs attention. The owner can fix billing to
          restore editing.
        </div>
      )}
      <main className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</main>
    </>
  );
}
