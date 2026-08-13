import type { HomeStrip } from "@/lib/catalog";

/**
 * The scrolling band between sections — the page's recurring motif.
 *
 * Set in mono with wide tracking and a leaf between repeats, so it reads like
 * tape on an apothecary jar rather than a ticker. The track holds two identical
 * halves and slides exactly -50%, which loops seamlessly at any width without
 * measuring anything in JavaScript.
 */
export function MarqueeStrip({ strip }: { strip: HomeStrip }) {
  // Tone is a property of the strip now, set per band in Admin -> Customisation,
  // rather than decided by where it happens to sit on the page.
  const tone = strip.tone;
  // One repeat per ~22 characters keeps density even for short and long text.
  const repeats = Math.max(4, Math.ceil(64 / Math.max(strip.text.length, 8)));
  const items = Array.from({ length: repeats });

  // An explicit speed wins; otherwise longer text gets longer to travel the
  // same distance, or it reads as rushed.
  const duration =
    strip.speed ?? Math.round(Math.min(70, Math.max(26, strip.text.length * 1.6)));

  const half = (key: string) => (
    <div className="flex shrink-0 items-center" key={key} aria-hidden={key === "b"}>
      {items.map((_, index) => (
        <span key={index} className="flex items-center">
          <span className="px-6 py-3 font-mono text-[11px] tracking-[0.22em] uppercase sm:text-xs">
            {strip.text}
          </span>
          <svg
            viewBox="0 0 12 12"
            className="size-2 shrink-0 opacity-55"
            aria-hidden
            fill="currentColor"
          >
            {/* A leaf, not a bullet — the divider should belong to the subject. */}
            <path d="M11 1C5.5 1 1 3.7 1 8.2c0 1 .2 1.9.6 2.8C3.2 7.4 6 5.2 9.4 4.3 6.6 5.9 4.3 8.3 3.2 11.3c1 .5 2 .7 3 .7 4.4 0 4.8-6.4 4.8-11z" />
          </svg>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={
        tone === "leaf"
          ? "marquee overflow-hidden bg-leaf text-paper"
          : "marquee overflow-hidden bg-ink text-paper"
      }
    >
      <div
        className="marquee-track"
        data-direction={strip.direction}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {half("a")}
        {half("b")}
      </div>
    </div>
  );
}
