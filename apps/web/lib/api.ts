import type {
  WorkflowDto,
  WorkflowSummaryDto,
  WorkflowRunDto,
  RunDetailDto,
  NodeTemplateDto,
  FlowGraph,
  WorkflowStatus,
} from '@flowcraft/shared-types';

const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    cache: 'no-store',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Workflows
export const listWorkflows = () => req<WorkflowSummaryDto[]>('/workflows');
export const getWorkflow = (id: string) => req<WorkflowDto>(`/workflows/${id}`);
export const createWorkflow = (name: string) =>
  req<WorkflowDto>('/workflows', { method: 'POST', body: JSON.stringify({ name }) });
export const updateWorkflow = (
  id: string,
  body: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
) => req<WorkflowDto>(`/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteWorkflow = (id: string) =>
  req<void>(`/workflows/${id}`, { method: 'DELETE' });
export const runWorkflow = (id: string, payload: Record<string, unknown> = {}) =>
  req<WorkflowRunDto>(`/workflows/${id}/run`, { method: 'POST', body: JSON.stringify({ payload }) });

// Runs
export const listRuns = (workflowId?: string) =>
  req<WorkflowRunDto[]>(`/runs${workflowId ? `?workflowId=${workflowId}` : ''}`);
export const getRun = (id: string) => req<RunDetailDto>(`/runs/${id}`);

// Node templates
export const listNodeTemplates = () => req<NodeTemplateDto[]>('/node-templates');
