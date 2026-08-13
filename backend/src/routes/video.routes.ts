import { Router } from "express";

import { listActiveVideos } from "../controllers/video.controller";

export const videoRouter = Router();

/**
 * Public, active videos only. Where the storefront shows these hasn't been
 * decided yet — this is the endpoint it will read when it is.
 */
videoRouter.get("/", listActiveVideos);
