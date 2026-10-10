import { z } from "zod";
import { paginationFields, objectIdSchema, dateSchema, validateSortBy } from "./common.js";
import { ACTIVITY_TYPES } from "../models/activity.model.js";

const activityStatus = z.enum(["pending", "completed", "overdue"]);
const entityType = z.enum(["lead", "customer", "deal", "user"]);

export const createActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional(),
  assignedTo: objectIdSchema.optional(),
  dueAt: dateSchema,
  entityType,
  entityId: objectIdSchema,
}).strict();

export const updateActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(5000).optional(),
  assignedTo: objectIdSchema.optional(),
  dueAt: dateSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const activitiesQuerySchema = z.object({
  ...paginationFields,
  type: z.enum(ACTIVITY_TYPES).optional(),
  status: activityStatus.optional(),
  assignedTo: objectIdSchema.optional(),
  entityType: entityType.optional(),
  entityId: objectIdSchema.optional(),
  dueFrom: dateSchema.optional(),
  dueTo: dateSchema.optional(),
}).strict().superRefine((value, ctx) => {
  validateSortBy(value, ctx, ["type", "title", "status", "dueAt", "createdAt", "updatedAt"]);
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdTo"], message: "createdTo must be on or after createdFrom" });
  }
  if (value.dueFrom && value.dueTo && value.dueFrom > value.dueTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dueTo"], message: "dueTo must be on or after dueFrom" });
  }
});
