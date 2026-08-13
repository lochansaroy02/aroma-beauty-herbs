import express, { Router } from "express";

import {
  cancelCheckout,
  createCheckout,
  getCheckoutConfig,
  razorpayWebhook,
  retryCheckoutPayment,
  simulatePayment,
  verifyCheckoutPayment,
} from "../controllers/checkout.controller";
import { getOrder, listOrders } from "../controllers/order.controller";
import { requireAuth } from "../middleware/require-auth";

/**
 * Razorpay signs the exact bytes it sent, so this route needs the untouched
 * body. app.ts mounts it *before* express.json(), which would otherwise have
 * replaced the Buffer with a parsed object and broken every signature.
 */
export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post(
  "/checkout/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  razorpayWebhook
);

export const checkoutRouter = Router();

checkoutRouter.get("/config", requireAuth, getCheckoutConfig);
checkoutRouter.post("/", requireAuth, createCheckout);
checkoutRouter.post("/:orderNumber/verify", requireAuth, verifyCheckoutPayment);
// Refuses itself once Razorpay is configured — see the controller.
checkoutRouter.post("/:orderNumber/simulate", requireAuth, simulatePayment);
checkoutRouter.post("/:orderNumber/retry", requireAuth, retryCheckoutPayment);
checkoutRouter.post("/:orderNumber/cancel", requireAuth, cancelCheckout);

export const orderRouter = Router();

orderRouter.use(requireAuth);
orderRouter.get("/", listOrders);
orderRouter.get("/:orderNumber", getOrder);
