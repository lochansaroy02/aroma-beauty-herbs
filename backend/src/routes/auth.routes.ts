import { Router } from "express";

import {
  login,
  me,
  resendOtp,
  signup,
  verifyOtp,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth";

export const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/resend-otp", resendOtp);
authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
