import { Types, type HydratedDocument } from "mongoose";
import User, { type IUser } from "../models/user.model.js";
import type { AuthenticatedUser } from "../types/express.js";
import { AppError } from "../middleware/errorHandler.js";

export async function teamUserIds(actor: AuthenticatedUser): Promise<Types.ObjectId[]> {
  const self = new Types.ObjectId(actor.id);
  if (actor.role !== "sales_manager") return [self];
  const reports = await User.find({ managerId: self }).select("_id").lean();
  return [self, ...reports.map((report) => new Types.ObjectId(report._id))];
}

export async function assignedScope(actor: AuthenticatedUser): Promise<Record<string, unknown>> {
  if (actor.role === "admin") return {};
  if (actor.role === "sales_manager") {
    return { $or: [{ assignedTo: { $in: await teamUserIds(actor) } }, { createdBy: new Types.ObjectId(actor.id) }] };
  }
  return { assignedTo: new Types.ObjectId(actor.id) };
}

type AssigneeRecord = Pick<HydratedDocument<IUser>, "_id" | "role" | "isActive" | "managerId">;

function validateAssignee(actor: AuthenticatedUser, assignee: AssigneeRecord | null) {
  if (!assignee || !assignee.isActive || assignee.role !== "sales_executive") {
    throw new AppError(400, "The assignee must be an active sales executive");
  }
  if (actor.role === "sales_manager" && assignee.managerId?.toString() !== actor.id) {
    throw new AppError(403, "Managers can assign records only within their own team");
  }
  if (actor.role === "sales_executive" && assignee._id.toString() !== actor.id) {
    throw new AppError(403, "Sales executives can assign records only to themselves");
  }
  return assignee._id;
}

export async function ensureAssignee(actor: AuthenticatedUser, userId: string): Promise<Types.ObjectId> {
  const assignee = await User.findById(userId).select("_id role isActive managerId");
  return validateAssignee(actor, assignee);
}

export async function ensureAssigneeByEmail(actor: AuthenticatedUser, email: string): Promise<Types.ObjectId> {
  const assignee = await User.findOne({ email: email.trim().toLowerCase() }).select("_id role isActive managerId");
  return validateAssignee(actor, assignee);
}

export interface VisibilityOptions {
  allowUnassignedManagerRecord?: boolean;
  managerCanViewAll?: boolean;
}

export async function ensureVisible(
  record: { assignedTo?: Types.ObjectId | null; createdBy?: Types.ObjectId | null },
  actor: AuthenticatedUser,
  options: VisibilityOptions = {},
): Promise<void> {
  if (actor.role === "admin") return;
  if (actor.role === "sales_executive" && record.assignedTo?.toString() !== actor.id) {
    throw new AppError(404, "Resource not found");
  }
  if (actor.role === "sales_manager") {
    if (options.managerCanViewAll) return;
    const members = await teamUserIds(actor);
    const isUnassignedManagerRecord = options.allowUnassignedManagerRecord && !record.assignedTo;
    if (record.createdBy?.toString() !== actor.id && !isUnassignedManagerRecord && (!record.assignedTo || !members.some((member) => member.equals(record.assignedTo)))) {
      throw new AppError(404, "Resource not found");
    }
  }
}
