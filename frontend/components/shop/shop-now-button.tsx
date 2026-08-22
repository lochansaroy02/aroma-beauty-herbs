import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Padding and type scale per slot. The grid card gets the compact one. */
const SIZES = {
  sm: "px-4 py-3 text-[10px]",
  default: "px-6 py-3.5 text-[11px]",
  lg: "px-8 py-4 text-[11px]",
} as const;

type Props = {
  /** The product's page on the storefront that actually sells it. */
  href: string;
  inStock?: boolean;
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Hands the visitor over to barbersyndicate.in to buy.
 *
 * A plain anchor, not a button with a click handler: this site has no cart to
 * add to, and the destination is a different origin. That also means it needs
 * no JavaScript, works on a middle-click, and can be opened in a new tab like
 * any other link — which is what someone comparing four kits will do.
 *
 * Out of stock still links rather than disabling. The other site is the
 * authority on availability and our copy of it is up to five minutes old, so
 * refusing the click would sometimes be wrong in the direction that costs a
 * sale. The label says what we believe; the destination settles it.
 */
export function ShopNowButton({
  href,
  inStock = true,
  label,
  size = "default",
  className,
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        // A square ink slab in mono caps: the shop's primary action, matching
        // the hero's call to action and the contact form's send button.
        "inline-flex items-center justify-center gap-2.5 bg-ink font-mono tracking-[0.18em] text-paper uppercase transition-colors",
        "hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        !inStock && "bg-ink/70",
        SIZES[size],
        className
      )}
    >
      {label ?? (inStock ? "Shop now" : "Check availability")}
      <ArrowUpRightIcon className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="sr-only">(opens barbersyndicate.in in a new tab)</span>
    </a>
  );
}
