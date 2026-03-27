import { NextResponse } from 'next/server';
import { createVoiceConversationTurn } from '@/lib/db/chats';
import { getBillingState } from '@/lib/billing';
import { getCurrentDbUser } from '@/lib/db/users';
import { transcribeAudioWithOpenRouter } from '@/lib/openrouter';

const GUEST_FREE_CALL_COOKIE = 'guest-voice-free-used';

function resolveAudioFormat(mimeType: string, fileName: string) {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedMime.includes('ogg') || normalizedFileName.endsWith('.ogg')) {
    return 'ogg';
  }

  if (normalizedMime.includes('mpeg') || normalizedFileName.endsWith('.mp3')) {
    return 'mp3';
  }

  if (normalizedMime.includes('wav') || normalizedFileName.endsWith('.wav')) {
    return 'wav';
  }

  if (
    normalizedMime.includes('mp4') ||
    normalizedMime.includes('m4a') ||
    normalizedFileName.endsWith('.m4a')
  ) {
    return 'm4a';
  }

  if (normalizedMime.includes('webm') || normalizedFileName.endsWith('.webm')) {
    return 'webm';
  }

  return null;
}

function hasGuestFreeCallBeenUsed(request: Request) {
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${GUEST_FREE_CALL_COOKIE}=1`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const chatId = formData.get('chatId');
  const audio = formData.get('audio');

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: 'Audio file is required' },
      { status: 400 },
    );
  }

  const format = resolveAudioFormat(audio.type, audio.name);

  if (!format) {
    return NextResponse.json(
      { error: 'Unsupported audio format. Use ogg, mp3, wav, m4a, or webm.' },
      { status: 400 },
    );
  }

  try {
    const dbUser = await getCurrentDbUser();
    const buffer = Buffer.from(await audio.arrayBuffer());
    const transcript = await transcribeAudioWithOpenRouter({
      audioBase64: buffer.toString('base64'),
      format,
    });

    if (!dbUser) {
      if (hasGuestFreeCallBeenUsed(request)) {
        return NextResponse.json(
          {
            error:
              'Your free guest voice-to-text is already used. Sign in to continue and unlock subscriptions.',
          },
          { status: 402 },
        );
      }

      const guestResponse = NextResponse.json(
        {
          mode: 'guest',
          transcript,
          remainingFreeGuestCalls: 0,
        },
        { status: 200 },
      );
      guestResponse.cookies.set(GUEST_FREE_CALL_COOKIE, '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });

      return guestResponse;
    }

    const billingState = await getBillingState(dbUser.id);

    if (!billingState.canCreateVoiceNote) {
      return NextResponse.json(
        {
          error: 'Your free voice note is already used. Start a Stripe subscription to continue.',
        },
        { status: 402 },
      );
    }

    const mimeType = audio.type || `audio/${format}`;
    const audioDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const result = await createVoiceConversationTurn({
      userId: dbUser.id,
      chatId: typeof chatId === 'string' && chatId.length > 0 ? chatId : null,
      audioDataUrl,
      transcript,
      isFreeTier: !billingState.hasActiveSubscription,
    });

    return NextResponse.json({ mode: 'authenticated', ...result }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to save the voice transcript.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
