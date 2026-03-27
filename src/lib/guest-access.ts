import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export const GUEST_FREE_CALL_COOKIE = 'guest-voice-free-used';

export function hasGuestFreeCallCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${GUEST_FREE_CALL_COOKIE}=1`);
}

export function hasGuestFreeCallInCookieStore(cookieStore: Pick<ReadonlyRequestCookies, 'get'>) {
  return cookieStore.get(GUEST_FREE_CALL_COOKIE)?.value === '1';
}
