"use client";

import { CheckCircle2Icon, Loader2Icon, TagIcon, XIcon } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCouponAction } from "@/lib/checkout-actions";
import { formatPrice } from "@/lib/catalog";

/**
 * The applied coupon, shared between the coupon box, the order summary and the
 * checkout form.
 *
 * Those three are siblings rendered by a server component, so there is nowhere
 * to hang shared state except a context around all of them. The alternative —
 * storing the code server-side — would mean a round trip to change it and a
 * stale code surviving a cart edit.
 */
export type AppliedCoupon = {
  code: string;
  discount: number;
  /** Total after the discount, as the API computed it. Never re-derived here. */
  total: number;
};

type CouponContext = {
  applied: AppliedCoupon | null;
  setApplied: (value: AppliedCoupon | null) => void;
};

const Context = createContext<CouponContext | null>(null);

export function CouponProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  return <Context.Provider value={{ applied, setApplied }}>{children}</Context.Provider>;
}

/** Returns null outside a provider, so a summary can render without one. */
export function useCoupon(): CouponContext {
  const value = useContext(Context);
  if (!value) throw new Error("useCoupon must be used inside CouponProvider");
  return value;
}

/** The input and Apply button. */
export function CouponBox() {
  const { applied, setApplied } = useCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    const trimmed = code.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);

    const result = await applyCouponAction(trimmed);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      setApplied(null);
      return;
    }

    setApplied({
      code: result.coupon.code,
      discount: result.discount,
      total: result.totals.total,
    });
    setCode("");
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
          <span className="truncate font-mono">{applied.code}</span>
          <span className="shrink-0 text-muted-foreground">
            −{formatPrice(applied.discount)}
          </span>
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove coupon ${applied.code}`}
          onClick={() => setApplied(null)}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {/*
        Not a <form>: this sits inside the checkout form's card on some
        layouts, and a nested form is invalid HTML — the inner one is dropped
        and Enter submits the order instead of applying the code.
      */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TagIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={code}
            placeholder="Coupon code"
            aria-label="Coupon code"
            className="pl-9 font-mono uppercase"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void apply();
              }
            }}
          />
        </div>

        <Button type="button" variant="outline" onClick={apply} disabled={busy || !code.trim()}>
          {busy ? <Loader2Icon className="animate-spin" /> : null}
          Apply
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The discount line and the final total.
 *
 * Owns the total because it changes with the coupon; the page's static total is
 * only right while nothing is applied.
 */
export function CouponTotals({ total }: { total: number }) {
  const { applied } = useCoupon();

  return (
    <>
      {applied ? (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount ({applied.code})</span>
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
            −{formatPrice(applied.discount)}
          </span>
        </div>
      ) : null}

      <div className="flex justify-between font-medium">
        <span>Total</span>
        <span className="tabular-nums">
          {formatPrice(applied ? applied.total : total)}
        </span>
      </div>
    </>
  );
}
