import type { FlowGraph, FlowNode, FlowEdge, NodeType } from '@flowcraft/shared-types';

export interface WorkflowTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  /** One-line accent gradient for the card (from the theme accent family). */
  accent: string;
  graph: FlowGraph;
}

// ── tiny builders ────────────────────────────────────────────────────────────
const n = (
  id: string,
  type: NodeType,
  label: string,
  config: Record<string, unknown>,
  x: number,
  y: number,
): FlowNode => ({ id, type: 'flowNode', position: { x, y }, data: { type, label, config } });

const e = (id: string, source: string, target: string, handle?: 'true' | 'false'): FlowEdge => ({
  id,
  source,
  target,
  sourceHandle: handle ?? null,
  targetHandle: null,
});

const CX = 260;

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    slug: 'flaky-api-check',
    name: 'Flaky API health check',
    description:
      'Wait, call an endpoint that sometimes fails, and let Inngest retry it durably — then branch on the result and alert the right channel.',
    category: 'Monitoring',
    icon: '🌐',
    accent: '#38bdf8',
    graph: {
      nodes: [
        n('n1', 'manual_trigger', 'Start', {}, CX, 40),
        n('n2', 'delay', 'Wait 30s', { amount: 30, unit: 's' }, CX, 160),
        n('n3', 'http_request', 'Ping API', { method: 'GET', url: 'https://example.com/health', failRate: 0.4 }, CX, 280),
        n('n4', 'condition', 'Healthy?', { left: '1', operator: 'eq', right: '1' }, CX, 400),
        n('n5', 'send_slack', 'Post OK', { channel: '#status', message: 'API is healthy ✅' }, CX + 200, 520),
        n('n6', 'send_email', 'Email on-call', { to: 'oncall@example.com', subject: 'API down', body: 'Investigate the health check failure.' }, CX - 200, 520),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5', 'true'),
        e('e5', 'n4', 'n6', 'false'),
      ],
    },
  },
  {
    slug: 'webhook-alert-router',
    name: 'Webhook alert router',
    description:
      'Receive an external event via webhook, branch on its severity, and route critical ones to Slack and the rest to email.',
    category: 'Alerting',
    icon: '🚨',
    accent: '#f87171',
    graph: {
      nodes: [
        n('n1', 'webhook_trigger', 'Incoming webhook', {}, CX, 40),
        n('n2', 'condition', 'Critical?', { left: 'event.data.severity', operator: 'eq', right: 'critical' }, CX, 180),
        n('n3', 'send_slack', 'Page #incidents', { channel: '#incidents', message: 'Critical alert received 🔴' }, CX + 200, 320),
        n('n4', 'send_email', 'Log to inbox', { to: 'alerts@example.com', subject: 'New alert', body: 'A non-critical alert arrived.' }, CX - 200, 320),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3', 'true'),
        e('e3', 'n2', 'n4', 'false'),
      ],
    },
  },
  {
    slug: 'signup-welcome',
    name: 'New signup welcome',
    description:
      'When a user signs up, send a welcome email immediately, then notify your team in Slack a moment later.',
    category: 'Onboarding',
    icon: '👋',
    accent: '#34d399',
    graph: {
      nodes: [
        n('n1', 'webhook_trigger', 'New signup', {}, CX, 40),
        n('n2', 'send_email', 'Welcome email', { to: 'event.data.email', subject: 'Welcome aboard!', body: 'Thanks for signing up 🎉' }, CX, 170),
        n('n3', 'delay', 'Wait 1 min', { amount: 1, unit: 'm' }, CX, 300),
        n('n4', 'send_slack', 'Notify team', { channel: '#growth', message: 'A new user just signed up 🎉' }, CX, 430),
      ],
      edges: [e('e1', 'n1', 'n2'), e('e2', 'n2', 'n3'), e('e3', 'n3', 'n4')],
    },
  },
  {
    slug: 'escalation-policy',
    name: 'On-call escalation',
    description:
      'Page the on-call engineer, wait for an ack window, then escalate by email only if it was not acknowledged.',
    category: 'Alerting',
    icon: '📟',
    accent: '#fbbf24',
    graph: {
      nodes: [
        n('n1', 'webhook_trigger', 'Incident opened', {}, CX, 40),
        n('n2', 'send_slack', 'Page on-call', { channel: '#oncall', message: 'Incident opened — please ack.' }, CX, 170),
        n('n3', 'delay', 'Wait 15 min', { amount: 15, unit: 'm' }, CX, 300),
        n('n4', 'condition', 'Acked?', { left: 'event.data.acked', operator: 'eq', right: 'true' }, CX, 430),
        n('n5', 'send_email', 'Escalate', { to: 'manager@example.com', subject: 'Unacked incident', body: 'The incident was not acknowledged in time.' }, CX - 200, 560),
      ],
      edges: [
        e('e1', 'n1', 'n2'),
        e('e2', 'n2', 'n3'),
        e('e3', 'n3', 'n4'),
        e('e4', 'n4', 'n5', 'false'),
      ],
    },
  },
  {
    slug: 'delayed-followup',
    name: 'Delayed follow-up',
    description:
      'A simple durable delay: wait an hour after the trigger, then send a follow-up email. The wait survives restarts.',
    category: 'Notifications',
    icon: '⏳',
    accent: '#a78bfa',
    graph: {
      nodes: [
        n('n1', 'manual_trigger', 'Start', {}, CX, 40),
        n('n2', 'delay', 'Wait 1 hour', { amount: 1, unit: 'h' }, CX, 170),
        n('n3', 'send_email', 'Follow-up', { to: 'lead@example.com', subject: 'Following up', body: 'Just circling back!' }, CX, 300),
      ],
      edges: [e('e1', 'n1', 'n2'), e('e2', 'n2', 'n3')],
    },
  },
  {
    slug: 'enrich-and-notify',
    name: 'Enrich & notify',
    description:
      'Call an external API to enrich an incoming event, then post the result to Slack — a classic integration glue flow.',
    category: 'Integrations',
    icon: '🔗',
    accent: '#22d3ee',
    graph: {
      nodes: [
        n('n1', 'webhook_trigger', 'Event in', {}, CX, 40),
        n('n2', 'http_request', 'Enrich', { method: 'POST', url: 'https://example.com/enrich', body: '{}' }, CX, 170),
        n('n3', 'send_slack', 'Post result', { channel: '#feed', message: 'Enriched event processed ✅' }, CX, 300),
      ],
      edges: [e('e1', 'n1', 'n2'), e('e2', 'n2', 'n3')],
    },
  },
];

export const TEMPLATE_BY_SLUG: Record<string, WorkflowTemplate> = Object.fromEntries(
  WORKFLOW_TEMPLATES.map((t) => [t.slug, t]),
);

/** Templates seeded into a brand-new account so it isn't empty. */
export const STARTER_TEMPLATE_SLUGS = ['flaky-api-check', 'webhook-alert-router', 'signup-welcome'];
