import { NextResponse } from 'next/server';
import { updateChatTitle } from '@/lib/db/chats';
import { getCurrentDbUser } from '@/lib/db/users';

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { chatId } = await context.params;
  const body = (await request.json()) as { title?: string };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }

  try {
    await updateChatTitle({
      userId: dbUser.id,
      chatId,
      title: body.title,
    });

    return NextResponse.json(
      { chatId, title: body.title.replace(/\s+/g, ' ').trim().slice(0, 80) },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update chat title.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
