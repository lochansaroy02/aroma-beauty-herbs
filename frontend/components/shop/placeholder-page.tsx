import Link from "next/link";

/**
 * A holding page for the nav items that don't have content yet.
 *
 * It says so plainly rather than dressing up lorem ipsum as a real page —
 * someone landing here should know it's coming, not think the site is broken.
 */
export function PlaceholderPage({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-28 text-center sm:px-10 lg:py-40">
      <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
        {eyebrow}
      </p>

      <h1
        className="mt-6 font-heading text-[clamp(2.25rem,6vw,4rem)] leading-[1.02] text-ink text-balance"
        style={{ fontVariationSettings: '"SOFT" 55, "WONK" 1, "opsz" 120' }}
      >
        {title}
      </h1>

      <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft text-pretty">
        {blurb}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/products"
          className="bg-ink px-8 py-4 font-mono text-[11px] tracking-[0.2em] text-paper uppercase transition-colors hover:bg-leaf"
        >
          Shop the range
        </Link>
        <Link
          href="/"
          className="border border-ink/25 px-8 py-4 font-mono text-[11px] tracking-[0.2em] text-ink uppercase transition-colors hover:border-ink"
        >
          Back home
        </Link>
      </div>

      <p className="mt-14 font-mono text-[11px] tracking-[0.16em] text-clay uppercase">
        This page is still being written
      </p>
    </div>
  );
}
