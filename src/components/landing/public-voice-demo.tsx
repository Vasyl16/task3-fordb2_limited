"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock, Mic, Sparkles } from "lucide-react";
import {
  VoiceChatComposer,
  type VoiceComposerSendResult,
} from "@/components/dashboard/voice-chat-composer";

type PublicVoiceDemoProps = {
  initialGuestFreeCallUsed: boolean;
};

export function PublicVoiceDemo({ initialGuestFreeCallUsed }: PublicVoiceDemoProps) {
  const [guestFreeCallUsed, setGuestFreeCallUsed] = useState(initialGuestFreeCallUsed);
  const [guestTranscript, setGuestTranscript] = useState<string | null>(null);
  const [guestAudioUrl, setGuestAudioUrl] = useState<string | null>(null);
  const [isWaitingForTranscript, setIsWaitingForTranscript] = useState(false);

  useEffect(() => {
    return () => {
      if (guestAudioUrl) {
        URL.revokeObjectURL(guestAudioUrl);
      }
    };
  }, [guestAudioUrl]);

  return (
    <div className="w-full rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.88),rgba(9,9,11,0.92))] p-5 text-left shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-violet-100">
            <Sparkles className="size-3.5" />
            1 guest voice-to-text free
          </p>
          <h2 className="mt-4 font-heading text-2xl font-semibold text-white sm:text-3xl">
            Try one voice call without login
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Record one guest message, preview it, send it, and watch AI return the transcript in
            the same conversation space.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
          <Mic className="size-4 text-violet-300" />
          No typing
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/4 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Step 1</p>
          <p className="mt-2 text-sm font-medium text-white">Record your voice</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Step 2</p>
          <p className="mt-2 text-sm font-medium text-white">Send one free guest call</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Step 3</p>
          <p className="mt-2 text-sm font-medium text-white">Sign in to keep going</p>
        </div>
      </div>

      <VoiceChatComposer
        onSendError={() => {
          if (guestAudioUrl) {
            URL.revokeObjectURL(guestAudioUrl);
          }

          setGuestAudioUrl(null);
          setIsWaitingForTranscript(false);
        }}
        onSendStart={(localAudioUrl) => {
          if (guestAudioUrl) {
            URL.revokeObjectURL(guestAudioUrl);
          }

          setGuestAudioUrl(localAudioUrl);
          setGuestTranscript(null);
          setIsWaitingForTranscript(true);
        }}
        onSendComplete={(result: VoiceComposerSendResult) => {
          if (result.mode !== "guest") {
            return;
          }

          setGuestTranscript(result.transcript);
          setGuestFreeCallUsed(true);
          setIsWaitingForTranscript(false);
        }}
        sendDisabledReason={
          guestFreeCallUsed
            ? "Your free guest voice-to-text is used. Sign in, then subscribe to continue."
            : null
        }
      />

      {guestAudioUrl || guestTranscript || isWaitingForTranscript ? (
        <div className="mt-5 space-y-4">
          {guestAudioUrl ? (
            <article className="ml-auto max-w-3xl rounded-[1.75rem] border border-violet-400/20 bg-violet-500/15 p-5 shadow-lg shadow-black/20">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-violet-100">
                <Mic className="size-3.5" />
                Your voice note
              </div>
              <audio className="w-full" controls preload="metadata" src={guestAudioUrl}>
                <track kind="captions" />
              </audio>
            </article>
          ) : null}

          {isWaitingForTranscript || guestTranscript ? (
            <article className="mr-auto max-w-3xl rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/10 p-5 shadow-lg shadow-black/20">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="size-3.5" />
                Guest transcript
              </div>
              {isWaitingForTranscript ? (
                <div className="flex items-center gap-3 text-sm text-cyan-50">
                  <Loader2 className="size-4 animate-spin" />
                  <span>AI is transcribing your guest voice note...</span>
                </div>
              ) : (
                <p className="text-sm leading-7 text-zinc-100">{guestTranscript}</p>
              )}
            </article>
          ) : null}
        </div>
      ) : null}

      {guestFreeCallUsed ? (
        <div className="mt-5 rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-100">
            <Lock className="size-4" />
            Free guest call used
          </div>
          <p className="mt-2 text-sm leading-7 text-zinc-300">
            To continue from here, sign in first. After your account-level free usage is gone,
            unlock unlimited voice-to-text with Stripe.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href="/sign-in"
            >
              Sign in
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
              href="/sign-up"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
