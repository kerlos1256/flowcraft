import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, stripeEnabled, appBaseUrl } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Open the Stripe Customer Portal to manage or cancel the subscription. */
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripeEnabled()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account yet.' }, { status: 400 });
  }

  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appBaseUrl()}/app`,
  });
  return NextResponse.json({ url: portal.url });
}
