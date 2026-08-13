/**
 * Thin wrapper over Razorpay's hosted Checkout widget.
 *
 * The script is loaded on demand rather than on every page — most visitors
 * never reach checkout, and it's a third-party script on the critical path.
 *
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: { description?: string; reason?: string; step?: string };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (payload: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loader: Promise<void> | null = null;

/** Idempotent: concurrent callers share one script tag and one promise. */
export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser"));
  }

  if (window.Razorpay) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );

    const script = existing ?? document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;

    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      // Let a later attempt retry rather than caching the failure forever.
      loader = null;
      reject(new Error("Couldn't load the payment window. Check your connection."));
    });

    if (!existing) document.body.appendChild(script);
  });

  return loader;
}

export type OpenCheckoutInput = {
  keyId: string;
  razorpayOrderId: string;
  /** Rupees; converted to paise here so callers deal in one unit. */
  amount: number;
  orderNumber: string;
  customer: { name: string; email: string; phone: string };
  onSuccess: (response: RazorpaySuccess) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
};

export async function openRazorpayCheckout(input: OpenCheckoutInput): Promise<void> {
  await loadRazorpay();

  const Constructor = window.Razorpay;
  if (!Constructor) {
    throw new Error("Payment window is unavailable. Reload and try again.");
  }

  const instance = new Constructor({
    key: input.keyId,
    amount: Math.round(input.amount * 100),
    currency: "INR",
    name: "Aroma Beauty Herbs",
    description: `Order ${input.orderNumber}`,
    order_id: input.razorpayOrderId,
    prefill: {
      name: input.customer.name,
      email: input.customer.email,
      contact: input.customer.phone,
    },
    notes: { order_number: input.orderNumber },
    handler: input.onSuccess,
    modal: { ondismiss: input.onDismiss },
  });

  instance.on("payment.failed", (payload) => {
    input.onFailure(payload.error?.description ?? "The payment didn't go through.");
  });

  instance.open();
}
