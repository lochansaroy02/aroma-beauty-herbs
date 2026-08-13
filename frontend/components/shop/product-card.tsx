import { ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { WishlistButton } from "@/components/shop/wishlist-button";
import {
  formatPrice,
  type ProductCard as ProductCardData,
  type ProductListItem,
} from "@/lib/catalog";

/** Works for both the listing shape and the compact card the cart returns. */
type Product = ProductListItem | ProductCardData;

function imageOf(product: Product) {
  return "primary_image" in product ? product.primary_image : product.image;
}

/**
 * A product in a grid.
 *
 * No card chrome: the shop sets images flush on paper and lets the whitespace
 * do the separating, the same way the homepage's featured row does. A white
 * rounded panel here would read as the admin's surface on the shop's ground.
 */
export function ProductCard({ product, saved }: { product: Product; saved: boolean }) {
  const image = imageOf(product);
  const href = `/products/${product.slug}`;
  const discounted =
    product.price?.mrp != null &&
    product.price.sale_price != null &&
    product.price.mrp > product.price.sale_price;

  return (
    <div className="group grid content-start gap-4">
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.product_name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-clay">
            <ImageIcon className="size-8" strokeWidth={1.25} />
          </div>
        )}

        {/* z-10 is load-bearing: the tile-wide link below is a later sibling,
            and among positioned elements at z-index auto the later one paints
            on top. Without it the link swallows every click on the heart and
            navigates instead of saving. */}
        <WishlistButton
          productId={product.id}
          saved={saved}
          className="absolute right-2 top-2 z-10"
        />

        {!product.in_stock ? (
          <span className="absolute left-0 top-3 z-10 bg-ink px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase">
            Out of stock
          </span>
        ) : null}

        {/* The whole image is a link, under the controls above. */}
        <Link href={href} className="absolute inset-0" aria-label={product.product_name}>
          <span className="sr-only">{product.product_name}</span>
        </Link>
      </div>

      <div className="grid gap-1.5">
        <Link
          href={href}
          className="font-heading text-lg leading-tight text-ink underline-offset-4 hover:underline"
        >
          {product.product_name}
        </Link>

        {product.brand?.name ? (
          <p className="font-mono text-[10px] tracking-[0.18em] text-clay uppercase">
            {product.brand.name}
          </p>
        ) : null}

        <div className="mt-0.5 flex items-baseline gap-2">
          {product.price ? (
            <>
              {product.price.from ? (
                <span className="font-mono text-[10px] tracking-[0.14em] text-clay uppercase">
                  from
                </span>
              ) : null}
              <span className="text-[15px] text-ink tabular-nums">
                {formatPrice(product.price.sale_price)}
              </span>
              {discounted ? (
                <span className="text-xs text-clay line-through tabular-nums">
                  {formatPrice(product.price.mrp)}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-ink-soft">Price on request</span>
          )}
        </div>
      </div>

      <AddToCartButton
        productId={product.id}
        size="sm"
        disabled={!product.in_stock}
        label={product.in_stock ? "Add to cart" : "Out of stock"}
      />
    </div>
  );
}
