import Link from 'next/link';
import { redirect } from 'next/navigation';
import { appConfig } from '@/config/app.config';
import { getSession } from '@/lib/auth';
import { UserMenu } from '@/components/user-menu';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-5">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="text-lg">{appConfig.logoGlyph}</span>
            {appConfig.name}
          </Link>
          <nav className="ml-6 hidden sm:flex">
            <Link href="/app" className="text-sm text-muted hover:text-foreground">
              Workflows
            </Link>
          </nav>
          <div className="ml-auto">
            <UserMenu name={session.name} email={session.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-5 py-6">{children}</main>
    </>
  );
}
