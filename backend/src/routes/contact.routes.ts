import { Router } from "express";

import { submitContact } from "../controllers/contact.controller";

export const contactRouter = Router();

/** Public: the storefront contact form. Rate-limited inside the controller. */
contactRouter.post("/", submitContact);
