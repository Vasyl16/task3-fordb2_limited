import { NextResponse } from 'next/server';
import { getBillingState } from '@/lib/billing';
import { getCurrentDbUser } from '@/lib/db/users';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const billingState = await getBillingState(dbUser.id);

  if (!billingState.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer found for this account yet.' },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: billingState.stripeCustomerId,
      return_url: new URL('/dashboard', request.url).toString(),
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to open Stripe billing portal.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
