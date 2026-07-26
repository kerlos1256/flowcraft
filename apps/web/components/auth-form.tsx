'use client';

import { useState } from 'react';
import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { login, signup } from '@/lib/api';

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) await signup(email, name, password);
      else await login(email, password);
      const next = new URLSearchParams(window.location.search).get('next') || '/app';
      window.location.href = next; // full nav so the session cookie is applied
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
        <span className="text-2xl">{appConfig.logoGlyph}</span> {appConfig.name}
      </Link>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
        <h1 className="text-xl font-semibold">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-1 text-sm text-muted">
          {isSignup ? 'Start building workflows in seconds.' : 'Sign in to your workflows.'}
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          {isSignup && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Name
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                required
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Email
            <input
              className={inputCls}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Password
            <input
              className={inputCls}
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
              required
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
