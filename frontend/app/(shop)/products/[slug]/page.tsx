import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { fetchWishlist } from "@/lib/cart";
import { galleryOf } from "@/lib/catalog";
import { fetchProduct } from "@/lib/products";

export async function generateMetadata(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const result = await fetchProduct(slug);

  if (!result.ok) return { title: "Product — Aroma Beauty Herbs" };

  const { product } = result.data;
  return {
    title: product.meta_title ?? `${product.product_name} — Aroma Beauty Herbs`,
    description: product.meta_description ?? product.short_description ?? undefined,
  };
}

/**
 * Long-form copy is admin-authored HTML from the product editor.
 *
 * Safe to inject because the API sanitises on write against a tag allowlist
 * (backend/src/lib/sanitize.ts) — script, img, style and javascript: URLs never
 * reach the database. Styled in the shop's ink-on-paper scale rather than the
 * admin's tokens, so an admin's paragraph reads like the rest of the page.
 */
function Prose({ title, body }: { title: string; body: string | null }) {
  if (!body?.trim()) return null;

  return (
    <section className="border-t border-ink/10 pt-8">
      <h2 className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
        {title}
      </h2>
      <div
        className="mt-4 text-[15px] leading-relaxed text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-clay [&_blockquote]:pl-4 [&_blockquote]:text-ink [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:font-heading [&_h4]:text-base [&_h4]:text-ink [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </section>
  );
}

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;

  const [result, wishlist] = await Promise.all([fetchProduct(slug), fetchWishlist()]);

  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.error);
  }

  const { product } = result.data;
  const images = galleryOf(product);

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
          <span className="text-ink-soft">{product.product_name}</span>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <ProductGallery images={images} productName={product.product_name} />

          <div className="grid content-start gap-8 lg:pt-4">
            <div>
              {/* An eyebrow rather than a pill — the shop labels things in mono
                  caps, and a filled badge here reads as admin chrome. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.22em] uppercase">
                {product.brand?.name ? (
                  <span className="text-clay">{product.brand.name}</span>
                ) : null}
                {product.is_featured ? (
                  <span className="flex items-center gap-1.5 text-leaf">
                    <span className="size-1 rounded-full bg-leaf" aria-hidden />
                    Featured
                  </span>
                ) : null}
              </div>

              <h1
                className="mt-5 font-heading text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.04] text-ink text-balance"
                style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 96' }}
              >
                {product.product_name}
              </h1>

              {product.short_description ? (
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft text-pretty">
                  {product.short_description}
                </p>
              ) : null}
            </div>

            <ProductPurchase
              productId={product.id}
              variants={product.variants}
              saved={wishlist.product_ids.includes(product.id)}
            />

            <div className="grid gap-8">
              <Prose title="About this blend" body={product.description} />
              <Prose title="How to use" body={product.how_to_use} />
              <Prose title="Details" body={product.specific_item_info} />
            </div>

            <p className="font-mono text-[11px] tracking-[0.14em] text-clay uppercase">
              Code {product.product_code}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
