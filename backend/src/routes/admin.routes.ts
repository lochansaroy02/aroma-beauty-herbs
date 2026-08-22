import { Router } from "express";

import {
  deleteContactMessage,
  listContactMessages,
  updateContactStatus,
} from "../controllers/admin-contact.controller";
import {
  getMediaSettings,
  updateMediaSettings,
} from "../controllers/admin-settings.controller";
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
  createVideo,
  deleteVideo,
  getVideo,
  listVideos,
  updateVideo,
} from "../controllers/video.controller";
import { requireAdmin } from "../middleware/require-admin";
import { requireAuth } from "../middleware/require-auth";

/**
 * Staff-only. What's left after the shop was removed: the homepage an admin
 * composes, the videos and media behind it, and the contact enquiries it
 * generates. The catalogue is no longer ours to edit — it lives on
 * barbersyndicate.in and is read from their API.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

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

// Contact-form enquiries: the landing page writes them, staff triage them here.
adminRouter.get("/contact", listContactMessages);
adminRouter.patch("/contact/:id/status", updateContactStatus);
adminRouter.delete("/contact/:id", deleteContactMessage);

adminRouter.get("/videos", listVideos);
adminRouter.post("/videos", createVideo);
adminRouter.get("/videos/:id", getVideo);
adminRouter.patch("/videos/:id", updateVideo);
adminRouter.delete("/videos/:id", deleteVideo);
