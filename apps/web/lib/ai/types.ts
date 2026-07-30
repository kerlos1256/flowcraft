// Wire types shared by the API route, the client API helper, and the panel.
// Client-SAFE (types only). Keep in sync with lib/ai/ops.ts (server) validation.

import type { FlowGraph } from '@flowcraft/shared-types';
import type { AiModelId } from './models';

/** A single turn sent back to the model for follow-up requests ("now add…"). */
export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiUsageDto {
  planId: string;
  window: 'lifetime' | 'month';
  /** Total token budget for the window. */
  tokens: number;
  /** Tokens spent in the window. */
  used: number;
  remaining: number;
  /** Free: 1 (per-workflow cap). null = unlimited per workflow. */
  perWorkflowLimit: number | null;
  perWorkflowUsed: number;
  allowOpus: boolean;
  /** Non-expiring top-up tokens on top of the monthly allotment (workspace only). */
  topupBalance?: number;
  /** Whether ANTHROPIC_API_KEY is configured on the server. */
  configured: boolean;
}

export interface AiEditRequest {
  message: string;
  model: AiModelId;
  history?: AiChatTurn[];
}

export interface AiEditResult {
  /** One short sentence to show in the chat log. */
  reply: string;
  /** True when the request was out of scope — no graph change, no quota spent. */
  refused: boolean;
  /** The new graph to apply to the canvas (null when refused / no change). */
  graph: FlowGraph | null;
  /** Ids of nodes added or edited — highlighted on the canvas. */
  changedNodeIds: string[];
  /** The user's live usage after this edit. */
  usage: AiUsageDto;
}
