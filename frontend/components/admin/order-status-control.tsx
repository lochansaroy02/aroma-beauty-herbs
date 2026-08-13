"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrderStatusAction } from "@/lib/admin-order-actions";
import { ALLOWED_TRANSITIONS, type OrderStatus } from "@/lib/catalog";

type Props = {
  orderNumber: string;
  status: OrderStatus;
  /** Cancelling a paid order would be a refund, which isn't built. */
  paid: boolean;
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function OrderStatusControl({ orderNumber, status, paid }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const options = ALLOWED_TRANSITIONS[status].filter(
    (next) => !(next === "cancelled" && paid)
  );

  function move(next: OrderStatus) {
    setError(null);

    startTransition(async () => {
      const result = await updateOrderStatusAction(orderNumber, next, remarks || undefined);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRemarks("");
      router.refresh();
    });
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {status === "delivered"
          ? "This order is complete."
          : status === "cancelled"
            ? "This order was cancelled."
            : paid
              ? "Refund in the Razorpay dashboard before cancelling."
              : "No further changes available."}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="remarks">
          Note <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Tracking number, courier, reason…"
          maxLength={500}
          disabled={pending}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={next === "cancelled" ? "outline" : "default"}
            disabled={pending}
            onClick={() => move(next)}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Mark {titleCase(next)}
          </Button>
        ))}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
