import crypto from "node:crypto";

import Razorpay from "razorpay";

import { env, isRazorpayConfigured, isRazorpayWebhookConfigured } from "./env";
import { HttpError } from "./http-error";

/**
 * Built even with placeholder keys — nothing calls the API without checking
 * `isRazorpayConfigured` first, so an unverified account fails as a clear
 * "payments aren't live" rather than a 401 from Razorpay.
 */
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || "rzp_placeholder",
  key_secret: env.RAZORPAY_KEY_SECRET || "placeholder",
});

/** Razorpay works in paise; our money is rupees with 2 decimals. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

function hmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Length-safe equality — `timingSafeEqual` throws on a length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Confirms a browser-reported payment really came from Razorpay. The client can
 * say anything, so nothing is marked paid until this passes.
 *
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/#step-4-verify-payment-signature
 */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!isRazorpayConfigured) return false;

  const expected = hmac(
    `${input.razorpayOrderId}|${input.razorpayPaymentId}`,
    env.RAZORPAY_KEY_SECRET
  );

  return safeEqual(expected, input.signature);
}

/**
 * Webhooks are signed with their own secret, over the exact raw body — parsing
 * and re-serialising the JSON would change the bytes and break the digest.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!isRazorpayWebhookConfigured) return false;

  return safeEqual(
    hmac(rawBody.toString("utf8"), env.RAZORPAY_WEBHOOK_SECRET),
    signature
  );
}

export function requireRazorpay() {
  if (!isRazorpayConfigured) {
    throw new HttpError(
      503,
      "Online payment isn't available yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env once the business is verified."
    );
  }
}

export type CreatedRazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
};

/** Creates the Razorpay order the browser checkout widget is opened against. */
export async function createRazorpayOrder(input: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<CreatedRazorpayOrder> {
  requireRazorpay();

  const order = await razorpay.orders.create({
    amount: toPaise(input.amount),
    currency: "INR",
    // Max 40 characters on Razorpay's side.
    receipt: input.receipt.slice(0, 40),
    ...(input.notes ? { notes: input.notes } : {}),
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}
