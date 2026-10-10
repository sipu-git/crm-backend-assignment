import { z } from "zod";
import { paginationFields, emailSchema, phoneSchema, objectIdSchema, validateSortBy } from "./common.js";
import { CUSTOMER_STATUSES } from "../models/customer.model.js";

const customerFields = {
  name: z.string().trim().min(2).max(160),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: z.string().trim().max(160).optional(),
  address: z.string().trim().max(1000).optional(),
  assignedTo: objectIdSchema.optional(),
  status: z.enum(CUSTOMER_STATUSES).default("active"),
};

export const createCustomerSchema = z.object(customerFields).strict();
export const updateCustomerSchema = z.object({
  name: customerFields.name.optional(),
  email: customerFields.email,
  phone: customerFields.phone,
  company: customerFields.company,
  address: customerFields.address,
  assignedTo: objectIdSchema.optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const customersQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(CUSTOMER_STATUSES).optional(),
  assignedTo: objectIdSchema.optional(),
}).strict().superRefine((value, ctx) => {
  validateSortBy(value, ctx, ["name", "email", "company", "status", "createdAt", "updatedAt"]);
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "createdTo must be on or after createdFrom" });
  }
});
