// Inngest event contract. The API sends this event; the execute-workflow Inngest
// function is triggered by it. Keeping the name + payload here means producer and
// consumer can't drift.

import type { TriggerKind } from './enums';

/** Event name that triggers the durable workflow-execution function. */
export const WORKFLOW_RUN_EVENT = 'flowcraft/workflow.run' as const;

export interface WorkflowRunEventData {
  workflowId: string;
  /** Pre-created workflow_runs row id, so the function can update it as it goes. */
  runId: string;
  triggeredBy: TriggerKind;
  /** Arbitrary payload from the trigger (webhook body / manual input). */
  payload: Record<string, unknown>;
}

/** Minimal typed Inngest event map for the client. */
export interface FlowcraftEvents {
  [WORKFLOW_RUN_EVENT]: { data: WorkflowRunEventData };
}
