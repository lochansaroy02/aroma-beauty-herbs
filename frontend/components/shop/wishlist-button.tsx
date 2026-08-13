"use client";

import { HeartIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toggleWishlistAction } from "@/lib/cart-actions";
import { cn } from "@/lib/utils";

type Props = {
  productId: number;
  saved: boolean;
  /** Icon-only for cards, labelled on the product page. */
  variant?: "icon" | "labelled";
  className?: string;
};

export function WishlistButton({
  productId,
  saved,
  variant = "icon",
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Flipped immediately; the server action's revalidation confirms it.
  const [optimistic, setOptimistic] = useState(saved);

  // Re-sync when the server sends a different answer — otherwise removing an
  // item on the wishlist page would leave a filled heart on the shop grid.
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setOptimistic(saved);
  }

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);

    startTransition(async () => {
      const result = await toggleWishlistAction(productId, optimistic);

      if (!result.ok) {
        setOptimistic(optimistic);
        if (result.needsLogin) router.push("/login");
      }
    });
  }

  const icon = pending ? (
    <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
  ) : (
    <HeartIcon
      className={cn("size-3.5 shrink-0", optimistic && "fill-current text-leaf")}
      strokeWidth={1.75}
    />
  );

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={pending}
        className={cn("bg-paper/85 backdrop-blur hover:bg-paper", className)}
        aria-pressed={optimistic}
        aria-label={optimistic ? "Remove from wishlist" : "Save to wishlist"}
      >
        {icon}
      </Button>
    );
  }

  // The labelled variant sits beside Add to cart on the product page, so it
  // takes the same square mono shape — outlined rather than filled, because it
  // is the secondary of the two.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={optimistic}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 border border-ink/25 px-8 py-4",
        "font-mono text-[11px] tracking-[0.18em] text-ink uppercase transition-colors",
        "hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {icon}
      {optimistic ? "Saved" : "Save"}
    </button>
  );
}
