"use client";

import { FlaskConicalIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { simulatePaymentAction } from "@/lib/checkout-actions";

/**
 * Marks an order paid without a real payment, so the order features can be
 * exercised before Razorpay is verified. The API refuses this once real keys
 * are set, so the button stops working on its own — it isn't something that can
 * be left switched on.
 */
export function SimulatePaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await simulatePaymentAction(orderNumber);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={pending}
        className="w-full border-dashed"
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <FlaskConicalIcon />}
        {pending ? "Marking paid…" : "Mark as paid (test mode)"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No money moves. Disappears once Razorpay is live.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
