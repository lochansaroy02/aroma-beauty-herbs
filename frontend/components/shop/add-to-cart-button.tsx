"use client";

import { CheckIcon, Loader2Icon, ShoppingBagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addToCartAction } from "@/lib/cart-actions";
import { cn } from "@/lib/utils";

/** Padding and type scale per slot. The grid card gets the compact one. */
const SIZES = {
  sm: "px-4 py-3 text-[10px]",
  default: "px-6 py-3.5 text-[11px]",
  lg: "px-8 py-4 text-[11px]",
} as const;

type Props = {
  productId: number;
  variantId?: number | null;
  quantity?: number;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  onError?: (message: string) => void;
};

export function AddToCartButton({
  productId,
  variantId = null,
  quantity = 1,
  disabled = false,
  label = "Add to cart",
  size = "default",
  className,
  onError,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await addToCartAction({ productId, variantId, quantity });

      if (result.ok) {
        setAdded(true);
        // Confirmation, not a permanent state — the button goes back to normal.
        setTimeout(() => setAdded(false), 2000);
        return;
      }

      if (result.needsLogin) {
        router.push("/login");
        return;
      }

      setError(result.error);
      onError?.(result.error);
    });
  }

  return (
    <div className={cn("grid gap-1", className)}>
      {/*
        A square ink slab in mono caps, not a rounded shadcn button: this is the
        shop's primary action and it should match the hero's "Shop now" and the
        contact form's "Send message", which are the same shape.
      */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className={cn(
          "inline-flex items-center justify-center gap-2.5 bg-ink font-mono tracking-[0.18em] text-paper uppercase transition-colors",
          "hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          "disabled:cursor-not-allowed disabled:bg-ink/40",
          SIZES[size]
        )}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
        ) : added ? (
          <CheckIcon className="size-3.5 shrink-0" strokeWidth={2} />
        ) : (
          <ShoppingBagIcon className="size-3.5 shrink-0" strokeWidth={1.75} />
        )}
        {added ? "Added" : label}
      </button>

      {/* Shown inline when no parent has offered to display it. */}
      {error && !onError ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
