'use client';

import type { WidgetConfig } from '@/lib/widgets';

/** Non-interactive React mirror of the embedded widget — instant style feedback. */
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const t = config.theme;
  const radius = `${t.radius}px`;
  const innerRadius = `${Math.max(4, t.radius - 4)}px`;

  return (
    <div
      style={{
        maxWidth: t.width,
        background: t.bgColor,
        color: t.textColor,
        border: `1px solid ${t.borderColor}`,
        borderRadius: radius,
        padding: 18,
        fontFamily: t.fontFamily,
        boxShadow: '0 6px 24px -8px rgba(2,6,23,.18)',
      }}
    >
      {config.title && <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{config.title}</div>}
      {config.description && <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>{config.description}</div>}

      {config.fields.map((f) => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
            {f.label}
            {f.required ? ' *' : ''}
          </div>
          {f.type === 'rating' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {(f.ratingVariant === 'nps'
                ? ['0', '5', '10']
                : f.ratingVariant === 'thumbs'
                ? ['👍', '👎']
                : ['★', '★', '★', '★', '★']
              ).map((s, i) => (
                <span
                  key={i}
                  style={{
                    minWidth: 34,
                    height: 34,
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${t.borderColor}`,
                    borderRadius: 8,
                    fontSize: 16,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          ) : f.type === 'textarea' ? (
            <div style={inputStyle(t, innerRadius, 56)}>{f.placeholder || ''}</div>
          ) : (
            <div style={inputStyle(t, innerRadius, 20)}>{f.placeholder || ''}</div>
          )}
        </div>
      ))}

      <div
        style={{
          marginTop: 4,
          padding: '10px',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          borderRadius: innerRadius,
          background: t.primaryColor,
          color: t.buttonTextColor,
        }}
      >
        {config.submitLabel || 'Submit'}
      </div>

      {config.branding && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, opacity: 0.5 }}>
          ⚡ Powered by Flowcraft
        </div>
      )}
    </div>
  );
}

function inputStyle(
  t: WidgetConfig['theme'],
  radius: string,
  minHeight: number,
): React.CSSProperties {
  return {
    border: `1px solid ${t.borderColor}`,
    borderRadius: radius,
    padding: '9px 10px',
    fontSize: 14,
    minHeight,
    color: t.textColor,
    opacity: 0.45,
    background: t.bgColor,
  };
}
