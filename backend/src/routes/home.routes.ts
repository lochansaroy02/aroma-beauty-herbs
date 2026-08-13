import { Router } from "express";

import { getHome } from "../controllers/home.controller";

export const homeRouter = Router();

/** Public: everything the storefront homepage renders, in one request. */
homeRouter.get("/", getHome);
