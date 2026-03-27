"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  CreditCard,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Waves,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  VoiceChatComposer,
  type VoiceComposerSendResult,
} from "@/components/dashboard/voice-chat-composer";

type ChatPreview = {
  id: string;
  title: string;
  lastMessageAt: string | null;
  updatedAt: string;
  recordsCount: number;
  latestRecord: {
    role: "USER" | "ASSISTANT";
    transcript: string | null;
  } | null;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  transcript: string | null;
  audioUrl: string | null;
  createdAt: string;
};

type ActiveChat = {
  id: string;
  title: string;
  records: ChatMessage[];
} | null;

type DashboardShellProps = {
  activeChatId?: string;
  activeChat: ActiveChat;
  chats: ChatPreview[];
  billing: {
    hasActiveSubscription: boolean;
    canCreateVoiceNote: boolean;
    freeVoiceNotesLimit: number;
    freeVoiceNotesRemaining: number;
    userVoiceNotesCount: number;
    guestFreeCallUsed: boolean;
    subscriptionStatus: string;
  };
  userEmail: string;
};

type PendingTurn = {
  localAudioUrl: string;
};

function formatTimestamp(date: string | null | undefined) {
  if (!date) {
    return "No messages yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function DashboardShell({
  activeChatId,
  activeChat,
  chats,
  billing,
  userEmail,
}: DashboardShellProps) {
  const router = useRouter();
  const [localChats, setLocalChats] = useState(chats);
  const [localActiveChat, setLocalActiveChat] = useState(activeChat);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(activeChat?.title ?? "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isBillingRedirecting, setIsBillingRedirecting] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    setLocalChats(chats);
  }, [chats]);

  useEffect(() => {
    setLocalActiveChat(activeChat);
    setDraftTitle(activeChat?.title ?? "");
    setIsEditingTitle(false);
  }, [activeChat]);

  useEffect(() => {
    return () => {
      if (pendingTurn?.localAudioUrl) {
        URL.revokeObjectURL(pendingTurn.localAudioUrl);
      }
    };
  }, [pendingTurn]);

  const renderedMessages = useMemo(() => {
    const baseMessages = localActiveChat?.records ?? [];

    if (!pendingTurn) {
      return baseMessages;
    }

    return [
      ...baseMessages,
      {
        id: "pending-user",
        role: "USER" as const,
        transcript: null,
        audioUrl: pendingTurn.localAudioUrl,
        createdAt: new Date().toISOString(),
      },
      {
        id: "pending-ai",
        role: "ASSISTANT" as const,
        transcript: "__LOADING__",
        audioUrl: null,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [localActiveChat?.records, pendingTurn]);

  async function saveTitle() {
    if (!localActiveChat) {
      return;
    }

    const normalizedTitle = draftTitle.replace(/\s+/g, " ").trim();

    if (!normalizedTitle) {
      return;
    }

    setIsSavingTitle(true);

    try {
      const response = await fetch(`/api/chats/${localActiveChat.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: normalizedTitle,
        }),
      });

      const payload = (await response.json()) as { title?: string; error?: string };

      if (!response.ok || !payload.title) {
        throw new Error(payload.error ?? "Failed to rename chat.");
      }

      setLocalActiveChat((current) =>
        current ? { ...current, title: payload.title ?? normalizedTitle } : current,
      );
      setLocalChats((current) =>
        current.map((chat) =>
          chat.id === localActiveChat.id
            ? { ...chat, title: payload.title ?? normalizedTitle }
            : chat,
        ),
      );
      setDraftTitle(payload.title);
      setIsEditingTitle(false);
      router.refresh();
    } catch {
      setDraftTitle(localActiveChat.title);
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function openBillingFlow(endpoint: "/api/stripe/checkout" | "/api/stripe/portal") {
    setIsBillingRedirecting(true);
    setBillingError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to open billing.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Failed to open billing.");
      setIsBillingRedirecting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_30%),linear-gradient(180deg,#0a0a0f,#09090b)] text-white">
      <div className="grid min-h-screen lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-white/10 bg-black/20 px-4 py-5 backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
                <Waves className="size-5" />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">VoiceGPT</p>
                <p className="text-xs text-zinc-400">Speech-first workspace</p>
              </div>
            </div>
            <UserButton />
          </div>

          <Link
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            href="/dashboard"
          >
            <Plus className="size-4" />
            New voice chat
          </Link>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-300">Signed in as</p>
            <p className="mt-1 font-medium text-white">{userEmail}</p>
            <p className="mt-2 text-xs text-zinc-400">
              Record, preview, send, then wait for the AI transcript to land in the chat.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">Stripe access</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {billing.hasActiveSubscription
                    ? "Subscription is active. Unlimited voice notes are unlocked."
                    : billing.freeVoiceNotesRemaining > 0
                      ? `You still have ${billing.freeVoiceNotesRemaining} free voice note left.`
                      : "Your free voice note is used. Upgrade to continue."}
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                  billing.hasActiveSubscription
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-amber-500/15 text-amber-200"
                }`}
              >
                {billing.hasActiveSubscription ? billing.subscriptionStatus : "FREE"}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {billing.hasActiveSubscription ? (
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBillingRedirecting}
                  onClick={() => openBillingFlow("/api/stripe/portal")}
                  type="button"
                >
                  {isBillingRedirecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Manage billing
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBillingRedirecting}
                  onClick={() => openBillingFlow("/api/stripe/checkout")}
                  type="button"
                >
                  {isBillingRedirecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Upgrade with Stripe
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Usage: {billing.userVoiceNotesCount}/{billing.freeVoiceNotesLimit} free voice notes used.
            </p>

            {billingError ? (
              <p className="mt-2 text-xs text-rose-300">{billingError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            {localChats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">
                No chats yet. Start recording and your first voice note will appear here.
              </div>
            ) : (
              localChats.map((chat) => {
                const latestText =
                  chat.latestRecord?.role === "USER"
                    ? "You sent a voice note"
                    : chat.latestRecord?.transcript ?? "No transcript yet";
                const isActive = chat.id === localActiveChat?.id;

                return (
                  <Link
                    className={`block rounded-2xl border px-4 py-3 transition ${
                      isActive
                        ? "border-violet-400/60 bg-violet-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    href={`/dashboard?chat=${chat.id}`}
                    key={chat.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-medium text-white">{chat.title}</p>
                      <span className="text-[11px] text-zinc-400">{chat.recordsCount}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                      {chat.latestRecord?.role === "ASSISTANT" ? "AI: " : "You: "}
                      {latestText}
                    </p>
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {formatTimestamp(chat.lastMessageAt)}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p className="font-heading text-2xl font-semibold">
                {isEditingTitle && localActiveChat ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none"
                      onChange={(event) => setDraftTitle(event.target.value)}
                      value={draftTitle}
                    />
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none disabled:hover:bg-white/5"
                      disabled={isSavingTitle}
                      onClick={saveTitle}
                      type="button"
                    >
                      {isSavingTitle ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none disabled:hover:bg-white/5"
                      disabled={isSavingTitle}
                      onClick={() => {
                        setDraftTitle(localActiveChat.title);
                        setIsEditingTitle(false);
                      }}
                      type="button"
                    >
                      <X className="size-4" />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span>{localActiveChat?.title ?? "New voice chat"}</span>
                    {localActiveChat ? (
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                        onClick={() => setIsEditingTitle(true)}
                        type="button"
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : null}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Record a voice note, review it, send it, and wait for the transcript message from
                AI.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 md:flex">
              <Mic className="size-4 text-violet-300" />
              Voice input only
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-between gap-6 px-6 py-6">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {renderedMessages.length > 0 ? (
                renderedMessages.map((record) => {
                  const isPendingAssistant =
                    record.role === "ASSISTANT" && record.transcript === "__LOADING__";

                  return (
                    <article
                      className={`max-w-3xl rounded-[1.75rem] border p-5 shadow-lg shadow-black/20 ${
                        record.role === "ASSISTANT"
                          ? "mr-auto border-cyan-400/20 bg-cyan-400/10"
                          : "ml-auto border-violet-400/20 bg-violet-500/15"
                      }`}
                      key={record.id}
                    >
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            record.role === "ASSISTANT"
                              ? "bg-cyan-400/15 text-cyan-100"
                              : "bg-violet-500/20 text-violet-100"
                          }`}
                        >
                          {record.role === "ASSISTANT" ? "AI transcript" : "Your voice note"}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatTimestamp(record.createdAt)}
                        </span>
                      </div>

                      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-300">
                        {record.role === "ASSISTANT" ? (
                          <>
                            <Bot className="size-3.5 text-cyan-200" />
                            <span>OpenRouter transcription</span>
                          </>
                        ) : (
                          <>
                            <Mic className="size-3.5 text-violet-200" />
                            <span>User voice note</span>
                          </>
                        )}
                      </div>

                      {record.role === "USER" ? (
                        <audio className="w-full" controls preload="metadata" src={record.audioUrl ?? undefined}>
                          <track kind="captions" />
                        </audio>
                      ) : isPendingAssistant ? (
                        <div className="flex items-center gap-3 text-sm text-cyan-50">
                          <Loader2 className="size-4 animate-spin" />
                          <span>AI is transcribing your voice note...</span>
                        </div>
                      ) : (
                        <p className="text-sm leading-7 text-zinc-100">{record.transcript}</p>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/3 px-8 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-violet-500/15 text-violet-200">
                    <Mic className="size-8" />
                  </div>
                  <h2 className="mt-5 font-heading text-3xl font-semibold">
                    Start your first voice note
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
                    Record your voice, preview the clip, send it, and the AI transcript will appear
                    as the next message in the chat.
                  </p>
                </div>
              )}
            </div>

            <VoiceChatComposer
              activeChatId={localActiveChat?.id ?? activeChatId}
              sendDisabledReason={
                billing.canCreateVoiceNote
                  ? null
                  : "Your free voice note is used. Upgrade with Stripe to continue."
              }
              onSendComplete={(result: VoiceComposerSendResult) => {
                if (result.mode !== "authenticated") {
                  return;
                }

                setLocalActiveChat((current) => {
                  const baseRecords = current?.id === result.chatId ? current.records : [];

                  return {
                    id: result.chatId,
                    title: result.chatTitle,
                    records: [
                      ...baseRecords.filter(
                        (record) =>
                          record.id !== "pending-user" && record.id !== "pending-ai",
                      ),
                      result.userMessage,
                      result.assistantMessage,
                    ],
                  };
                });
                setLocalChats((current) => {
                  const nextPreview = {
                    id: result.chatId,
                    title: result.chatTitle,
                    lastMessageAt: result.lastMessageAt,
                    updatedAt: result.lastMessageAt,
                    recordsCount:
                      (current.find((chat) => chat.id === result.chatId)?.recordsCount ?? 0) + 2,
                    latestRecord: {
                      role: result.assistantMessage.role,
                      transcript: result.assistantMessage.transcript,
                    },
                  };

                  const remainingChats = current.filter((chat) => chat.id !== result.chatId);

                  return [nextPreview, ...remainingChats];
                });
                setPendingTurn(null);
                router.push(`/dashboard?chat=${result.chatId}`);
                router.refresh();
              }}
              onSendError={() => {
                setPendingTurn(null);
              }}
              onSendStart={(localAudioUrl) => {
                setPendingTurn({ localAudioUrl });
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
