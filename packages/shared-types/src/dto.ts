// API wire shapes consumed by the Next.js web app (camelCase, ISO dates).

import type { WorkflowStatus, RunStatus, StepStatus, TriggerKind, NodeCategory } from './enums';
import type { FlowGraph } from './graph';
import type { ConfigField } from './node-templates';

export interface WorkflowDto {
  id: string;
  name: string;
  graph: FlowGraph;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight list item (no full graph — just enough for the workflows list). */
export interface WorkflowSummaryDto {
  id: string;
  name: string;
  status: WorkflowStatus;
  nodeCount: number;
  updatedAt: string;
}

export interface WorkflowRunDto {
  id: string;
  workflowId: string;
  inngestRunId: string | null;
  status: RunStatus;
  triggeredBy: TriggerKind;
  startedAt: string;
  completedAt: string | null;
}

export interface RunStepDto {
  id: string;
  runId: string;
  nodeId: string;
  stepType: NodeCategory;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  startedAt: string;
  completedAt: string | null;
}

/** Run detail = the run + its steps + the workflow's graph (for node highlight). */
export interface RunDetailDto extends WorkflowRunDto {
  workflowName: string;
  graph: FlowGraph;
  steps: RunStepDto[];
}

export interface NodeTemplateDto {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  configSchema: ConfigField[];
}
