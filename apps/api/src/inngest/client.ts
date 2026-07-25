import { Inngest } from 'inngest';

/**
 * The Inngest client — the single app identity both the serve handler and the
 * event sender share. In dev it auto-discovers the local Inngest dev server; in
 * prod it uses the event/signing keys from env.
 */
export const inngest = new Inngest({
  id: 'flowcraft',
  // Force dev mode locally so the SDK talks to the Inngest dev server and doesn't
  // require request signatures (which would 401 the dev server's callbacks).
  isDev: process.env.INNGEST_DEV === '1' || process.env.NODE_ENV !== 'production',
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});
