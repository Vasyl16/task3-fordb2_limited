import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

const FREE_VOICE_NOTES_LIMIT = 1;
const ACTIVE_STATUSES = new Set(['ACTIVE', 'TRIALING']);

type DbUserForBilling = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

function mapStripeSubscriptionStatus(status: string) {
  switch (status) {
    case 'active':
      return 'ACTIVE' as const;
    case 'trialing':
      return 'TRIALING' as const;
    case 'past_due':
      return 'PAST_DUE' as const;
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'CANCELED' as const;
    default:
      return 'INACTIVE' as const;
  }
}

export async function getBillingState(userId: string, options?: { guestFreeCallUsed?: boolean }) {
  const [userVoiceNotesCount, latestSubscription] = await Promise.all([
    prisma.record.count({
      where: {
        userId,
        role: 'USER',
      },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const subscriptionStatus = latestSubscription?.status ?? 'INACTIVE';
  const hasActiveSubscription = ACTIVE_STATUSES.has(subscriptionStatus);
  const effectiveVoiceNotesUsed = Math.min(
    FREE_VOICE_NOTES_LIMIT,
    userVoiceNotesCount + (options?.guestFreeCallUsed ? 1 : 0),
  );
  const freeVoiceNotesRemaining = Math.max(0, FREE_VOICE_NOTES_LIMIT - effectiveVoiceNotesUsed);

  return {
    hasActiveSubscription,
    canCreateVoiceNote: hasActiveSubscription || freeVoiceNotesRemaining > 0,
    freeVoiceNotesLimit: FREE_VOICE_NOTES_LIMIT,
    freeVoiceNotesRemaining,
    userVoiceNotesCount: effectiveVoiceNotesUsed,
    guestFreeCallUsed: Boolean(options?.guestFreeCallUsed),
    subscriptionStatus,
    stripeCustomerId: latestSubscription?.stripeCustomerId ?? null,
  };
}

export async function ensureStripeCustomerForUser(user: DbUserForBilling) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      stripeCustomerId: {
        not: null,
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (existingSubscription?.stripeCustomerId) {
    return existingSubscription.stripeCustomerId;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: fullName || undefined,
    metadata: {
      userId: user.id,
    },
  });

  const latestSubscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (latestSubscription) {
    await prisma.subscription.update({
      where: {
        id: latestSubscription.id,
      },
      data: {
        stripeCustomerId: customer.id,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId: customer.id,
        status: 'INACTIVE',
      },
    });
  }

  return customer.id;
}

export async function syncSubscriptionFromStripe(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
}) {
  const existingSubscription =
    (await prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: params.stripeSubscriptionId,
      },
    })) ??
    (await prisma.subscription.findFirst({
      where: {
        userId: params.userId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }));

  const data = {
    userId: params.userId,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripePriceId: params.stripePriceId,
    status: mapStripeSubscriptionStatus(params.status),
    currentPeriodEnd: params.currentPeriodEnd,
  };

  if (existingSubscription) {
    return prisma.subscription.update({
      where: {
        id: existingSubscription.id,
      },
      data,
    });
  }

  return prisma.subscription.create({
    data,
  });
}

export async function markSubscriptionCanceled(params: {
  stripeSubscriptionId: string;
  currentPeriodEnd: Date | null;
}) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      stripeSubscriptionId: params.stripeSubscriptionId,
    },
  });

  if (!existingSubscription) {
    return null;
  }

  return prisma.subscription.update({
    where: {
      id: existingSubscription.id,
    },
    data: {
      status: 'CANCELED',
      currentPeriodEnd: params.currentPeriodEnd,
    },
  });
}

export async function getUserIdByStripeCustomerId(stripeCustomerId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      stripeCustomerId,
    },
    select: {
      userId: true,
    },
  });

  return subscription?.userId ?? null;
}
