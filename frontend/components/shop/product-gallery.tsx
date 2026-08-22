"use client";

import { LeafIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { ShopImage } from "@/lib/shop-api";
import { cn } from "@/lib/utils";

/**
 * Keyed by position rather than id: these images come from an external API as a
 * plain ordered list, and the same file can legitimately appear twice (a main
 * image that is also the first gallery shot), so the URL isn't unique either.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: ShopImage[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center bg-paper-deep text-clay">
        <LeafIcon className="size-10" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* Square corners and no border: the shop's images sit flush, the way the
          hero and the tile grid do. */}
      <div className="relative aspect-square overflow-hidden bg-paper-deep">
        <Image
          src={active.url}
          alt={productName}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex}
              className={cn(
                "relative size-16 overflow-hidden bg-paper-deep transition-opacity",
                index === activeIndex
                  ? "outline-2 outline-offset-2 outline-ink"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              {/* The API's webp conversion, which is what a 64px square wants. */}
              <Image src={image.thumb} alt="" fill sizes="64px" className="object-cover" />
              <span className="sr-only">View image {index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
