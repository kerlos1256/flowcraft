// ─────────────────────────────────────────────────────────────────────────────
// Flowcraft — SINGLE SOURCE OF TRUTH for app metadata + theme.
//
// Identity, node-category colors, run-status colors, and every design token live
// here and are emitted as CSS variables by buildThemeStylesheet() (injected once
// in the root layout). Tailwind + components reference the vars — never hardcode
// a hex or size inline. Change a value here and it propagates everywhere.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeCategory, StepStatus, RunStatus } from '@flowcraft/shared-types';

export const appConfig = {
  name: 'Flowcraft',
  description: 'Visual workflow builder with durable execution.',
  tagline: 'Draw it. Run it. Durably.',
  logoGlyph: '🧩',
} as const;

interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  fg: string;
  muted: string;
  primary: string;
  primaryFg: string;
  accent: string;
}

const light: Palette = {
  bg: '#f7f8fb',
  surface: '#ffffff',
  surfaceMuted: '#f0f2f7',
  border: '#e2e6ee',
  fg: '#0f1729',
  muted: '#697089',
  primary: '#6d28d9',
  primaryFg: '#ffffff',
  accent: '#0ea5e9',
};

const dark: Palette = {
  bg: '#0b0e17',
  surface: '#131826',
  surfaceMuted: '#1b2233',
  border: '#293141',
  fg: '#e6e9f2',
  muted: '#8b93a7',
  primary: '#8b5cf6',
  primaryFg: '#0b0e17',
  accent: '#38bdf8',
};

/** Node category → accent color (palette chips + canvas node headers). */
export const categoryColor: Record<NodeCategory, string> = {
  trigger: '#10b981',
  action: '#3b82f6',
  delay: '#f59e0b',
  condition: '#a855f7',
};

/** Run-step status → color (run history timeline + node highlight). */
export const stepStatusColor: Record<StepStatus, string> = {
  pending: '#f59e0b',
  succeeded: '#10b981',
  failed: '#ef4444',
  skipped: '#94a3b8',
};

export const runStatusColor: Record<RunStatus, string> = {
  running: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
};

export const tokens = {
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  shadowSm: '0 1px 2px 0 rgb(2 6 23 / 0.06)',
  shadowMd: '0 8px 24px -8px rgb(2 6 23 / 0.30)',
  fontSans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontMono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

function vars(p: Palette): Record<string, string> {
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--surface-muted': p.surfaceMuted,
    '--border': p.border,
    '--fg': p.fg,
    '--muted': p.muted,
    '--primary': p.primary,
    '--primary-fg': p.primaryFg,
    '--accent': p.accent,
  };
}

function shared(): Record<string, string> {
  return {
    '--radius-sm': tokens.radiusSm,
    '--radius-md': tokens.radiusMd,
    '--radius-lg': tokens.radiusLg,
    '--shadow-sm': tokens.shadowSm,
    '--shadow-md': tokens.shadowMd,
    '--font-sans': tokens.fontSans,
    '--font-mono': tokens.fontMono,
    '--cat-trigger': categoryColor.trigger,
    '--cat-action': categoryColor.action,
    '--cat-delay': categoryColor.delay,
    '--cat-condition': categoryColor.condition,
  };
}

const toBlock = (sel: string, v: Record<string, string>) =>
  `${sel}{${Object.entries(v)
    .map(([k, val]) => `${k}:${val};`)
    .join('')}}`;

/** Theme stylesheet injected once in the layout. Light is the default; `.dark` flips it. */
export function buildThemeStylesheet(): string {
  return [
    toBlock(':root', { ...shared(), ...vars(light) }),
    toBlock(':root.dark', vars(dark)),
  ].join('\n');
}
