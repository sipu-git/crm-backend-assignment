import { z } from "zod";
import { paginationFields, emailSchema, phoneSchema, objectIdSchema, dateSchema, numberInputSchema, validateSortBy } from "./common.js";
import { LEAD_PRIORITIES, LEAD_SOURCES } from "../models/lead.model.js";

const editableLeadStatus = z.enum(["new", "contacted", "qualified", "unqualified", "lost"]);
const leadFields = {
  name: z.string().trim().min(2).max(160),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: z.string().trim().max(160).optional(),
  source: z.enum(LEAD_SOURCES).default("other"),
  priority: z.enum(LEAD_PRIORITIES).default("medium"),
  assignedTo: objectIdSchema.optional(),
  description: z.string().trim().max(5000).optional(),
};

export const createLeadSchema = z.object(leadFields).strict();
export const updateLeadSchema = z.object({
  name: leadFields.name.optional(),
  email: leadFields.email,
  phone: leadFields.phone,
  company: leadFields.company,
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  status: editableLeadStatus.optional(),
  assignedTo: objectIdSchema.optional(),
  description: leadFields.description,
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const leadStatusSchema = z.object({ status: editableLeadStatus }).strict();
export const assignLeadSchema = z.object({ email: emailSchema }).strict();
export const convertLeadSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(160).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    company: z.string().trim().max(160).optional(),
    address: z.string().trim().max(1000).optional(),
  }).strict().optional(),
  deal: z.object({
    name: z.string().trim().min(2).max(180),
    amount: numberInputSchema.pipe(z.number().positive().max(1_000_000_000)),
    probability: numberInputSchema.pipe(z.number().min(0).max(100)).default(10),
    expectedClosingDate: dateSchema,
    description: z.string().trim().max(5000).optional(),
  }).strict(),
}).strict().superRefine(({ deal }, ctx) => {
  if (deal.expectedClosingDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deal", "expectedClosingDate"], message: "Expected closing date must be today or in the future" });
  }
});

const leadsQueryObjectSchema = z.object({
  ...paginationFields,
  status: z.enum(["new", "contacted", "qualified", "unqualified", "converted", "lost"]).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  assignedTo: objectIdSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
}).strict();

type LeadQueryValidation = {
  sortBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
};

function validateLeadQuery(value: LeadQueryValidation, ctx: z.RefinementCtx): void {
  validateSortBy(value, ctx, ["name", "email", "company", "status", "source", "priority", "createdAt", "updatedAt"]);
  const from = value.dateFrom ?? value.createdFrom;
  const to = value.dateTo ?? value.createdTo;
  if (from && to && from > to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateTo"], message: "End date must be on or after start date" });
  }
}

export const leadsQuerySchema = leadsQueryObjectSchema.superRefine(validateLeadQuery);
export const assignedLeadsQuerySchema = leadsQueryObjectSchema
  .omit({ assignedTo: true })
  .superRefine(validateLeadQuery);
