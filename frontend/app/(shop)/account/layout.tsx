import { redirect } from "next/navigation";

import { AccountNav } from "@/components/shop/account/account-nav";
import { apiGet } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

type MeResponse = {
  user: { id: number; name: string | null; email: string };
};

/** "Lochan Kumar" → "LK". Two letters at most, so the circle stays a circle. */
function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The shell every account page renders inside.
 *
 * The session is proven here rather than in each page: one round trip for the
 * whole area, and a new page added under /account can't forget the check. The
 * pages below still read the token, but only to fetch their own data.
 */
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await apiGet<MeResponse>("/auth/me", token);

  if (!result.ok) {
    /**
     * Via /logout, which drops the cookie on the way past.
     *
     * Redirecting straight to /login would loop: proxy.ts routes on the
     * cookie's presence alone, so a dead token bounces to /products and the
     * visitor can never sign in again. A render can't clear a cookie itself —
     * only a Route Handler can — hence the hop.
     *
     * A 0 status means the API was unreachable rather than the token refused;
     * the session may be perfectly good, so it is kept and only the sign-in
     * page is offered.
     */
    redirect(result.status === 0 ? "/login" : "/logout");
  }

  const { user } = result.data;

  return (
    <div className="bg-paper-deep">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
          {/*
            `lg:sticky` keeps the nav in reach on the long order list without
            taking the page over on a phone, where it simply sits on top.
          */}
          <aside className="rounded-2xl border border-ink/10 bg-paper-deep p-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
              <div
                aria-hidden
                className="grid size-14 shrink-0 place-content-center rounded-full bg-ink font-heading text-lg text-paper lg:size-20 lg:text-2xl"
              >
                {initials(user.name, user.email)}
              </div>

              <div className="min-w-0">
                <p className="font-heading text-lg leading-tight text-ink">
                  {user.name ?? "Your account"}
                </p>
                {/* break-all: a long address must wrap rather than widen the column. */}
                <p className="mt-1 text-sm break-all text-ink-soft">{user.email}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-ink/10 pt-5">
              <AccountNav />
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
