'use client';

import { logout } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export function UserMenu({ name, email }: { name: string; email: string }) {
  async function signOut() {
    await logout();
    window.location.href = '/';
  }
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-xs font-medium leading-tight">{name}</div>
        <div className="text-[11px] leading-tight text-muted">{email}</div>
      </div>
      <ThemeToggle />
      <button
        onClick={signOut}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface-muted"
      >
        Sign out
      </button>
    </div>
  );
}
