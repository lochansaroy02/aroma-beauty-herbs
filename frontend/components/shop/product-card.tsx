import { LeafIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ShopNowButton } from "@/components/shop/shop-now-button";
import { formatPrice } from "@/lib/catalog";
import type { ShopProduct } from "@/lib/shop-api";

/**
 * A product in the grid.
 *
 * No card chrome: the shop sets images flush on paper and lets the whitespace
 * do the separating, the same way the homepage's featured row does. A white
 * rounded panel here would read as the admin's surface on the shop's ground.
 *
 * The image and title link to our own detail page — that's where the full
 * description lives. Only "Shop now" leaves the site.
 */
export function ProductCard({ product }: { product: ShopProduct }) {
  const image = product.images[0];
  const href = `/products/${product.slug}`;

  return (
    <div className="group grid content-start gap-4">
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
        {image ? (
          <Image
            src={image.url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-clay">
            <LeafIcon className="size-8" strokeWidth={1.25} />
          </div>
        )}

        {!product.in_stock ? (
          <span className="absolute left-0 top-3 z-10 bg-ink px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase">
            Out of stock
          </span>
        ) : null}

        <Link href={href} className="absolute inset-0" aria-label={product.name}>
          <span className="sr-only">{product.name}</span>
        </Link>
      </div>

      <div className="grid gap-1.5">
        <Link
          href={href}
          className="font-heading text-lg leading-tight text-ink underline-offset-4 hover:underline"
        >
          {product.name}
        </Link>

        {product.category_name ? (
          <p className="font-mono text-[10px] tracking-[0.18em] text-clay uppercase">
            {product.category_name}
          </p>
        ) : null}

        <div className="mt-0.5 flex items-baseline gap-2">
          {product.sale_price !== null ? (
            <>
              <span className="text-[15px] text-ink tabular-nums">
                {formatPrice(product.sale_price)}
              </span>
              {product.discounted ? (
                <span className="text-xs text-clay line-through tabular-nums">
                  {formatPrice(product.mrp)}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-ink-soft">Price on request</span>
          )}
        </div>
      </div>

      <ShopNowButton href={product.shop_url} inStock={product.in_stock} size="sm" />
    </div>
  );
}
