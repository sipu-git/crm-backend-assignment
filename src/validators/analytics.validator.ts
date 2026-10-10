import { z } from "zod";

export const teamPerformanceQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
}).strict();
