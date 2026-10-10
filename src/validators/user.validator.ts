import { z } from "zod";
import { paginationFields, emailSchema, phoneSchema, validateSortBy } from "./common.js";
import { USER_ROLES } from "../models/user.model.js";

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(8).max(72),
  role: z.enum(USER_ROLES),
  managerEmail: emailSchema.nullable().optional(),
  isActive: z.boolean().default(true),
}).strict().superRefine((value, ctx) => {
  if (value.role !== "sales_executive" && value.managerEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["managerEmail"], message: "Only sales executives can be assigned to a manager" });
  }
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(USER_ROLES).optional(),
  managerEmail: emailSchema.nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const userStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const usersQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict().superRefine((value, ctx) => {
  validateSortBy(value, ctx, ["name", "email", "role", "isActive", "createdAt", "updatedAt"]);
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "createdTo must be on or after createdFrom" });
  }
});
