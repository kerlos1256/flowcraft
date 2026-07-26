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
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

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
