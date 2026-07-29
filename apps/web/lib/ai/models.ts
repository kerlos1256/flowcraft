// AI model registry for the workflow assistant. Client-SAFE (pure data — no env,
// no secrets): the panel imports it for labels + token costs, the server imports
// it for the concrete API model id. Sonnet costs 1 token, Opus costs 2.

export type AiModelId = 'sonnet' | 'opus';

export interface AiModelInfo {
  id: AiModelId;
  label: string;
  blurb: string;
  /** The Anthropic API model id (server-side default; overridable via env). */
  apiModel: string;
  /** Tokens deducted from the user's budget per successful use. */
  tokenCost: number;
}

export const AI_MODELS: Record<AiModelId, AiModelInfo> = {
  sonnet: {
    id: 'sonnet',
    label: 'Sonnet 5',
    blurb: 'Fast · balanced · 1 token',
    apiModel: 'claude-sonnet-5',
    tokenCost: 1,
  },
  opus: {
    id: 'opus',
    label: 'Opus 5',
    blurb: 'Deepest reasoning · 2 tokens',
    apiModel: 'claude-opus-5',
    tokenCost: 2,
  },
};

export const AI_MODEL_IDS = ['sonnet', 'opus'] as const;

export const isAiModelId = (v: unknown): v is AiModelId => v === 'sonnet' || v === 'opus';

export const aiTokenCost = (m: AiModelId): number => AI_MODELS[m].tokenCost;

/** Resolve the Anthropic API model id, allowing an env override per model. */
export function apiModelFor(m: AiModelId): string {
  const override = m === 'opus' ? process.env.AI_MODEL_OPUS : process.env.AI_MODEL_SONNET;
  return override || AI_MODELS[m].apiModel;
}
