'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FlowGraph } from '@flowcraft/shared-types';
import { aiEditWorkflow, ApiError } from '@/lib/api';
import { AI_MODELS, AI_MODEL_IDS, aiTokenCost, type AiModelId } from '@/lib/ai/models';
import type { AiUsageDto } from '@/lib/ai/types';

const COACHMARK_KEY = 'fc_ai_coachmark_seen';

const EXAMPLES = [
  'Add a Slack alert when the check fails',
  'Wait 5 minutes, then send me an email',
  'Delete the condition node',
];

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  tone?: 'ok' | 'refused' | 'error' | 'upgrade';
}

interface AiAssistantProps {
  workflowId: string;
  usage: AiUsageDto;
  /** Apply the AI's new graph to the canvas; changedIds are highlighted. */
  onApply: (graph: FlowGraph, changedIds: string[]) => void;
}

export function AiAssistant({ workflowId, usage: initialUsage, onApply }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState(initialUsage);
  const [model, setModel] = useState<AiModelId>('sonnet');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (usage.configured && !localStorage.getItem(COACHMARK_KEY)) setShowCoach(true);
  }, [usage.configured]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  function dismissCoach() {
    setShowCoach(false);
    localStorage.setItem(COACHMARK_KEY, '1');
  }

  function openPanel() {
    setOpen(true);
    dismissCoach();
  }

  const cost = aiTokenCost(model);
  const perWorkflowBlocked =
    usage.perWorkflowLimit != null && usage.perWorkflowUsed + cost > usage.perWorkflowLimit;
  const canAfford = usage.configured && usage.remaining >= cost && !perWorkflowBlocked;

  const usageNote =
    usage.window === 'lifetime'
      ? `${usage.remaining}/${usage.tokens} free AI builds left · one per workflow`
      : `${usage.remaining}/${usage.tokens} AI tokens left this month`;

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy || !canAfford) return;
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text }));
    setMessages((xs) => [...xs, { role: 'user', text: msg }]);
    setInput('');
    setBusy(true);
    try {
      const res = await aiEditWorkflow(workflowId, msg, model, history);
      setUsage(res.usage);
      setMessages((xs) => [...xs, { role: 'assistant', text: res.reply, tone: res.refused ? 'refused' : 'ok' }]);
      if (!res.refused && res.graph) onApply(res.graph, res.changedNodeIds);
    } catch (e) {
      const err = e as ApiError;
      const upgrade = err instanceof ApiError && err.status === 402;
      setMessages((xs) => [
        ...xs,
        { role: 'assistant', text: err.message || 'Something went wrong.', tone: upgrade ? 'upgrade' : 'error' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const accent = { '--fc-a': 'var(--ai-accent)' } as React.CSSProperties;

  // ── Collapsed: floating button (+ one-time coach-mark for new users) ─────────
  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3" style={accent}>
        {showCoach && (
          <div className="fc-slide-in relative w-60 rounded-lg border border-border bg-surface p-3 text-xs shadow-[var(--shadow-md)]">
            <button
              onClick={dismissCoach}
              aria-label="Dismiss"
              className="absolute right-2 top-2 text-muted hover:text-foreground"
            >
              ✕
            </button>
            <p className="font-semibold" style={{ color: 'var(--ai-accent)' }}>
              ✨ New — build with AI
            </p>
            <p className="mt-1 text-muted">
              Describe changes in plain English and the assistant edits your workflow for you.
            </p>
          </div>
        )}
        <button
          onClick={openPanel}
          className={`btn btn-primary shadow-[var(--shadow-md)] ${showCoach ? 'fc-attn' : ''}`}
          style={{ background: 'var(--ai-accent)', borderColor: 'transparent' }}
        >
          ✨ Ask AI
        </button>
      </div>
    );
  }

  // ── Expanded: chat panel ─────────────────────────────────────────────────────
  return (
    <div
      className="fc-slide-in fixed bottom-5 right-5 z-40 flex max-h-[560px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-md)]"
      style={accent}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: 'var(--ai-accent)' }}
      >
        <div className="flex items-center gap-2">
          <span>✨</span>
          <span className="text-sm font-semibold">AI assistant</span>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {!usage.configured ? (
          <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted">
            The AI assistant isn’t enabled on this deployment yet (no API key configured).
          </p>
        ) : messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Describe what you want and I’ll add, edit, or remove nodes on your canvas. Try:
            </p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => send(ex)}
                disabled={!canAfford || busy}
                className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs hover:border-primary disabled:opacity-50"
              >
                “{ex}”
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} msg={m} />)
        )}
        {busy && <p className="text-xs text-muted">Thinking…</p>}
      </div>

      {/* Controls */}
      <div className="border-t border-border p-3">
        {/* Model selector */}
        <div className="mb-2 flex items-center gap-1.5">
          {AI_MODEL_IDS.map((id) => {
            const info = AI_MODELS[id];
            const locked = id === 'opus' && !usage.allowOpus;
            const active = model === id;
            return (
              <span key={id} className="fc-tip">
                <button
                  onClick={() => !locked && setModel(id)}
                  aria-disabled={locked}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    active ? 'text-white' : 'text-muted'
                  } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                  style={
                    active ? { background: 'var(--ai-accent)', borderColor: 'transparent' } : { borderColor: 'var(--border)' }
                  }
                >
                  {info.label} · {info.tokenCost}🪙{locked ? ' 🔒' : ''}
                </button>
                <span className="fc-tip__pop" role="tooltip">
                  {locked ? (
                    <>
                      <strong style={{ color: 'var(--ai-accent)' }}>Paid plans only.</strong> Opus (2 tokens) unlocks on
                      Pro & Team — you’re on Sonnet.
                    </>
                  ) : (
                    info.blurb
                  )}
                </span>
              </span>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            className="textarea min-h-[40px] flex-1 text-xs"
            rows={2}
            placeholder="e.g. Add a 5-minute delay before the email"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={!canAfford || busy}
          />
          <button
            onClick={() => send(input)}
            disabled={!canAfford || busy || !input.trim()}
            className="btn btn-primary shrink-0"
            style={{ background: 'var(--ai-accent)', borderColor: 'transparent' }}
          >
            ➤
          </button>
        </div>

        {/* Usage note / upgrade prompt */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{usage.configured ? usageNote : 'AI not configured'}</span>
          {usage.configured && !canAfford && (
            <Link href="/pricing" className="font-semibold" style={{ color: 'var(--ai-accent)' }}>
              Upgrade →
            </Link>
          )}
        </div>
        {perWorkflowBlocked && usage.remaining >= cost && (
          <p className="mt-1 text-[11px] text-muted">
            You’ve used this workflow’s free AI build. Upgrade for unlimited edits per workflow.
          </p>
        )}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-lg px-3 py-2 text-xs text-white"
          style={{ background: 'var(--ai-accent)' }}
        >
          {msg.text}
        </div>
      </div>
    );
  }
  const color =
    msg.tone === 'error' ? 'var(--muted)' : msg.tone === 'upgrade' ? 'var(--ai-accent)' : undefined;
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs" style={{ color }}>
        {msg.tone === 'refused' && <span className="mr-1">↩︎</span>}
        {msg.text}
      </div>
    </div>
  );
}
