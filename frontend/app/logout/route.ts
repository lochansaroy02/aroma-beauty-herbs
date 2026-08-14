import { NextResponse } from "next/server";

import { destroySession } from "@/lib/session";

/**
 * Clears the session cookie and sends the visitor to the login page.
 *
 * Exists because a *render* can't touch cookies — only a Server Action or a
 * Route Handler can. A page that discovers its token is dead therefore has
 * nowhere to drop it, and redirecting straight to /login doesn't help: proxy.ts
 * routes on the cookie's presence alone, so it bounces the visitor to /products
 * and they can never sign in again without clearing site data. Redirecting here
 * instead breaks that loop.
 *
 * `logoutAction` remains the path for a deliberate sign-out from a form.
 */
export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
