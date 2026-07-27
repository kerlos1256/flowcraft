// The node-template registry — the single source of truth for what node types
// exist, how they look in the palette, and what config fields each one exposes.
// The `configSchema` here drives the dynamic config form on the web side AND is
// seeded into node_templates.config_schema so the data model matches the spec.

import type { NodeType, NodeCategory } from './enums';
import { NODE_TYPE_CATEGORY } from './enums';

export type ConfigFieldType = 'text' | 'textarea' | 'number' | 'select' | 'duration';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** For number fields (e.g. failRate 0–1). */
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}

export interface NodeTemplate {
  type: NodeType;
  category: NodeCategory;
  label: string;
  description: string;
  /** Emoji glyph for the palette + canvas node (kept in the central config). */
  icon: string;
  configSchema: ConfigField[];
}

const COMPARATORS: ConfigField['options'] = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'lt', label: '< less than' },
  { value: 'contains', label: 'contains' },
];

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: 'manual_trigger',
    category: 'trigger',
    label: 'Manual Trigger',
    description: 'Starts the flow when you click “Run Now”.',
    icon: '▶️',
    configSchema: [],
  },
  {
    type: 'webhook_trigger',
    category: 'trigger',
    label: 'Webhook Trigger',
    description: 'Starts the flow when POST /workflows/:id/trigger is called.',
    icon: '🪝',
    configSchema: [],
  },
  {
    type: 'widget_trigger',
    category: 'trigger',
    label: 'Widget',
    description: 'Starts the flow when an embedded widget (form, button, …) is submitted.',
    icon: '🧩',
    configSchema: [],
  },
  {
    type: 'send_slack',
    category: 'action',
    label: 'Send Slack',
    description: 'Posts a message to a Slack channel (mocked in dev).',
    icon: '💬',
    configSchema: [
      { key: 'channel', label: 'Channel', type: 'text', placeholder: '#alerts', required: true },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello from Flowcraft', required: true },
    ],
  },
  {
    type: 'send_email',
    category: 'action',
    label: 'Send Email',
    description: 'Sends an email (mocked in dev).',
    icon: '✉️',
    configSchema: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'ops@example.com', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea', required: true },
    ],
  },
  {
    type: 'http_request',
    category: 'action',
    label: 'HTTP Request',
    description: 'Calls an HTTP endpoint. Set a fail rate to demo Inngest retries.',
    icon: '🌐',
    configSchema: [
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        required: true,
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/ping', required: true },
      { key: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{}' },
      {
        key: 'failRate',
        label: 'Simulated fail rate (0–1)',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.1,
        help: 'For the reliability demo — the node fails this fraction of attempts so Inngest retries are visible.',
      },
    ],
  },
  {
    type: 'delay',
    category: 'delay',
    label: 'Delay',
    description: 'Waits durably (Inngest step.sleep) — survives restarts, holds no worker.',
    icon: '⏳',
    configSchema: [
      { key: 'amount', label: 'Amount', type: 'number', required: true, min: 1, step: 1 },
      {
        key: 'unit',
        label: 'Unit',
        type: 'select',
        required: true,
        options: [
          { value: 's', label: 'seconds' },
          { value: 'm', label: 'minutes' },
          { value: 'h', label: 'hours' },
        ],
      },
    ],
  },
  {
    type: 'condition',
    category: 'condition',
    label: 'Condition',
    description: 'Branches true/false on a simple comparison. Untaken branch is skipped.',
    icon: '🔀',
    configSchema: [
      {
        key: 'left',
        label: 'Left value',
        type: 'text',
        placeholder: 'event.data.status',
        required: true,
        help: 'A literal, or a path into the trigger payload like event.data.status',
      },
      { key: 'operator', label: 'Operator', type: 'select', required: true, options: COMPARATORS },
      { key: 'right', label: 'Right value', type: 'text', placeholder: 'ok', required: true },
    ],
  },
];

export const NODE_TEMPLATE_BY_TYPE: Record<NodeType, NodeTemplate> = Object.fromEntries(
  NODE_TEMPLATES.map((t) => [t.type, t]),
) as Record<NodeType, NodeTemplate>;

/** Default config object for a freshly-dropped node (empty/typed defaults). */
export function defaultConfigFor(type: NodeType): Record<string, unknown> {
  const tpl = NODE_TEMPLATE_BY_TYPE[type];
  const cfg: Record<string, unknown> = {};
  for (const f of tpl.configSchema) {
    if (f.type === 'number') cfg[f.key] = f.min ?? 0;
    else if (f.type === 'select') cfg[f.key] = f.options?.[0]?.value ?? '';
    else cfg[f.key] = '';
  }
  return cfg;
}

export { NODE_TYPE_CATEGORY };
