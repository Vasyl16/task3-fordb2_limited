// app/page.tsx (server component)
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PublicVoiceDemo } from '@/components/landing/public-voice-demo';

const GUEST_FREE_CALL_COOKIE = 'guest-voice-free-used';

export default async function Home() {
  const { userId } = await auth(); // server-side check
  const cookieStore = await cookies();

  const isSignedIn = !!userId;
  const guestFreeCallUsed = cookieStore.get(GUEST_FREE_CALL_COOKIE)?.value === '1';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Micro MVP Voice Platform
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
          Start with one free guest voice-to-text call. If you want more, sign in, then unlock the
          full product with a subscription.
        </p>
      </div>

      {!isSignedIn && (
        <>
          <PublicVoiceDemo initialGuestFreeCallUsed={guestFreeCallUsed} />
          <div className="flex items-center gap-3">
            <Link
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href="/sign-in"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
              href="/sign-up"
            >
              Sign up
            </Link>
          </div>
        </>
      )}

      {isSignedIn && (
        <div className="flex items-center gap-4">
          <Link
            className="rounded-md border px-4 py-2 text-sm font-medium"
            href="/dashboard"
          >
            Open dashboard
          </Link>
        </div>
      )}
    </main>
  );
}
