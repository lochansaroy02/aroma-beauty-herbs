import cors from "cors";
import express from "express";

import { env, isImageKitConfigured } from "./lib/env";
import {
  MEDIA_ROOT,
  MEDIA_URL_PREFIX,
  getActiveDisk,
  isImageKitActive,
} from "./lib/storage";
import { errorHandler, notFound } from "./middleware/error-handler";
import { adminRouter } from "./routes/admin.routes";
import { authRouter } from "./routes/auth.routes";
import { cartRouter, wishlistRouter } from "./routes/cart.routes";
import {
  checkoutRouter,
  orderRouter,
  razorpayWebhookRouter,
} from "./routes/checkout.routes";
import { contactRouter } from "./routes/contact.routes";
import { homeRouter } from "./routes/home.routes";
import { mediaRouter } from "./routes/media.routes";
import { productRouter } from "./routes/product.routes";
import { brandRouter, categoryRouter } from "./routes/taxonomy.routes";
import { videoRouter } from "./routes/video.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));

  // Before express.json(): the Razorpay webhook's signature covers the raw
  // bytes, which a JSON parse would destroy.
  app.use(razorpayWebhookRouter);

  app.use(express.json());

  /**
   * Health, including which storage driver this process actually loaded.
   *
   * Reading MEDIA_DRIVER out of .env only tells you what is configured — env is
   * read once at boot, so an edit without a restart leaves the file and the
   * running process disagreeing. This answers for the process.
   *
   * Deliberately says whether ImageKit is configured, never what with: a public
   * endpoint has no business confirming key material.
   */
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      media: {
        driver: getActiveDisk(),
        ...(isImageKitActive()
          ? { endpoint: env.IMAGEKIT_URL_ENDPOINT, ready: isImageKitConfigured }
          : { root: MEDIA_ROOT, base_url: env.MEDIA_BASE_URL }),
      },
    });
  });

  /**
   * Uploaded media, served straight off disk.
   *
   * `index` and `redirect` are off so the tree can't be browsed and a directory
   * URL can't be probed for what exists. `fallthrough: false` makes a missing
   * file a 404 here rather than continuing into the API routers, which would
   * otherwise answer with the JSON "Route not found" for a broken <img>.
   * Behind nginx you'd hand this path to it instead and never reach Node.
   */
  app.use(
    MEDIA_URL_PREFIX,
    express.static(MEDIA_ROOT, {
      index: false,
      redirect: false,
      fallthrough: false,
      dotfiles: "deny",
      // Names carry a random suffix and are never reused, so the bytes at a
      // given URL cannot change.
      maxAge: "365d",
      immutable: true,
    })
  );

  app.use("/home", homeRouter);
  app.use("/contact", contactRouter);
  app.use("/auth", authRouter);
  app.use("/uploads", mediaRouter);
  app.use("/products", productRouter);
  app.use("/categories", categoryRouter);
  app.use("/brands", brandRouter);
  app.use("/cart", cartRouter);
  app.use("/wishlist", wishlistRouter);
  app.use("/checkout", checkoutRouter);
  app.use("/orders", orderRouter);
  app.use("/videos", videoRouter);
  app.use("/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
