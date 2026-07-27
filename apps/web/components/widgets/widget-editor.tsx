'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  type WidgetFull,
  type WidgetConfig,
  type WidgetField,
  type WidgetFieldType,
  type WidgetPlacement,
} from '@/lib/widgets';
import { updateWidgetApi } from '@/lib/api';
import { WidgetPreview } from './widget-preview';

const input = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary';
const lbl = 'flex flex-col gap-1 text-xs text-muted';

export function WidgetEditor({
  widget,
  workflows,
  customStyling,
  removeBranding,
}: {
  widget: WidgetFull;
  workflows: { id: string; name: string }[];
  customStyling: boolean;
  removeBranding: boolean;
}) {
  const [name, setName] = useState(widget.name);
  const [placement, setPlacement] = useState<WidgetPlacement>(widget.placement);
  const [workflowId, setWorkflowId] = useState(widget.workflowId);
  const [config, setConfig] = useState<WidgetConfig>(widget.config);
  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const set = (patch: Partial<WidgetConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setSaved(false);
  };
  const setTheme = (patch: Partial<WidgetConfig['theme']>) => set({ theme: { ...config.theme, ...patch } });
  const setField = (i: number, patch: Partial<WidgetField>) =>
    set({ fields: config.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const addField = () =>
    set({
      fields: [...config.fields, { key: `field${config.fields.length + 1}`, label: 'New field', type: 'text' }],
    });
  const removeField = (i: number) => set({ fields: config.fields.filter((_, idx) => idx !== i) });

  const embed = `<script src="${origin}/widget.js" data-widget="${widget.id}" async></script>`;

  async function save() {
    setSaving(true);
    try {
      await updateWidgetApi(widget.id, { name, placement, workflowId, config });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/widgets" className="text-sm text-muted hover:text-foreground">
          ← Widgets
        </Link>
        <input className="max-w-xs rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        <button className="btn btn-primary ml-auto" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs text-green-500">Saved ✓</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ── Controls ── */}
        <div className="flex flex-col gap-6">
          <Section title="Setup">
            <div className="grid grid-cols-2 gap-3">
              <label className={lbl}>
                Placement
                <select className={input} value={placement} onChange={(e) => { setPlacement(e.target.value as WidgetPlacement); setSaved(false); }}>
                  <option value="inline">Inline (in-page)</option>
                  <option value="floating">Floating launcher</option>
                </select>
              </label>
              <label className={lbl}>
                Runs workflow
                <select className={input} value={workflowId} onChange={(e) => { setWorkflowId(e.target.value); setSaved(false); }}>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </Section>

          <Section title="Content">
            <label className={lbl}>Title<input className={input} value={config.title} onChange={(e) => set({ title: e.target.value })} /></label>
            <label className={lbl}>Description<input className={input} value={config.description} onChange={(e) => set({ description: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={lbl}>Submit button<input className={input} value={config.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} /></label>
              <label className={lbl}>Success message<input className={input} value={config.successMessage} onChange={(e) => set({ successMessage: e.target.value })} /></label>
            </div>
            {placement === 'floating' && (
              <label className={lbl}>Launcher label<input className={input} value={config.launcherLabel} onChange={(e) => set({ launcherLabel: e.target.value })} /></label>
            )}
          </Section>

          {widget.type !== 'button' && (
            <Section title="Fields">
              <div className="flex flex-col gap-3">
                {config.fields.map((f, i) => (
                  <div key={i} className="rounded-md border border-border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className={lbl}>Label<input className={input} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} /></label>
                      <label className={lbl}>Key<input className={input} value={f.key} onChange={(e) => setField(i, { key: e.target.value.replace(/\s+/g, '_') })} /></label>
                      <label className={lbl}>
                        Type
                        <select className={input} value={f.type} onChange={(e) => setField(i, { type: e.target.value as WidgetFieldType })}>
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Dropdown</option>
                          <option value="rating">Rating</option>
                        </select>
                      </label>
                      {f.type === 'rating' ? (
                        <label className={lbl}>
                          Rating style
                          <select className={input} value={f.ratingVariant ?? 'stars'} onChange={(e) => setField(i, { ratingVariant: e.target.value as WidgetField['ratingVariant'] })}>
                            <option value="stars">Stars</option>
                            <option value="nps">NPS 0–10</option>
                            <option value="thumbs">Thumbs</option>
                          </select>
                        </label>
                      ) : f.type === 'select' ? (
                        <label className={lbl}>Options (comma)<input className={input} value={(f.options ?? []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>
                      ) : (
                        <label className={lbl}>Placeholder<input className={input} value={f.placeholder ?? ''} onChange={(e) => setField(i, { placeholder: e.target.value })} /></label>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required
                      </label>
                      <button className="text-xs text-red-500 hover:underline" onClick={() => removeField(i)}>Remove</button>
                    </div>
                  </div>
                ))}
                <button className="btn btn-sm self-start" onClick={addField}>+ Add field</button>
              </div>
            </Section>
          )}

          <Section title={`Styling ${customStyling ? '' : '🔒 Pro'}`}>
            {customStyling ? (
              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Primary" value={config.theme.primaryColor} onChange={(v) => setTheme({ primaryColor: v })} />
                <ColorInput label="Button text" value={config.theme.buttonTextColor} onChange={(v) => setTheme({ buttonTextColor: v })} />
                <ColorInput label="Background" value={config.theme.bgColor} onChange={(v) => setTheme({ bgColor: v })} />
                <ColorInput label="Text" value={config.theme.textColor} onChange={(v) => setTheme({ textColor: v })} />
                <ColorInput label="Border" value={config.theme.borderColor} onChange={(v) => setTheme({ borderColor: v })} />
                <label className={lbl}>Corner radius (px)<input type="number" className={input} value={config.theme.radius} onChange={(e) => setTheme({ radius: Number(e.target.value) })} /></label>
                <label className={lbl}>Width (px)<input type="number" className={input} value={config.theme.width} onChange={(e) => setTheme({ width: Number(e.target.value) })} /></label>
                <label className={lbl}>Font family<input className={input} value={config.theme.fontFamily} onChange={(e) => setTheme({ fontFamily: e.target.value })} /></label>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Full styling — colors, fonts, radius — is a Pro feature.{' '}
                <Link href="/pricing" className="font-semibold text-primary underline">Upgrade</Link> to match your brand.
              </p>
            )}
          </Section>

          <Section title="Protection & branding">
            <label className={lbl}>
              Allowed domains (one per line — empty = any site)
              <textarea className={input} rows={2} value={(config.protection.domainAllowlist ?? []).join('\n')} onChange={(e) => set({ protection: { ...config.protection, domainAllowlist: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } })} placeholder="shop.example.com" />
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" disabled={!removeBranding} checked={!config.branding} onChange={(e) => set({ branding: !e.target.checked })} />
              Hide “Powered by Flowcraft” {removeBranding ? '' : '(Pro)'}
            </label>
            <p className="mt-2 text-[11px] text-muted">
              Every submission is also protected by a honeypot, rate limiting, and min-submit-time — always on.
            </p>
          </Section>
        </div>

        {/* ── Preview + embed ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</div>
            <div className="rounded-xl border border-border bg-surface-muted p-6">
              <WidgetPreview config={config} />
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Embed code</div>
            <p className="mb-2 text-[11px] text-muted">
              Paste this into any site. {placement === 'inline' ? 'The widget renders where you place the tag.' : 'A floating launcher appears in the corner.'}
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px]">{embed}</pre>
            <button
              className="btn btn-sm mt-2"
              onClick={() => { navigator.clipboard.writeText(embed); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? 'Copied ✓' : 'Copy embed code'}
            </button>
            <p className="mt-2 text-[11px] text-muted">Remember to Save after changes — the embed always serves your latest config.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={lbl}>
      {label}
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-border bg-surface" />
        <input className={input} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
