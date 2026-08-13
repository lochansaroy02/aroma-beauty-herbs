import { Router } from "express";

import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cart.controller";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../controllers/wishlist.controller";
import { requireAuth } from "../middleware/require-auth";

export const cartRouter = Router();

// A cart belongs to an account. The tables carry a session_id column for a
// guest cart later; nothing writes it yet.
cartRouter.use(requireAuth);

cartRouter.get("/", getCart);
cartRouter.post("/", addToCart);
cartRouter.patch("/:id", updateCartItem);
cartRouter.delete("/:id", removeCartItem);
cartRouter.delete("/", clearCart);

export const wishlistRouter = Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get("/", getWishlist);
wishlistRouter.post("/", addToWishlist);
wishlistRouter.delete("/:productId", removeFromWishlist);
