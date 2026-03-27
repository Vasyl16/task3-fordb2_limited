// app/page.tsx (server component)
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowRight, AudioLines, CreditCard, Sparkles } from 'lucide-react';
import { PublicVoiceDemo } from '@/components/landing/public-voice-demo';

const GUEST_FREE_CALL_COOKIE = 'guest-voice-free-used';

export default async function Home() {
  const { userId } = await auth(); // server-side check
  const cookieStore = await cookies();

  const isSignedIn = !!userId;
  const guestFreeCallUsed = cookieStore.get(GUEST_FREE_CALL_COOKIE)?.value === '1';

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.14),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-violet-100">
              <Sparkles className="size-3.5" />
              Voice-first SaaS demo
            </div>

            <h1 className="mt-6 max-w-3xl font-heading text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Speak once.
              <span className="block text-zinc-300">See instant voice-to-text.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 sm:text-lg">
              Start with one free guest voice-to-text call. If you want more, sign in first, then
              unlock unlimited usage with a Stripe subscription.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!isSignedIn ? (
                <>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400"
                    href="/sign-up"
                  >
                    Create account
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    href="/sign-in"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400"
                  href="/dashboard"
                >
                  Open dashboard
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-violet-200">
                  <AudioLines className="size-4" />
                </div>
                <p className="text-sm font-medium text-white">1 guest call free</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Try the product before you create an account.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-cyan-200">
                  <Sparkles className="size-4" />
                </div>
                <p className="text-sm font-medium text-white">Voice only</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Record, preview, send, and let AI return the transcript.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-emerald-200">
                  <CreditCard className="size-4" />
                </div>
                <p className="text-sm font-medium text-white">Upgrade when ready</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  After free usage, Stripe unlocks the full workflow.
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/20">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">How access works</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-white">01. Try instantly</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    First-time visitors can record one guest voice note with no auth.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">02. Sign in to continue</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    After the guest call, continue the experience from your own account.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">03. Unlock unlimited</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Stripe subscriptions keep voice-to-text available whenever you need it.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="lg:pt-4">
            {!isSignedIn ? (
              <PublicVoiceDemo initialGuestFreeCallUsed={guestFreeCallUsed} />
            ) : (
              <div className="rounded-[2rem] border border-white/10 bg-black/40 p-6 text-left shadow-2xl shadow-black/30 backdrop-blur-xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100">
                  <Sparkles className="size-3.5" />
                  You are signed in
                </p>
                <h2 className="mt-5 font-heading text-3xl font-semibold text-white">
                  Jump back into your dashboard
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Your full chat workspace, billing controls, and saved voice history are available
                  inside the dashboard.
                </p>
                <Link
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400"
                  href="/dashboard"
                >
                  Open dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
