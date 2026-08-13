import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { HomeTile } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * The closing grid. Three doors out of the homepage, each one editable as a
 * Small banner: title, standfirst and destination.
 *
 * Without an uploaded image a tile falls back to a tinted panel rather than an
 * empty box, so a half-configured homepage still looks deliberate.
 */
const FALLBACK_TINT = [
  "oklch(0.88 0.03 120)",
  "oklch(0.84 0.035 95)",
  "oklch(0.86 0.028 60)",
] as const;

/** Column counts per layout. "feature" gives the first tile the full width. */
const GRID_CLASS: Record<string, string> = {
  three: "lg:grid-cols-3",
  two: "sm:grid-cols-2",
  feature: "lg:grid-cols-2",
};

export function TileGrid({ tiles, layout = "three" }: { tiles: HomeTile[]; layout?: string }) {
  if (!tiles.length) return null;

  const columns = GRID_CLASS[layout] ?? GRID_CLASS["three"];

  return (
    <section className="bg-ink px-4 pb-4 sm:px-6 sm:pb-6">
      <ul className={cn("mx-auto grid w-full max-w-7xl gap-4 sm:gap-6", columns)}>
        {tiles.map((tile, index) => (
          <li
            key={tile.id}
            // In "feature" the opening tile spans the row and runs wider than tall.
            className={cn(layout === "feature" && index === 0 && "lg:col-span-2")}
          >
            <Link
              href={tile.url || "/products"}
              className={cn(
                "group relative flex aspect-4/5 flex-col justify-end overflow-hidden",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper",
                layout === "feature" && index === 0
                  ? "lg:aspect-21/9"
                  : layout === "two"
                    ? "lg:aspect-4/3"
                    : "lg:aspect-3/4"
              )}
            >
              {tile.image ? (
                <Image
                  src={tile.image.url}
                  alt=""
                  fill
                  sizes={
                    layout === "feature" && index === 0
                      ? "100vw"
                      : layout === "three"
                        ? "(min-width: 1024px) 33vw, 100vw"
                        : "(min-width: 640px) 50vw, 100vw"
                  }
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: FALLBACK_TINT[index % FALLBACK_TINT.length] }}
                  aria-hidden
                />
              )}

              <div
                className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent"
                aria-hidden
              />

              <div className="relative p-7 sm:p-9">
                <h3
                  className="flex items-center gap-2 font-heading text-[clamp(1.75rem,3vw,2.5rem)] leading-none text-paper"
                  style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 72' }}
                >
                  {tile.title ?? "Explore"}
                  <ArrowUpRightIcon
                    className="size-5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </h3>

                {tile.caption ? (
                  <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-paper/75">
                    {tile.caption}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
