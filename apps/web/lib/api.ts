// Client-side API calls (used by browser components). Same-origin relative URLs
// — the Next.js app serves these routes itself, so no separate API host / CORS.
import type { WorkflowDto, WorkflowRunDto, FlowGraph, WorkflowStatus } from '@flowcraft/shared-types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    cache: 'no-store',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    // Prefer the server's error message (e.g. plan-limit copy) when present.
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? `${init?.method ?? 'GET'} ${path} → ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** True when an error is a plan-limit (HTTP 402) — callers can prompt an upgrade. */
export const isUpgradeError = (e: unknown): e is ApiError =>
  e instanceof ApiError && e.status === 402;

export const createWorkflow = (name: string) =>
  req<WorkflowDto>('/workflows', { method: 'POST', body: JSON.stringify({ name }) });

export const updateWorkflow = (
  id: string,
  body: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
) => req<WorkflowDto>(`/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteWorkflow = (id: string) => req<void>(`/workflows/${id}`, { method: 'DELETE' });

export const runWorkflow = (id: string, payload: Record<string, unknown> = {}) =>
  req<WorkflowRunDto>(`/workflows/${id}/run`, { method: 'POST', body: JSON.stringify({ payload }) });

export const listRuns = (workflowId?: string) =>
  req<WorkflowRunDto[]>(`/runs${workflowId ? `?workflowId=${workflowId}` : ''}`);

export const useTemplate = (slug: string) =>
  req<WorkflowDto>('/workflows/from-template', { method: 'POST', body: JSON.stringify({ slug }) });

// ── AI assistant ────────────────────────────────────────────────────────────────
import type { AiEditResult, AiChatTurn } from '@/lib/ai/types';
import type { AiModelId } from '@/lib/ai/models';

/** Ask the assistant to edit a workflow in plain language. Returns the new graph. */
export const aiEditWorkflow = (id: string, message: string, model: AiModelId, history: AiChatTurn[] = []) =>
  req<AiEditResult>(`/workflows/${id}/ai`, {
    method: 'POST',
    body: JSON.stringify({ message, model, history }),
  });

/** Onboarding: seed a tailored starter for the chosen use case (or none). */
export const submitOnboarding = (useCase: string) =>
  req<{ workflowId: string | null }>('/onboarding', {
    method: 'POST',
    body: JSON.stringify({ useCase }),
  });

// ── Widgets ────────────────────────────────────────────────────────────────────
import type { WidgetFull, WidgetConfig, WidgetPlacement } from '@/lib/widgets';

export const createWidgetApi = (name: string, type: string, workflowId: string) =>
  req<WidgetFull>('/widgets', { method: 'POST', body: JSON.stringify({ name, type, workflowId }) });

export const updateWidgetApi = (
  id: string,
  patch: { name?: string; placement?: WidgetPlacement; config?: WidgetConfig; workflowId?: string },
) => req<WidgetFull>(`/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteWidgetApi = (id: string) => req<void>(`/widgets/${id}`, { method: 'DELETE' });

// ── Auth ──────────────────────────────────────────────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  name: string;
}

async function auth(path: string, body: unknown): Promise<AuthUser> {
  const res = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Auth failed (${res.status})`);
  return data.user!;
}

export const signup = (email: string, name: string, password: string) =>
  auth('signup', { email, name, password });
export const login = (email: string, password: string) => auth('login', { email, password });
export const logout = () => fetch('/api/auth/logout', { method: 'POST' });

// ── Billing ────────────────────────────────────────────────────────────────────
async function billing(path: string, body?: unknown): Promise<{ url: string }> {
  const res = await fetch(`/api/billing/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new ApiError(res.status, data.error ?? 'Billing error');
  return { url: data.url };
}

/** Redirect to Stripe Checkout for the given paid plan. */
export async function startCheckout(plan: 'pro' | 'team'): Promise<void> {
  const { url } = await billing('checkout', { plan });
  window.location.href = url;
}

/** Redirect to the Stripe Customer Portal. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await billing('portal');
  window.location.href = url;
}
