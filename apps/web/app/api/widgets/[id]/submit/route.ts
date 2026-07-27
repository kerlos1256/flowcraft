import { NextResponse } from 'next/server';
import { getWidgetPublic, submitToWidget } from '@/lib/widget-data';
import { cors, corsPreflight } from '@/lib/cors';
import {
  clientIp,
  hashIp,
  withinRateLimit,
  recordSubmission,
  originAllowed,
  isHoneypotTripped,
  tooFast,
  payloadTooLarge,
  verifyTurnstile,
} from '@/lib/widget-protection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ok = () => cors(NextResponse.json({ ok: true }, { status: 202 }));

/** Public: a visitor submitted the widget → run the linked workflow (durably). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const raw = await req.text();
  if (payloadTooLarge(raw)) return cors(NextResponse.json({ ok: false }, { status: 413 }));
  const body = (() => {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  const w = await getWidgetPublic(params.id);
  if (!w) return cors(NextResponse.json({ error: 'not found' }, { status: 404 }));

  const protection = w.config.protection ?? { domainAllowlist: [] };

  // 1) Origin allowlist (owner-configured)
  if (!originAllowed(req.headers.get('origin'), protection.domainAllowlist ?? [])) {
    return cors(NextResponse.json({ ok: false, error: 'origin not allowed' }, { status: 403 }));
  }
  // 2) Honeypot + 3) min-submit-time → silently accept so bots get no signal, but don't run
  if (isHoneypotTripped(body) || tooFast(body._t)) return ok();
  // 4) Turnstile (if configured)
  if (!(await verifyTurnstile(body._turnstile as string | undefined, protection.turnstileSecretKey))) {
    return cors(NextResponse.json({ ok: false, error: 'verification failed' }, { status: 400 }));
  }
  // 5) Rate limit (per IP + per widget)
  const ipHash = hashIp(clientIp(req.headers));
  if (!(await withinRateLimit(w.id, ipHash))) {
    return cors(NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 }));
  }
  await recordSubmission(w.id, ipHash);

  // Strip protocol/meta fields; the rest becomes event.data for the workflow.
  const { _hp, _t, _turnstile, ...fields } = body;
  void _hp;
  void _t;
  void _turnstile;
  try {
    await submitToWidget(w.workflowId, fields);
  } catch {
    // Owner over run quota (LimitError) — accept the submission, skip the run.
  }
  return ok();
}

export function OPTIONS() {
  return corsPreflight();
}
