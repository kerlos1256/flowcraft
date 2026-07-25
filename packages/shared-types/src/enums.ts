// Domain enums shared across the Flowcraft web + api + Inngest layers. Single
// source of truth for the string values stored in the DB and sent on the wire.

/** The concrete node kinds a user can drop on the canvas. Maps to node_templates.type. */
export const NODE_TYPES = [
  'manual_trigger',
  'webhook_trigger',
  'send_slack',
  'send_email',
  'http_request',
  'delay',
  'condition',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** High-level category — drives palette grouping + run_steps.step_type. */
export const NODE_CATEGORIES = ['trigger', 'action', 'delay', 'condition'] as const;
export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export const WORKFLOW_STATUSES = ['draft', 'active', 'paused'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const RUN_STATUSES = ['running', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STEP_STATUSES = ['pending', 'succeeded', 'failed', 'skipped'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const TRIGGER_KINDS = ['manual', 'webhook', 'schedule'] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/** Which category each node type belongs to. */
export const NODE_TYPE_CATEGORY: Record<NodeType, NodeCategory> = {
  manual_trigger: 'trigger',
  webhook_trigger: 'trigger',
  send_slack: 'action',
  send_email: 'action',
  http_request: 'action',
  delay: 'delay',
  condition: 'condition',
};

export const isTriggerType = (t: NodeType): boolean => NODE_TYPE_CATEGORY[t] === 'trigger';
