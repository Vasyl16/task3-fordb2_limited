import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getBillingState } from "@/lib/billing";
import { getChatById, getUserChats } from "@/lib/db/chats";
import { getCurrentDbUser } from "@/lib/db/users";
import { hasGuestFreeCallInCookieStore } from "@/lib/guest-access";

type DashboardPageProps = {
  searchParams: Promise<{
    chat?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const chats = await getUserChats(dbUser.id);
  const billing = await getBillingState(dbUser.id, {
    guestFreeCallUsed: hasGuestFreeCallInCookieStore(cookieStore),
  });
  const activeChatId = resolvedSearchParams.chat;
  const activeChat = activeChatId ? await getChatById(dbUser.id, activeChatId) : null;

  return (
    <DashboardShell
      activeChat={activeChat
        ? {
            id: activeChat.id,
            title: activeChat.title,
            records: activeChat.records.map((record) => ({
              id: record.id,
              role: record.role,
              transcript: record.transcript,
              audioUrl: record.audioUrl,
              createdAt: record.createdAt.toISOString(),
            })),
          }
        : null}
      activeChatId={activeChat?.id}
      chats={chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        lastMessageAt: chat.lastMessageAt ? chat.lastMessageAt.toISOString() : null,
        updatedAt: chat.updatedAt.toISOString(),
        recordsCount: chat._count.records,
        latestRecord: chat.records[0]
          ? {
              role: chat.records[0].role,
              transcript: chat.records[0].transcript,
            }
          : null,
      }))}
      billing={billing}
      userEmail={dbUser.email}
    />
  );
}
