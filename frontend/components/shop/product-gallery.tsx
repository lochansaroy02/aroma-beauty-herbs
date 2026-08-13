"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { ProductImage } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? null);
  const active = images.find((image) => image.id === activeId) ?? images[0];

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center bg-paper-deep text-clay">
        <ImageIcon className="size-10" strokeWidth={1.25} />
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
          alt={active.alt ?? productName}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveId(image.id)}
              aria-current={image.id === active.id}
              className={cn(
                "relative size-16 overflow-hidden bg-paper-deep transition-opacity",
                image.id === active.id
                  ? "outline-2 outline-offset-2 outline-ink"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
              <span className="sr-only">View image {image.position}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
