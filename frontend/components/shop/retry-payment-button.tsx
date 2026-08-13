"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelPaymentAction,
  retryPaymentAction,
  verifyPaymentAction,
} from "@/lib/checkout-actions";
import { openRazorpayCheckout } from "@/lib/razorpay-client";

type Props = {
  orderNumber: string;
  customer: { name: string; email: string; phone: string };
};

/** Reopens the payment window for an order that was placed but never paid. */
export function RetryPaymentButton({ orderNumber, customer }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);

    // A fresh Razorpay order — the previous one may have expired.
    const retry = await retryPaymentAction(orderNumber);

    if (!retry.ok) {
      setError(retry.error);
      setBusy(false);
      return;
    }

    const { payment } = retry;

    if (!payment.key_id || !payment.razorpay_order_id) {
      setError("Payments aren't live yet.");
      setBusy(false);
      return;
    }

    try {
      await openRazorpayCheckout({
        keyId: payment.key_id,
        razorpayOrderId: payment.razorpay_order_id,
        amount: payment.amount,
        orderNumber,
        customer,

        onSuccess: (response) => {
          void verifyPaymentAction(orderNumber, response).then((result) => {
            setBusy(false);
            if (result.ok) {
              router.refresh();
              return;
            }
            setError(result.error);
          });
        },

        onDismiss: () => {
          void cancelPaymentAction(orderNumber, "Payment window closed");
          setBusy(false);
          router.refresh();
        },

        onFailure: (message) => {
          void cancelPaymentAction(orderNumber, message);
          setError(message);
          setBusy(false);
        },
      });
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Couldn't open the payment window."
      );
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={handleClick} disabled={busy} className="w-full">
        {busy ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        {busy ? "Opening payment…" : "Pay now"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
