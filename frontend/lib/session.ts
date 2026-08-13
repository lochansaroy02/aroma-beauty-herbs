import "server-only";
import { cookies } from "next/headers";

const SESSION_COOKIE = "abh_session";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

/**
 * Stores the API's JWT in an httpOnly cookie. Keeping it out of localStorage
 * means page scripts — including anything injected via XSS — can't read it.
 */
export async function createSession(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Dev runs over plain http, where a Secure cookie would be dropped.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
