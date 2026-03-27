import { NextResponse } from 'next/server';
import { ensureStripeCustomerForUser, getBillingState } from '@/lib/billing';
import { getCurrentDbUser } from '@/lib/db/users';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripePriceId = process.env.STRIPE_PRICE_ID;

  if (!stripePriceId) {
    return NextResponse.json(
      { error: 'STRIPE_PRICE_ID is not set. Add it to your environment variables.' },
      { status: 500 },
    );
  }

  const billingState = await getBillingState(dbUser.id);

  if (billingState.hasActiveSubscription) {
    return NextResponse.json(
      { error: 'You already have an active subscription.' },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const customerId = await ensureStripeCustomerForUser(dbUser);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: dbUser.id,
      allow_promotion_codes: true,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: dbUser.id,
      },
      subscription_data: {
        metadata: {
          userId: dbUser.id,
        },
      },
      success_url: new URL('/dashboard?billing=success', request.url).toString(),
      cancel_url: new URL('/dashboard?billing=canceled', request.url).toString(),
    });

    if (!session.url) {
      throw new Error('Stripe checkout session did not return a URL.');
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create Stripe checkout session.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
