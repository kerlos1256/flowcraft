// Widget definitions: types, field schema, theme, protection, and per-type presets.
// The management UI edits a WidgetConfig; the public /config endpoint serves a
// sanitized copy; public/widget.js renders it. Kept framework-agnostic (pure data).

export type WidgetType = 'form' | 'button' | 'feedback' | 'email_capture' | 'chat';
export type WidgetPlacement = 'inline' | 'floating';
export type WidgetFieldType = 'text' | 'email' | 'textarea' | 'select' | 'rating';
export type RatingVariant = 'stars' | 'nps' | 'thumbs';

export interface WidgetField {
  key: string;
  label: string;
  type: WidgetFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select
  ratingVariant?: RatingVariant; // for rating
}

export interface WidgetTheme {
  primaryColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  buttonTextColor: string;
  radius: number; // px
  fontFamily: string;
  width: number; // px (inline max width / floating panel width)
}

export interface WidgetProtection {
  /** Hostnames allowed to submit (empty = any). e.g. ["shop.example.com"] */
  domainAllowlist: string[];
  /** Optional Cloudflare Turnstile keys (site key is public; secret stays server-side). */
  turnstileSiteKey?: string;
  turnstileSecretKey?: string;
}

export interface WidgetConfig {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  fields: WidgetField[];
  theme: WidgetTheme;
  protection: WidgetProtection;
  /** Floating launcher button label. */
  launcherLabel: string;
  /** Show "Powered by Flowcraft" (forced true on Free). */
  branding: boolean;
}

export const DEFAULT_THEME: WidgetTheme = {
  primaryColor: '#6d28d9',
  textColor: '#0f1729',
  bgColor: '#ffffff',
  borderColor: '#e2e6ee',
  buttonTextColor: '#ffffff',
  radius: 10,
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  width: 380,
};

export interface WidgetPreset {
  label: string;
  icon: string;
  blurb: string;
  defaultPlacement: WidgetPlacement;
  build: () => Pick<WidgetConfig, 'title' | 'description' | 'submitLabel' | 'successMessage' | 'fields' | 'launcherLabel'>;
}

export const WIDGET_PRESETS: Record<WidgetType, WidgetPreset> = {
  form: {
    label: 'Contact form',
    icon: '📝',
    blurb: 'Collect name, email and a message (or any custom fields).',
    defaultPlacement: 'inline',
    build: () => ({
      title: 'Get in touch',
      description: 'We’ll get back to you shortly.',
      submitLabel: 'Send',
      successMessage: 'Thanks! We’ll be in touch.',
      launcherLabel: 'Contact us',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Jane Doe' },
        { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
        { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help?' },
      ],
    }),
  },
  button: {
    label: 'Action button',
    icon: '⚡',
    blurb: 'A single button that fires your workflow on click.',
    defaultPlacement: 'inline',
    build: () => ({
      title: '',
      description: '',
      submitLabel: 'Request a callback',
      successMessage: 'Done — we’ll reach out!',
      launcherLabel: 'Request a callback',
      fields: [],
    }),
  },
  feedback: {
    label: 'Feedback / rating',
    icon: '⭐',
    blurb: 'Star, NPS or thumbs rating with an optional comment.',
    defaultPlacement: 'floating',
    build: () => ({
      title: 'How are we doing?',
      description: 'Your feedback helps us improve.',
      submitLabel: 'Submit feedback',
      successMessage: 'Thanks for the feedback!',
      launcherLabel: 'Feedback',
      fields: [
        { key: 'rating', label: 'Your rating', type: 'rating', required: true, ratingVariant: 'stars' },
        { key: 'comment', label: 'Anything to add?', type: 'textarea', placeholder: 'Optional' },
      ],
    }),
  },
  email_capture: {
    label: 'Email capture',
    icon: '✉️',
    blurb: 'Grow a waitlist or newsletter with a single email field.',
    defaultPlacement: 'inline',
    build: () => ({
      title: 'Join the waitlist',
      description: 'Be the first to know when we launch.',
      submitLabel: 'Notify me',
      successMessage: 'You’re on the list 🎉',
      launcherLabel: 'Join waitlist',
      fields: [{ key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' }],
    }),
  },
  chat: {
    label: 'Message bubble',
    icon: '💬',
    blurb: 'A floating bubble that opens a quick message box.',
    defaultPlacement: 'floating',
    build: () => ({
      title: 'Send us a message',
      description: 'We typically reply within a day.',
      submitLabel: 'Send',
      successMessage: 'Message sent — thank you!',
      launcherLabel: 'Chat with us',
      fields: [
        { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
        { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Type your message…' },
      ],
    }),
  },
};

export const WIDGET_TYPES = Object.keys(WIDGET_PRESETS) as WidgetType[];

// Wire shapes (client-safe).
export interface WidgetSummary {
  id: string;
  name: string;
  type: WidgetType;
  placement: WidgetPlacement;
  workflowId: string;
  workflowName: string;
  createdAt: string;
}
export interface WidgetFull extends WidgetSummary {
  config: WidgetConfig;
}

export function isWidgetType(v: string): v is WidgetType {
  return v in WIDGET_PRESETS;
}

/** Build a default config for a freshly-created widget of a given type. */
export function defaultWidgetConfig(type: WidgetType): WidgetConfig {
  const preset = WIDGET_PRESETS[type];
  return {
    ...preset.build(),
    theme: { ...DEFAULT_THEME },
    protection: { domainAllowlist: [] },
    branding: true,
  };
}

/** Strip server-only secrets before sending config to the public embed. */
export function publicWidgetConfig(w: {
  id: string;
  type: string;
  placement: string;
  config: WidgetConfig;
}) {
  const { protection, ...rest } = w.config;
  return {
    id: w.id,
    type: w.type,
    placement: w.placement,
    ...rest,
    turnstileSiteKey: protection?.turnstileSiteKey ?? null,
  };
}
