import { Router } from "express";

import {
  attachProductImages,
  createProduct,
  deleteProductImage,
  getProduct,
  listProducts,
} from "../controllers/product.controller";
import { requireAdmin } from "../middleware/require-admin";
import { requireAuth } from "../middleware/require-auth";

export const productRouter = Router();

// Public catalogue.
productRouter.get("/", listProducts);
productRouter.get("/:slug", getProduct);

// Admin: create a product, optionally with its images already uploaded.
productRouter.post("/", requireAuth, requireAdmin, createProduct);

// Admin: record images already written to disk by POST /uploads.
productRouter.post("/:id/images", requireAuth, requireAdmin, attachProductImages);
productRouter.delete("/:id/images/:mediaId", requireAuth, requireAdmin, deleteProductImage);
