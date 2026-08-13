import Link from "next/link";

import { cn } from "@/lib/utils";

import type { HomeHero } from "@/lib/catalog";

/**
 * The hero is a single silent looping video, full-bleed, with the wordmark
 * treatment carried into a large Fraunces setting over it. Autoplay is only
 * legal muted, and muted video with no controls is decoration — so the copy
 * and the link never depend on it having loaded.
 */
export function HeroVideo({ hero, layout = "full" }: { hero: HomeHero; layout?: string }) {
  // "contained" insets the whole block; "split" stands the wording beside the
  // video instead of over it, which suits a busier clip.
  const contained = layout === "contained";
  const split = layout === "split";
  const href = hero.url ?? "/products";
  const title = hero.title ?? "Skincare, rooted in herbs";

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden bg-ink",
        contained
          ? "mx-4 mt-4 min-h-[62svh] rounded-3xl sm:mx-6 lg:min-h-[70svh]"
          : "min-h-[78svh] lg:min-h-[86svh]"
      )}
    >
      <video
        className="absolute inset-0 size-full object-cover"
        src={hero.video.url}
        poster={hero.video.thumbnail_url ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        // Decorative: everything it conveys is also in the text below.
        aria-hidden
        tabIndex={-1}
      />

      {/* Gradient rather than a flat scrim, so the top of the frame stays
          legible while the video still reads at the bottom. */}
      <div
        className={cn(
          "absolute inset-0",
          split
            ? "bg-gradient-to-r from-ink/90 via-ink/60 to-ink/10"
            : "bg-gradient-to-t from-ink/85 via-ink/25 to-ink/40"
        )}
        aria-hidden
      />

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-7xl flex-col px-6 sm:px-10",
          split ? "justify-center" : "justify-end",
          contained
            ? "min-h-[62svh] pb-12 lg:min-h-[70svh] lg:pb-16"
            : "min-h-[78svh] pb-16 lg:min-h-[86svh] lg:pb-24"
        )}
      >
        <div className={cn(split ? "max-w-lg" : "max-w-2xl")}>
          <h1
            className="font-heading text-[clamp(2.6rem,7vw,5.25rem)] leading-[0.95] text-paper text-balance"
            style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1, "opsz" 144' }}
          >
            {title}
          </h1>

          {hero.subtitle ? (
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-paper/80">
              {hero.subtitle}
            </p>
          ) : null}

          <Link
            href={href}
            className="mt-9 inline-flex items-center gap-3 bg-paper px-8 py-4 font-mono text-[11px] tracking-[0.2em] text-ink uppercase transition-colors hover:bg-leaf hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
          >
            {hero.cta_label || "Shop now"}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Shown when no video has been uploaded — the layout still has to hold. */
export function HeroFallback() {
  return (
    <section className="relative isolate flex min-h-[62svh] items-end overflow-hidden bg-ink">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 15% 10%, oklch(0.36 0.05 160) 0%, transparent 60%), radial-gradient(100% 80% at 85% 90%, oklch(0.3 0.04 120) 0%, transparent 65%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 sm:px-10">
        <h1
          className="max-w-2xl font-heading text-[clamp(2.6rem,7vw,5.25rem)] leading-[0.95] text-paper text-balance"
          style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1, "opsz" 144' }}
        >
          Skincare, rooted in herbs
        </h1>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-paper/75">
          Add a hero video from Admin → Videos and it plays here.
        </p>

        <Link
          href="/products"
          className="mt-9 inline-flex items-center bg-paper px-8 py-4 font-mono text-[11px] tracking-[0.2em] text-ink uppercase transition-colors hover:bg-leaf hover:text-paper"
        >
          Shop now
        </Link>
      </div>
    </section>
  );
}
