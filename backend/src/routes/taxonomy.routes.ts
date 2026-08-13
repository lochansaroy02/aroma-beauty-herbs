import { Router } from "express";

import { listBrands, listCategories } from "../controllers/taxonomy.controller";

export const categoryRouter = Router();
categoryRouter.get("/", listCategories);

export const brandRouter = Router();
brandRouter.get("/", listBrands);
