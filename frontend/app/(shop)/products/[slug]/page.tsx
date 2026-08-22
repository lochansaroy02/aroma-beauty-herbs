import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/shop/product-gallery";
import { ShopNowButton } from "@/components/shop/shop-now-button";
import { formatPrice } from "@/lib/catalog";
import { cleanRichText } from "@/lib/rich-text";
import { PRODUCT_KEYS, fetchShopProduct } from "@/lib/shop-api";

/**
 * The four keys, declared so Next knows the full set of product routes.
 *
 * These pages still render per request — the shop layout fetches the
 * announcement bar with no-store, which makes everything under it dynamic. What
 * actually spares the upstream API is the 5-minute fetch cache in `shop-api`,
 * not prerendering. Slugs outside this list are still served: the API resolves
 * a full slug as well as a keyword, so long-form links keep working.
 */
export function generateStaticParams() {
  return PRODUCT_KEYS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await fetchShopProduct(slug);

  if (!product) return { title: "Product — Aroma Beauty Herbs" };

  return {
    title: `${product.name} — Aroma Beauty Herbs`,
    description: product.short_description ?? undefined,
  };
}

/**
 * Long-form copy from the Barber Syndicate catalogue.
 *
 * The HTML is sanitised on the way in by `cleanRichText`, not trusted for
 * coming from a sibling site — script, style and javascript: URLs never reach
 * this markup. Styled in the shop's ink-on-paper scale so foreign copy reads
 * like the rest of the page.
 */
function Prose({ title, body }: { title: string; body: string | null }) {
  const clean = cleanRichText(body);
  if (!clean) return null;

  return (
    <section className="border-t border-ink/10 pt-8">
      <h2 className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
        {title}
      </h2>
      <div
        className="mt-4 text-[15px] leading-relaxed text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-clay [&_blockquote]:pl-4 [&_blockquote]:text-ink [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:font-heading [&_h4]:text-base [&_h4]:text-ink [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </section>
  );
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await fetchShopProduct(slug);

  if (!product) notFound();

  return (
    <div className="bg-paper">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10 lg:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-10 font-mono text-[11px] tracking-[0.14em] text-clay uppercase"
        >
          <Link href="/products" className="underline-offset-4 transition-colors hover:text-ink">
            Shop
          </Link>
          <span className="mx-2 text-ink/25">/</span>
          <span className="text-ink-soft">{product.name}</span>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <ProductGallery images={product.images} productName={product.name} />

          <div className="grid content-start gap-8 lg:pt-4">
            <div>
              {/* An eyebrow rather than a pill — the shop labels things in mono
                  caps, and a filled badge here reads as admin chrome. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.22em] uppercase">
                {product.category_name ? (
                  <span className="text-clay">{product.category_name}</span>
                ) : null}
                {!product.in_stock ? (
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <span className="size-1 rounded-full bg-clay" aria-hidden />
                    Out of stock
                  </span>
                ) : null}
              </div>

              <h1
                className="mt-5 font-heading text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.04] text-ink text-balance"
                style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 96' }}
              >
                {product.name}
              </h1>

              {product.short_description &&
              product.short_description !== product.name ? (
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft text-pretty">
                  {product.short_description}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5">
              <div className="flex items-baseline gap-3">
                <span className="font-heading text-3xl text-ink tabular-nums">
                  {formatPrice(product.sale_price)}
                </span>
                {product.discounted ? (
                  <span className="text-base text-clay line-through tabular-nums">
                    {formatPrice(product.mrp)}
                  </span>
                ) : null}
              </div>

              <ShopNowButton
                href={product.shop_url}
                inStock={product.in_stock}
                size="lg"
                className="w-full sm:w-auto sm:justify-self-start"
              />

              <p className="text-xs leading-relaxed text-ink-soft">
                Checkout is handled by Barber Syndicate, who stock and ship this range.
              </p>
            </div>

            <div className="grid gap-8">
              <Prose title="About this blend" body={product.description} />
              <Prose title="How to use" body={product.how_to_use} />
              <Prose title="Details" body={product.specific_item_info} />
            </div>

            {product.product_code ? (
              <p className="font-mono text-[11px] tracking-[0.14em] text-clay uppercase">
                Code {product.product_code}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
