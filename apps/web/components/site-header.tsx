import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { ThemeToggle } from '@/components/theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">{appConfig.logoGlyph}</span>
          {appConfig.name}
        </Link>
        <span className="hidden text-sm text-muted sm:inline">— {appConfig.tagline}</span>
        <nav className="ml-auto flex items-center gap-3">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            Workflows
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
