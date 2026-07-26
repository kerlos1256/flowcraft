import { Inngest } from 'inngest';

/**
 * The Inngest client. In dev it talks to the local Inngest dev server; in
 * production (Vercel) it uses the event/signing keys from env and Inngest Cloud
 * invokes our /api/inngest route per step.
 */
export const inngest = new Inngest({
  id: 'flowcraft',
  isDev: process.env.INNGEST_DEV === '1' || process.env.NODE_ENV !== 'production',
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});
