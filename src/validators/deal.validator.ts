import { z } from "zod";
import { paginationFields, objectIdSchema, dateSchema, numberInputSchema, validateSortBy } from "./common.js";
import { DEAL_STAGES } from "../models/deal.model.js";

const dealFields = {
  name: z.string().trim().min(2).max(180),
  leadId: objectIdSchema.nullable().optional(),
  customerId: objectIdSchema,
  assignedTo: objectIdSchema.optional(),
  amount: numberInputSchema.pipe(z.number().positive().max(1_000_000_000)),
  probability: numberInputSchema.pipe(z.number().min(0).max(100)).default(10),
  expectedClosingDate: dateSchema,
  stage: z.enum(DEAL_STAGES).default("qualification"),
  description: z.string().trim().max(5000).optional(),
  lostReason: z.string().trim().max(2000).optional(),
};

export const createDealSchema = z.object(dealFields).strict().superRefine((value, ctx) => {
  if (value.stage === "lost" && !value.lostReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lostReason"], message: "A reason is required for a lost deal" });
  }
  if (value.stage !== "won" && value.stage !== "lost" && value.expectedClosingDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedClosingDate"], message: "Expected closing date for an open deal must be today or in the future" });
  }
});
export const updateDealSchema = z.object({
  name: dealFields.name.optional(),
  customerId: objectIdSchema.optional(),
  amount: numberInputSchema.pipe(z.number().positive().max(1_000_000_000)).optional(),
  probability: numberInputSchema.pipe(z.number().min(0).max(100)).optional(),
  expectedClosingDate: dateSchema.optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  description: dealFields.description,
  lostReason: dealFields.lostReason,
  assignedTo: objectIdSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const changeDealStageSchema = z.object({
  stage: z.enum(DEAL_STAGES),
  lostReason: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.stage === "lost" && !value.lostReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lostReason"], message: "A reason is required for a lost deal" });
  }
});

export const dealsQuerySchema = z.object({
  ...paginationFields,
  stage: z.enum(DEAL_STAGES).optional(),
  assignedTo: objectIdSchema.optional(),
  minAmount: numberInputSchema.pipe(z.number().min(0)).optional(),
  maxAmount: numberInputSchema.pipe(z.number().min(0)).optional(),
  closingFrom: dateSchema.optional(),
  closingTo: dateSchema.optional(),
  status: z.enum(["open", "closed", "won", "lost"]).optional(),
}).strict().superRefine((value, ctx) => {
  validateSortBy(value, ctx, ["name", "stage", "amount", "probability", "expectedRevenue", "expectedClosingDate", "createdAt", "updatedAt"]);
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "createdTo must be on or after createdFrom" });
  }
  if (value.closingFrom && value.closingTo && value.closingFrom > value.closingTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["closingTo"], message: "closingTo must be on or after closingFrom" });
  }
  if (value.minAmount !== undefined && value.maxAmount !== undefined && value.minAmount > value.maxAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxAmount"], message: "maxAmount must be greater than or equal to minAmount" });
  }
});
