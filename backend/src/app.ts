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
import { contactRouter } from "./routes/contact.routes";
import { homeRouter } from "./routes/home.routes";
import { mediaRouter } from "./routes/media.routes";
import { videoRouter } from "./routes/video.routes";

/**
 * This API backs a landing page, not a shop.
 *
 * The catalogue, cart, checkout, orders and customer accounts were removed when
 * the site became a storefront for barbersyndicate.in: products are read by the
 * frontend straight from that site's public API, and "Shop now" links out. What
 * remains is what the landing page can't get from anywhere else — the homepage
 * composition an admin edits, the media and video library behind it, the
 * contact form, and the admin login that gates all three.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));

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
  app.use("/videos", videoRouter);
  app.use("/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
