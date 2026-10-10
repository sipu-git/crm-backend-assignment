import { z } from "zod";
import { objectIdSchema, paginationFields, validateSortBy } from "./common.js";

export const timelineParamsSchema = z.object({
  entityType: z.enum(["lead", "customer", "deal"]),
  entityId: objectIdSchema,
}).strict();
export const timelineQuerySchema = z.object(paginationFields).strict().superRefine((value, ctx) => {
  validateSortBy(value, ctx, ["action", "createdAt"]);
});
