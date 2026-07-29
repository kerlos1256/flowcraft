// Transactional email via Resend's REST API (no SDK dependency). Fully optional:
// with no RESEND_API_KEY, sends are skipped and callers fall back to the invite link.
// Never throws — a failed email must not break the invite flow.
import 'server-only';
import { appConfig } from '@/config/app.config';

export const emailConfigured = (): boolean => !!process.env.RESEND_API_KEY;

interface SendResult {
  sent: boolean;
  error?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'not_configured' };
  const from = process.env.EMAIL_FROM || 'Flowcraft <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) return { sent: false, error: `resend_${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}

function shell(inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1729">
    <div style="font-size:20px;font-weight:700;margin-bottom:8px">${appConfig.logoGlyph} ${appConfig.name}</div>
    ${inner}
    <p style="color:#697089;font-size:12px;margin-top:24px">If you weren't expecting this, you can ignore this email.</p>
  </div>`;
}

export function sendWorkspaceInvite(opts: {
  to: string;
  workspaceName: string;
  inviterName: string;
  link: string;
}): Promise<SendResult> {
  const html = shell(
    `<p style="font-size:15px;line-height:1.5">
       <strong>${escapeHtml(opts.inviterName)}</strong> invited you to join the
       <strong>${escapeHtml(opts.workspaceName)}</strong> workspace on ${appConfig.name}.
     </p>
     <p style="margin:20px 0">
       <a href="${opts.link}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
         Accept invitation
       </a>
     </p>
     <p style="color:#697089;font-size:13px">Or paste this link into your browser:<br>${opts.link}</p>`,
  );
  return send(opts.to, `Join ${opts.workspaceName} on ${appConfig.name}`, html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
