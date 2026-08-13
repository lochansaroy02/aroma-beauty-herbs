import { Router } from "express";

import {
  getAdminOrder,
  listAdminOrders,
  updateOrderStatus,
} from "../controllers/admin-order.controller";
import {
  getAdminProduct,
  listAdminProducts,
  updateProduct,
} from "../controllers/admin-product.controller";
import {
  getMediaSettings,
  updateMediaSettings,
} from "../controllers/admin-settings.controller";
import { getOrderStats } from "../controllers/admin-stats.controller";
import {
  createStrip,
  createTile,
  deleteStrip,
  deleteTile,
  getAdminHome,
  reorderStrips,
  reorderTiles,
  saveAnnouncement,
  updateSections,
  updateStrip,
  updateTile,
} from "../controllers/admin-home.controller";
import {
  adjustStock,
  getStockHistory,
  listInventory,
  updateLowStockAlert,
} from "../controllers/inventory.controller";
import {
  createVideo,
  deleteVideo,
  getVideo,
  listVideos,
  updateVideo,
} from "../controllers/video.controller";
import { createBrand, createCategory } from "../controllers/taxonomy.controller";
import { requireAdmin } from "../middleware/require-admin";
import { requireAuth } from "../middleware/require-auth";

export const adminRouter = Router();

// Everything under /admin is staff-only.
adminRouter.use(requireAuth, requireAdmin);

// Before /orders/:orderNumber would otherwise be a candidate — this is a
// distinct resource, not an order number.
adminRouter.get("/stats/orders", getOrderStats);

// Runtime switches — currently just which storage new uploads go to.
adminRouter.get("/settings/media", getMediaSettings);
adminRouter.patch("/settings/media", updateMediaSettings);

// Homepage customisation: the announcement bar, scrolling strips, closing grid,
// and how the blocks are arranged. The hero video keeps its own /videos routes.
adminRouter.get("/home", getAdminHome);
adminRouter.patch("/home/sections", updateSections);
adminRouter.put("/home/announcement", saveAnnouncement);

adminRouter.post("/home/strips", createStrip);
adminRouter.post("/home/strips/reorder", reorderStrips);
adminRouter.patch("/home/strips/:id", updateStrip);
adminRouter.delete("/home/strips/:id", deleteStrip);

adminRouter.post("/home/tiles", createTile);
adminRouter.post("/home/tiles/reorder", reorderTiles);
adminRouter.patch("/home/tiles/:id", updateTile);
adminRouter.delete("/home/tiles/:id", deleteTile);

adminRouter.get("/orders", listAdminOrders);
adminRouter.get("/orders/:orderNumber", getAdminOrder);
adminRouter.patch("/orders/:orderNumber/status", updateOrderStatus);

adminRouter.get("/products", listAdminProducts);
adminRouter.get("/products/:id", getAdminProduct);
adminRouter.patch("/products/:id", updateProduct);

// Brand and category are required on a product, so a database with no taxonomy
// rows couldn't create one without these.
adminRouter.post("/brands", createBrand);
adminRouter.post("/categories", createCategory);

adminRouter.get("/inventory", listInventory);
adminRouter.post("/inventory/:variantId/adjust", adjustStock);
adminRouter.patch("/inventory/:variantId/alert", updateLowStockAlert);
adminRouter.get("/inventory/:variantId/history", getStockHistory);

adminRouter.get("/videos", listVideos);
adminRouter.post("/videos", createVideo);
adminRouter.get("/videos/:id", getVideo);
adminRouter.patch("/videos/:id", updateVideo);
adminRouter.delete("/videos/:id", deleteVideo);
