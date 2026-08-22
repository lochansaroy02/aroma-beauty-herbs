import { Router } from "express";

import { login, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth";

/**
 * Staff sign-in. There is no signup route: this site has no customer accounts,
 * and admins are created from the server with `npm run make:admin`.
 */
export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
