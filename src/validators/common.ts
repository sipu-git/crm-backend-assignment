import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ObjectId");
export const emailSchema = z.string().trim().email("Must be a valid email address").max(254).transform((value) => value.toLowerCase());
export const phoneSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value.trim();
    return value;
  },
  z.string({ required_error: "Phone number is required", invalid_type_error: "Phone number must be a 10-digit number" })
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
);
export const numberInputSchema = z.preprocess(
  (value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "") ? Number(value) : Number.NaN,
  z.number().finite(),
);
export const dateSchema = z.preprocess(
  (value) => typeof value === "string" || value instanceof Date ? value : undefined,
  z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), "Must be a valid date"),
);
export const idParamsSchema = z.object({ id: objectIdSchema }).strict();

export const paginationFields = {
  page: numberInputSchema.pipe(z.number().int().min(1)).default(1),
  limit: numberInputSchema.pipe(z.number().int().min(1).max(100)).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  createdFrom: dateSchema.optional(),
  createdTo: dateSchema.optional(),
};

export const paginationQuerySchema = z.object(paginationFields).strict().superRefine((value, ctx) => {
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "createdTo must be on or after createdFrom" });
  }
});

export const optionalAssigneeSchema = objectIdSchema.optional();

export function validateSortBy(
  value: { sortBy?: string },
  ctx: z.RefinementCtx,
  allowedFields: readonly string[],
): void {
  if (value.sortBy && !allowedFields.includes(value.sortBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sortBy"],
      message: `sortBy must be one of: ${allowedFields.join(", ")}`,
    });
  }
}
