"use client";

import { AlertCircleIcon, InfoIcon, LockIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/api";
import {
  cancelPaymentAction,
  placeOrderAction,
  verifyPaymentAction,
  type CheckoutFields,
} from "@/lib/checkout-actions";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { useCoupon } from "./coupon-box";

type Props = {
  defaults: { name: string | null; email: string; phone: string | null };
};

type Stage = "idle" | "placing" | "paying" | "verifying";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

/** "Asha Devi" → first "Asha", last "Devi"; a single word goes in first. */
function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1)! };
}

export function CheckoutForm({ defaults }: Props) {
  const router = useRouter();
  const initial = splitName(defaults.name);
  const { applied, setApplied } = useCoupon();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>();
  const [saveAddress, setSaveAddress] = useState(true);

  const busy = stage !== "idle";

  function readFields(form: HTMLFormElement): CheckoutFields {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "").trim();

    return {
      first_name: text("first_name"),
      last_name: text("last_name"),
      email: text("email"),
      phone: text("phone"),
      address_line_1: text("address_line_1"),
      address_line_2: text("address_line_2"),
      city: text("city"),
      state: text("state"),
      zip: text("zip"),
      country: text("country") || "India",
      notes: text("notes"),
      save_address: saveAddress,
      // Only the code travels. The API recomputes the discount from it, so a
      // tampered amount in this payload changes nothing.
      ...(applied ? { coupon_code: applied.code } : {}),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors(undefined);
    setStage("placing");

    const fields = readFields(event.currentTarget);
    const placed = await placeOrderAction(fields);

    if (!placed.ok) {
      setError(placed.error);
      setFieldErrors(placed.fieldErrors);
      setStage("idle");

      // The API re-checks the coupon at order time. If that is what it
      // rejected, drop it — leaving it applied would keep showing a discount
      // the order can't have, and every retry would fail the same way.
      if (applied && placed.fieldErrors?.["coupon_code"]) setApplied(null);
      return;
    }

    const { order, payment } = placed;

    // Payments aren't live yet — the order is recorded as awaiting payment and
    // the confirmation page says exactly that.
    if (!payment.configured || !payment.key_id || !payment.razorpay_order_id) {
      router.push(`/orders/${order.order_number}`);
      return;
    }

    setStage("paying");

    try {
      await openRazorpayCheckout({
        keyId: payment.key_id,
        razorpayOrderId: payment.razorpay_order_id,
        amount: payment.amount,
        orderNumber: order.order_number,
        customer: {
          name: `${fields.first_name} ${fields.last_name}`.trim(),
          email: fields.email,
          phone: fields.phone,
        },

        onSuccess: (response) => {
          setStage("verifying");
          void verifyPaymentAction(order.order_number, response).then((result) => {
            if (result.ok) {
              router.push(`/orders/${order.order_number}`);
              return;
            }
            setError(result.error);
            setStage("idle");
          });
        },

        onDismiss: () => {
          // Release the stock the order is holding rather than stranding it.
          void cancelPaymentAction(order.order_number, "Payment window closed");
          setError("Payment was cancelled. Your items are still in your cart.");
          setStage("idle");
        },

        onFailure: (message) => {
          void cancelPaymentAction(order.order_number, message);
          setError(message);
          setStage("idle");
        },
      });
    } catch (openError) {
      const message =
        openError instanceof Error ? openError.message : "Couldn't open the payment window.";
      void cancelPaymentAction(order.order_number, message);
      setError(message);
      setStage("idle");
    }
  }

  const buttonLabel =
    stage === "placing"
      ? "Placing order…"
      : stage === "paying"
        ? "Waiting for payment…"
        : stage === "verifying"
          ? "Confirming payment…"
          : "Place order";

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Delivery details</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={initial.first}
                autoComplete="given-name"
                required
              />
              <FieldError messages={fieldErrors?.first_name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={initial.last}
                autoComplete="family-name"
                required
              />
              <FieldError messages={fieldErrors?.last_name} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={defaults.email}
                autoComplete="email"
                required
              />
              <FieldError messages={fieldErrors?.email} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                defaultValue={defaults.phone ?? ""}
                autoComplete="tel"
                placeholder="10-digit number"
                required
              />
              <FieldError messages={fieldErrors?.phone} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address_line_1">Address</Label>
            <Input
              id="address_line_1"
              name="address_line_1"
              autoComplete="address-line1"
              placeholder="House number and street"
              required
            />
            <FieldError messages={fieldErrors?.address_line_1} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address_line_2">
              Area, landmark <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="address_line_2"
              name="address_line_2"
              autoComplete="address-line2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" autoComplete="address-level2" required />
              <FieldError messages={fieldErrors?.city} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" autoComplete="address-level1" required />
              <FieldError messages={fieldErrors?.state} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zip">PIN code</Label>
              <Input
                id="zip"
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                required
              />
              <FieldError messages={fieldErrors?.zip} />
            </div>
          </div>

          <input type="hidden" name="country" value="India" />

          <div className="grid gap-2">
            <Label htmlFor="notes">
              Delivery notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="save_address"
              checked={saveAddress}
              onCheckedChange={(checked) => setSaveAddress(checked === true)}
            />
            <Label htmlFor="save_address" className="font-normal">
              Save this address for next time
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
        {buttonLabel}
      </Button>

      {stage === "paying" ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Finish in the payment window. Closing it cancels the order.
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
