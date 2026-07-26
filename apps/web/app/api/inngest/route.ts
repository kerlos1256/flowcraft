import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { createFlowcraftFunctions } from '@/lib/inngest/functions';
import { prisma } from '@/lib/prisma';

// Prisma needs the Node runtime (not Edge); steps may take a few seconds.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Inngest Cloud calls this endpoint to discover + drive the durable functions.
// inngest/next handles signature verification (raw body) correctly on Vercel.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: createFlowcraftFunctions(prisma),
});
