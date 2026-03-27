import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  getUserIdByStripeCustomerId,
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from '@/lib/billing';
import { getStripe } from '@/lib/stripe';

function toDate(unixSeconds: number | null | undefined) {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.current_period_end;
}

async function resolveUserId(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata.userId;

  if (metadataUserId) {
    return metadataUserId;
  }

  if (typeof subscription.customer === 'string') {
    return getUserIdByStripeCustomerId(subscription.customer);
  }

  return null;
}

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set. Add it to your environment variables.' },
      { status: 500 },
    );
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid Stripe webhook signature.',
      },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (
          session.mode === 'subscription' &&
          typeof session.subscription === 'string' &&
          typeof session.customer === 'string'
        ) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const userId =
            session.metadata?.userId ??
            subscription.metadata.userId ??
            (await getUserIdByStripeCustomerId(session.customer));

          if (userId) {
            await syncSubscriptionFromStripe({
              userId,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price.id ?? null,
              status: subscription.status,
              currentPeriodEnd: toDate(getSubscriptionCurrentPeriodEnd(subscription)),
            });
          }
        }

        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription);

        if (userId && typeof subscription.customer === 'string') {
          await syncSubscriptionFromStripe({
            userId,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price.id ?? null,
            status: subscription.status,
            currentPeriodEnd: toDate(getSubscriptionCurrentPeriodEnd(subscription)),
          });
        }

        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await markSubscriptionCanceled({
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: toDate(getSubscriptionCurrentPeriodEnd(subscription)),
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process Stripe webhook.',
      },
      { status: 400 },
    );
  }
}
