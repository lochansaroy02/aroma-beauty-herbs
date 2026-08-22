import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "abh_session";

/**
 * Optimistic routing only — presence of the cookie, not proof it's valid.
 * The admin layout still confirms the session against the API before trusting
 * it, so this is a redirect for the common case, never the security boundary.
 *
 * Only /admin is guarded now. The shop pages are public and stateless: there is
 * no cart, no wishlist, no order history and no customer account to protect.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already signed in: /login has nothing to offer, so go where they were going.
  if (hasSession && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // "/admin" is listed alongside "/admin/:path*" so the dashboard root is
  // guarded too, not just its subpaths.
  matcher: ["/admin", "/admin/:path*", "/login"],
};
