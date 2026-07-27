import { createHash } from 'crypto';
import { prisma } from './prisma';

// Layered abuse protection for the public widget submit endpoint.
// Honeypot + min-submit-time are checked in the route (they read the body);
// this module handles IP hashing, rate limiting, origin allowlist, Turnstile.

const RATE_PER_IP_PER_MIN = 5; // per widget, per IP
const RATE_PER_WIDGET_PER_MIN = 60; // burst cap per widget
const MIN_SUBMIT_MS = 800; // faster than this = almost certainly a bot
const MAX_PAYLOAD_BYTES = 8 * 1024;

export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? '0.0.0.0';
}

export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? 'flowcraft';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 40);
}

/** True if the submission is within rate limits (checks per-IP and per-widget). */
export async function withinRateLimit(widgetId: string, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000);
  const [perIp, perWidget] = await Promise.all([
    prisma.widgetSubmission.count({ where: { widgetId, ipHash, createdAt: { gte: since } } }),
    prisma.widgetSubmission.count({ where: { widgetId, createdAt: { gte: since } } }),
  ]);
  return perIp < RATE_PER_IP_PER_MIN && perWidget < RATE_PER_WIDGET_PER_MIN;
}

export async function recordSubmission(widgetId: string, ipHash: string): Promise<void> {
  await prisma.widgetSubmission.create({ data: { widgetId, ipHash } });
}

/** Origin allowlist check. Empty allowlist = any origin permitted. */
export function originAllowed(origin: string | null, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return allowlist.some((d) => {
    const dom = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return host === dom || host.endsWith(`.${dom}`);
  });
}

export const isHoneypotTripped = (body: Record<string, unknown>): boolean =>
  typeof body._hp === 'string' && body._hp.trim().length > 0;

export function tooFast(renderedAt: unknown): boolean {
  const t = Number(renderedAt);
  if (!Number.isFinite(t)) return false; // missing token → don't hard-block (older embeds)
  return Date.now() - t < MIN_SUBMIT_MS;
}

export function payloadTooLarge(raw: string): boolean {
  return Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES;
}

/** Verify a Cloudflare Turnstile token (only when a secret is configured). */
export async function verifyTurnstile(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!secret) return true; // Turnstile not enabled for this widget
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
