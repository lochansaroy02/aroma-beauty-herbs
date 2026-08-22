"use client";

import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = {
  /** Drives the admin shortcut only — visitors never sign in to this site. */
  signedIn: boolean;
  announcement: { text: string; url: string | null } | null;
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  // { href: "/our-story", label: "Our story" },
  // { href: "/ingredients", label: "Ingredients" },
  // { href: "/faqs", label: "FAQs" },
  // { href: "/journal", label: "Journal" },
] as const;

export function SiteHeader({ signedIn, announcement }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40">
      {announcement ? (
        <div className="bg-ink px-4 py-2 text-center">
          {announcement.url ? (
            <Link
              href={announcement.url}
              className="font-mono text-[11px] tracking-[0.14em] text-paper/90 uppercase underline-offset-4 hover:underline"
            >
              {announcement.text}
            </Link>
          ) : (
            <p className="font-mono text-[11px] tracking-[0.14em] text-paper/90 uppercase">
              {announcement.text}
            </p>
          )}
        </div>
      ) : null}

      <div className="border-b border-ink/10 bg-paper/95 backdrop-blur">
        {/* Three equal columns keep the wordmark optically centred no matter
            how wide the icon cluster gets. The left column is deliberately
            empty — search went with the local catalogue, and four products need
            a nav, not a search box — but the column stays so the centre holds. */}
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-8">
          <div aria-hidden />

          <Link
            href="/"
            className="justify-self-center px-2 font-heading text-[26px] leading-none tracking-[0.01em] text-ink sm:text-[32px]"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1, "opsz" 40' }}
          >
            Aroma
          </Link>

          {/*
            No cart, no account: nothing is bought here. The only thing worth a
            slot is the way back to the admin, and only for someone already
            signed in — a "Log in" link on a landing page invites visitors to
            try an account they can't have.
          */}
          <div className="flex items-center justify-end gap-1">
            {signedIn ? (
              <Link
                href="/admin"
                aria-label="Admin"
                className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
              >
                <LayoutDashboardIcon className="size-[18px]" strokeWidth={1.5} />
              </Link>
            ) : null}
          </div>
        </div>

        <nav
          aria-label="Main"
          className="mx-auto w-full max-w-7xl overflow-x-auto px-4 pb-1 sm:px-8"
        >
          <ul className="flex items-center justify-center gap-6 whitespace-nowrap sm:gap-9">
            {NAV.map((item) => (
              <li key={item.href}>
                {/*
                  Padding on the link, underline on the span inside it. The tap
                  area needs to be finger-sized (this was 23px tall, which is a
                  miss as often as a hit); the rule under the word has to stay
                  tight to the word. Splitting them lets both be true.
                */}
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center px-1 py-2.5 text-[13px] transition-colors",
                    isActive(item.href) ? "text-ink" : "text-ink-soft hover:text-ink"
                  )}
                >
                  <span
                    className={cn(
                      "border-b pb-0.5",
                      isActive(item.href) ? "border-ink" : "border-transparent"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
