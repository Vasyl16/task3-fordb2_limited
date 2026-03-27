import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type SyncClerkUserInput = {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

export async function syncClerkUser(input: SyncClerkUserInput) {
  return prisma.user.upsert({
    where: {
      clerkUserId: input.clerkUserId,
    },
    update: {
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
    include: {
      records: {
        orderBy: {
          createdAt: "desc",
        },
      },
      subscriptions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getCurrentDbUser() {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("Authenticated Clerk user is missing an email address.");
  }

  return syncClerkUser({
    clerkUserId: userId,
    email,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    imageUrl: clerkUser.imageUrl,
  });
}
