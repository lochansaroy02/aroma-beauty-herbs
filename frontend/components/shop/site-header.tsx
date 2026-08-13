"use client";

import { ShoppingBagIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ProductSearch } from "@/components/shop/product-search";
import { cn } from "@/lib/utils";

type Props = {
  cartCount: number;
  wishlistCount: number;
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

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      className="absolute -right-1.5 -top-1 min-w-4 rounded-full bg-ink px-1 text-center font-mono text-[10px] leading-4 text-paper"
      aria-hidden
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function SiteHeader({ cartCount, wishlistCount, signedIn, announcement }: Props) {
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
            how wide the icon clusters get. */}
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center">
            <ProductSearch />
          </div>

          <Link
            href="/"
            className="justify-self-center px-2 font-heading text-[26px] leading-none tracking-[0.01em] text-ink sm:text-[32px]"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1, "opsz" 40' }}
          >
            Aroma
          </Link>

          <div className="flex items-center justify-end gap-1">
            <Link
              href={signedIn ? "/account" : "/login"}
              aria-label={signedIn ? "Your account" : "Log in"}
              className="relative rounded-full p-2 text-ink transition-colors hover:bg-ink/5"
            >
              <UserIcon className="size-[18px]" strokeWidth={1.5} />
              <CountBadge count={wishlistCount} />
            </Link>

            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative rounded-full p-2 text-ink transition-colors hover:bg-ink/5"
            >
              <ShoppingBagIcon className="size-[18px]" strokeWidth={1.5} />
              <CountBadge count={cartCount} />
            </Link>
          </div>
        </div>

        <nav
          aria-label="Main"
          className="mx-auto w-full max-w-7xl overflow-x-auto px-4 pb-3 sm:px-8"
        >
          <ul className="flex items-center justify-center gap-6 whitespace-nowrap sm:gap-9">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "inline-block border-b pb-0.5 text-[13px] transition-colors",
                    isActive(item.href)
                      ? "border-ink text-ink"
                      : "border-transparent text-ink-soft hover:text-ink"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
