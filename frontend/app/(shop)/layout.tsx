import Link from "next/link";

import { SiteHeader } from "@/components/shop/site-header";
import { fetchCart, fetchWishlist } from "@/lib/cart";
import { fetchHome } from "@/lib/home";
import { getSessionToken } from "@/lib/session";

const FOOTER_LINKS = [
  { href: "/products", label: "Shop" },
  { href: "/our-story", label: "Our story" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/faqs", label: "FAQs" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
] as const;

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  // Cart and wishlist return empty for a signed-out visitor, and the home
  // fetch is only here for the announcement bar, which sits above every page.
  const [token, cart, wishlist, home] = await Promise.all([
    getSessionToken(),
    fetchCart(),
    fetchWishlist(),
    fetchHome(),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper text-ink">
      <SiteHeader
        cartCount={cart.summary.total_quantity}
        wishlistCount={wishlist.count}
        signedIn={Boolean(token)}
        // The bar lives in the header, but its show/hide switch is in
        // Customisation alongside the other blocks, so honour it here.
        announcement={
          home.sections.find((section) => section.key === "announcement")?.is_visible === false
            ? null
            : home.announcement
        }
      />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink/10 bg-paper-deep">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p
              className="font-heading text-3xl leading-none text-ink"
              style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1, "opsz" 48' }}
            >
              Aroma Beauty Herbs
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
              Treatments and elixirs blended in small batches from plants we can name.
              Made in India.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
              Explore
            </p>
            <ul className="mt-5 grid gap-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-ink/10">
          <p className="mx-auto w-full max-w-7xl px-6 py-6 font-mono text-[11px] tracking-[0.14em] text-clay uppercase sm:px-10">
            © {new Date().getFullYear()} Aroma Beauty Herbs
          </p>
        </div>
      </footer>
    </div>
  );
}
