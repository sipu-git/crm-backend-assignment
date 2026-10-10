import { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import Activity, { type IActivity, type ActivityType, type ActivityStatus } from "../models/activity.model.js";
import Lead from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import Deal from "../models/deal.model.js";
import User from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { ensureVisible, readableRecordScope, teamUserIds } from "../utils/access.js";
import { paginate, type PaginationInput } from "../utils/pagination.js";
import { combineFilters, escapedSearch } from "../utils/query.js";
import { recordTimeline } from "../utils/timeline.js";

export interface ActivitiesQuery extends PaginationInput {
  type?: ActivityType;
  status?: ActivityStatus | "overdue";
  assignedTo?: string;
  entityType?: "lead" | "customer" | "deal" | "user";
  entityId?: string;
  dueFrom?: Date;
  dueTo?: Date;
}

async function visibleEntity(entityType: "lead" | "customer" | "deal" | "user", entityId: string, actor: AuthenticatedUser) {
  if (entityType === "user") {
    const user = await User.findById(entityId).select("_id role managerId isActive");
    if (!user || !user.isActive) throw new AppError(404, "Related CRM record not found");
    if (actor.role === "sales_executive" && user._id.toString() !== actor.id) throw new AppError(404, "Related CRM record not found");
    if (actor.role === "sales_manager" && !(await teamUserIds(actor)).some((memberId) => memberId.equals(user._id))) throw new AppError(404, "Related CRM record not found");
    return user;
  }
  const record = entityType === "lead"
    ? await Lead.findById(entityId)
    : entityType === "customer"
      ? await Customer.findById(entityId)
      : await Deal.findById(entityId);
  if (!record) throw new AppError(404, "Related CRM record not found");
  await ensureVisible(record, actor);
  return record;
}

async function recordActivityTimeline(input: {
  action: string; entityType: "lead" | "customer" | "deal" | "user"; entityId: Types.ObjectId; performedBy: string;
  previousValue?: unknown; newValue?: unknown; details?: Record<string, unknown>;
}) {
  if (input.entityType === "user") return;
  await recordTimeline({ ...input, entityType: input.entityType });
}

async function ensureActivityAssignee(actor: AuthenticatedUser, userId: string): Promise<Types.ObjectId> {
  const id = new Types.ObjectId(userId);
  const user = await User.findById(id).select("_id role managerId isActive");
  if (!user || !user.isActive) throw new AppError(400, "Activity assignee must be an active user");
  if (actor.role === "sales_executive" && id.toString() !== actor.id) {
    throw new AppError(403, "Sales executives can assign activities only to themselves");
  }
  if (actor.role === "sales_manager" && id.toString() !== actor.id && user.managerId?.toString() !== actor.id) {
    throw new AppError(403, "Managers can assign activities only within their own team");
  }
  return id;
}

async function findVisibleActivity(
  id: string,
  actor: AuthenticatedUser,
  options: { managerCanViewAll?: boolean } = {},
): Promise<HydratedDocument<IActivity>> {
  const activity = await Activity.findById(id);
  if (!activity) throw new AppError(404, "Activity not found");
  await ensureVisible(activity, actor, options);
  return activity;
}

function serializeActivity<T extends { toObject(): Record<string, unknown> }>(activity: T) {
  const result = activity.toObject();
  if (result.status === "pending" && result.dueAt instanceof Date && result.dueAt < new Date()) {
    result.status = "overdue";
  }
  return result;
}

export async function listActivities(query: ActivitiesQuery, actor: AuthenticatedUser) {
  const clauses: Array<FilterQuery<IActivity> | Record<string, unknown>> = [await readableRecordScope(actor)];
  if (query.type) clauses.push({ type: query.type });
  if (query.entityType) clauses.push({ entityType: query.entityType });
  if (query.entityId) clauses.push({ entityId: new Types.ObjectId(query.entityId) });
  if (query.assignedTo) {
    if (actor.role === "sales_executive") {
      const allowed = (await teamUserIds(actor)).some((id) => id.toString() === query.assignedTo);
      if (!allowed) throw new AppError(404, "Resource not found");
    }
    clauses.push({ assignedTo: new Types.ObjectId(query.assignedTo) });
  }
  if (query.status === "completed") clauses.push({ status: "completed" });
  if (query.status === "pending") clauses.push({ status: "pending", dueAt: { $gte: new Date() } });
  if (query.status === "overdue") clauses.push({ status: "pending", dueAt: { $lt: new Date() } });
  if (query.dueFrom || query.dueTo) {
    clauses.push({ dueAt: { ...(query.dueFrom ? { $gte: query.dueFrom } : {}), ...(query.dueTo ? { $lte: query.dueTo } : {}) } });
  }
  if (query.createdFrom || query.createdTo) {
    clauses.push({ createdAt: { ...(query.createdFrom ? { $gte: query.createdFrom } : {}), ...(query.createdTo ? { $lte: query.createdTo } : {}) } });
  }
  if (query.search) {
    const pattern = escapedSearch(query.search);
    clauses.push({ $or: [
      { title: pattern }, { description: pattern }, { type: pattern }, { status: pattern }, { entityType: pattern },
    ] });
  }
  const result = await paginate(Activity, combineFilters<IActivity>(...clauses), query, ["type", "title", "status", "dueAt", "createdAt", "updatedAt"], "dueAt");
  const items = await Activity.populate(result.items, [
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);
  return { ...result, items: items.map((item) => serializeActivity(item)) };
}

export async function getActivity(id: string, actor: AuthenticatedUser) {
  const activity = await findVisibleActivity(id, actor, { managerCanViewAll: true });
  const populated = await Activity.populate(activity, [
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);
  return serializeActivity(populated);
}

export async function createActivity(
  input: { type: ActivityType; title: string; description?: string; assignedTo?: string; dueAt: Date; entityType: "lead" | "customer" | "deal" | "user"; entityId: string },
  actor: AuthenticatedUser,
) {
  await visibleEntity(input.entityType, input.entityId, actor);
  const assignedTo = await ensureActivityAssignee(actor, input.assignedTo ?? actor.id);
  const activity = await Activity.create({
    ...input,
    entityId: new Types.ObjectId(input.entityId),
    assignedTo,
    createdBy: new Types.ObjectId(actor.id),
    status: "pending",
  });
  await recordActivityTimeline({
    action: input.type === "note" ? "note_added" : input.type === "follow_up" ? "follow_up_created" : "activity_created",
    entityType: input.entityType,
    entityId: new Types.ObjectId(input.entityId),
    performedBy: actor.id,
    newValue: { activityId: activity._id.toString(), title: activity.title, type: activity.type },
  });
  return serializeActivity(activity);
}

export async function updateActivity(
  id: string,
  input: Partial<{ type: ActivityType; title: string; description?: string; assignedTo: string; dueAt: Date }>,
  actor: AuthenticatedUser,
) {
  const activity = await findVisibleActivity(id, actor);
  const previousAssignee = activity.assignedTo.toString();
  if (input.type !== undefined) activity.type = input.type;
  if (input.title !== undefined) activity.title = input.title;
  if (input.description !== undefined) activity.description = input.description;
  if (input.dueAt !== undefined) activity.dueAt = input.dueAt;
  if (input.assignedTo !== undefined) activity.assignedTo = await ensureActivityAssignee(actor, input.assignedTo);
  await activity.save();
  if (input.assignedTo !== undefined && input.assignedTo !== previousAssignee) {
    await recordActivityTimeline({
      action: "activity_reassigned",
      entityType: activity.entityType,
      entityId: activity.entityId,
      performedBy: actor.id,
      previousValue: previousAssignee,
      newValue: activity.assignedTo.toString(),
    });
  }
  return serializeActivity(activity);
}

export async function completeActivity(id: string, actor: AuthenticatedUser) {
  const activity = await findVisibleActivity(id, actor);
  if (activity.status === "completed") throw new AppError(409, "Activity is already completed");
  activity.status = "completed";
  activity.completedAt = new Date();
  await activity.save();
  await recordActivityTimeline({
    action: activity.type === "follow_up" ? "follow_up_completed" : "activity_completed",
    entityType: activity.entityType,
    entityId: activity.entityId,
    performedBy: actor.id,
    newValue: { activityId: activity._id.toString(), completedAt: activity.completedAt },
  });
  return serializeActivity(activity);
}

export async function deleteActivity(id: string, actor: AuthenticatedUser) {
  const activity = await findVisibleActivity(id, actor);
  await recordActivityTimeline({
    action: "activity_deleted",
    entityType: activity.entityType,
    entityId: activity.entityId,
    performedBy: actor.id,
    details: { activityId: activity._id.toString(), title: activity.title },
  });
  await activity.deleteOne();
}
