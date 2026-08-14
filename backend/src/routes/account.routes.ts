import { Router } from "express";

import {
  cancelEmailChange,
  changePassword,
  createAddress,
  deleteAddress,
  getOverview,
  getProfile,
  listAddresses,
  resendEmailChangeOtp,
  updateAddress,
  updateProfile,
  verifyEmailChange,
} from "../controllers/account.controller";
import { requireAuth } from "../middleware/require-auth";

/** The signed-in customer's own account. Everything is scoped to their id. */
export const accountRouter = Router();

// Applied to the router rather than per route: there is no public endpoint
// here, and a new one added later should not be able to forget the guard.
accountRouter.use(requireAuth);

accountRouter.get("/overview", getOverview);

accountRouter.get("/addresses", listAddresses);
accountRouter.post("/addresses", createAddress);
accountRouter.patch("/addresses/:id", updateAddress);
accountRouter.delete("/addresses/:id", deleteAddress);

accountRouter.get("/profile", getProfile);
accountRouter.patch("/profile", updateProfile);
accountRouter.post("/email/verify", verifyEmailChange);
accountRouter.post("/email/resend", resendEmailChangeOtp);
accountRouter.delete("/email/pending", cancelEmailChange);

accountRouter.post("/password", changePassword);
