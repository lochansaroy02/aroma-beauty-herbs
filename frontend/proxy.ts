import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "abh_session";
const AUTH_ROUTES = ["/login", "/signup", "/verify"];

/**
 * Optimistic routing only — presence of the cookie, not proof it's valid.
 * Pages still confirm the session against the API before trusting it.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const needsSession =
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    // Cart, checkout, orders and wishlist belong to an account; the shop
    // itself stays public.
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wishlist");

  if (!hasSession && needsSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already signed in: the shop is the landing page. The role lives in the JWT,
  // which isn't readable here, so admins get routed on from /products.
  if (hasSession && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // "/admin" is listed alongside "/admin/:path*" so the dashboard root is
  // guarded too, not just its subpaths.
  matcher: [
    "/account/:path*",
    "/admin",
    "/admin/:path*",
    "/cart",
    "/cart/:path*",
    "/checkout",
    "/checkout/:path*",
    "/orders",
    "/orders/:path*",
    "/wishlist",
    "/wishlist/:path*",
    "/login",
    "/signup",
    "/verify",
  ],
};
