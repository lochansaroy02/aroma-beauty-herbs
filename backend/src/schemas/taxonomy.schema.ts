import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  parent_id: z.coerce.number().int().positive().optional(),
});
