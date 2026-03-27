import { prisma } from '@/lib/prisma';

function buildChatTitle(transcript: string) {
  const normalized = transcript.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return 'New voice chat';
  }

  return normalized.slice(0, 48);
}

export async function getUserChats(userId: string) {
  return prisma.chat.findMany({
    where: {
      userId,
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      records: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      _count: {
        select: {
          records: true,
        },
      },
    },
  });
}

export async function getChatById(userId: string, chatId: string) {
  return prisma.chat.findFirst({
    where: {
      id: chatId,
      userId,
    },
    include: {
      records: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

export async function updateChatTitle(params: {
  userId: string;
  chatId: string;
  title: string;
}) {
  const normalizedTitle = params.title.replace(/\s+/g, ' ').trim();

  if (!normalizedTitle) {
    throw new Error('Chat title cannot be empty.');
  }

  const result = await prisma.chat.updateMany({
    where: {
      id: params.chatId,
      userId: params.userId,
    },
    data: {
      title: normalizedTitle.slice(0, 80),
    },
  });

  if (result.count === 0) {
    throw new Error('Chat not found.');
  }
}

export async function createVoiceConversationTurn(params: {
  userId: string;
  chatId?: string | null;
  audioDataUrl: string;
  transcript: string;
  isFreeTier: boolean;
}) {
  const normalizedTranscript = params.transcript.replace(/\s+/g, ' ').trim();

  if (!params.audioDataUrl || !normalizedTranscript) {
    throw new Error('Audio data and transcript cannot be empty.');
  }

  return prisma.$transaction(async (tx) => {
    let chatId = params.chatId ?? null;

    if (chatId) {
      const existingChat = await tx.chat.findFirst({
        where: {
          id: chatId,
          userId: params.userId,
        },
        select: {
          id: true,
        },
      });

      if (!existingChat) {
        chatId = null;
      }
    }

    if (!chatId) {
      const chat = await tx.chat.create({
        data: {
          userId: params.userId,
          title: buildChatTitle(normalizedTranscript),
          lastMessageAt: new Date(),
        },
      });

      chatId = chat.id;
    }

    const record = await tx.record.create({
      data: {
        userId: params.userId,
        chatId,
        role: 'USER',
        audioUrl: params.audioDataUrl,
        transcript: normalizedTranscript,
        isFreeTier: params.isFreeTier,
      },
    });

    const assistantRecord = await tx.record.create({
      data: {
        userId: params.userId,
        chatId,
        role: 'ASSISTANT',
        transcript: normalizedTranscript,
        isFreeTier: params.isFreeTier,
      },
    });

    const updatedChat = await tx.chat.update({
      where: {
        id: chatId,
      },
      data: {
        lastMessageAt: assistantRecord.createdAt,
      },
    });

    return {
      chatId,
      chatTitle: updatedChat.title,
      recordId: record.id,
      assistantRecordId: assistantRecord.id,
      transcript: record.transcript,
      audioUrl: record.audioUrl,
      userMessage: {
        id: record.id,
        role: record.role,
        transcript: record.transcript,
        audioUrl: record.audioUrl,
        createdAt: record.createdAt.toISOString(),
      },
      assistantMessage: {
        id: assistantRecord.id,
        role: assistantRecord.role,
        transcript: assistantRecord.transcript,
        audioUrl: assistantRecord.audioUrl,
        createdAt: assistantRecord.createdAt.toISOString(),
      },
      lastMessageAt:
        updatedChat.lastMessageAt?.toISOString() ??
        assistantRecord.createdAt.toISOString(),
    };
  });
}
