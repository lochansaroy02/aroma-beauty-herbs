import { LeafIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { formatPrice, type ProductCard } from "@/lib/catalog";

/**
 * The featured row.
 *
 * Which products appear and in what order is entirely the product record's
 * doing — the "Featured" toggle and "Order by" field on the product form — so
 * there's no second place to curate and no way for the two to disagree.
 */
export function FeaturedRow({
  products,
  layout = "row",
}: {
  products: ProductCard[];
  /** "row" keeps everything on one swipeable line; "grid" wraps. */
  layout?: string;
}) {
  return (
    <section className="bg-paper py-20 lg:py-28">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
            The range
          </p>
          <h2
            className="mt-4 font-heading text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] text-ink text-balance"
            style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 96' }}
          >
            Skincare for the soul
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-soft text-pretty">
            Treatments and elixirs blended in small batches from plants we can name.
            Made for every skin, every season, and every version of you.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="mx-auto mt-14 max-w-md border border-dashed border-ink/20 px-6 py-14 text-center">
            <LeafIcon className="mx-auto size-6 text-clay" strokeWidth={1.5} />
            <p className="mt-4 font-heading text-lg text-ink">Nothing featured yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              Tick <span className="text-ink">Featured</span> on a product and it appears
              here, in its <span className="text-ink">Order by</span> position.
            </p>
          </div>
        ) : (
          <ul
            className={cn(
              "mt-14",
              layout === "row"
                ? // One line that swipes on narrow screens. Padding on the
                  // scroller, not the items, so the last card can reach the edge.
                  "-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10 lg:gap-8"
                : "grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4 lg:gap-x-8"
            )}
          >
            {products.map((product) => (
              <li
                key={product.id}
                className={cn(
                  "group",
                  layout === "row" && "w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[calc((100%-3rem)/4)]"
                )}
              >
                <Link href={`/products/${product.slug}`} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
                    {product.image ? (
                      <Image
                        src={product.image.url}
                        alt={product.image.alt ?? product.product_name}
                        fill
                        sizes="(min-width: 1024px) 22vw, 45vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-clay">
                        <LeafIcon className="size-8" strokeWidth={1.25} />
                      </span>
                    )}

                    {!product.in_stock ? (
                      <span className="absolute left-3 top-3 bg-paper/95 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-ink uppercase">
                        Sold out
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-5 text-center font-heading text-[17px] leading-snug text-ink">
                    {product.product_name}
                  </h3>

                  <p className="mt-1.5 text-center font-mono text-[13px] text-ink-soft">
                    {product.price?.from ? "from " : ""}
                    {formatPrice(product.price?.sale_price ?? null)}
                  </p>
                </Link>

                <Link
                  href={`/products/${product.slug}`}
                  className="mt-5 block border border-ink/25 py-3 text-center font-mono text-[11px] tracking-[0.16em] text-ink uppercase transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                  {product.in_stock ? "Choose options" : "View"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
