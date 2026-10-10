import { Types, type HydratedDocument } from "mongoose";
import User, { type IUser, type UserRole } from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";
import { addCreatedDateRange, paginate, type PaginationInput } from "../utils/pagination.js";
import { escapedSearch } from "../utils/query.js";
import type { AuthenticatedUser } from "../types/express.js";

export interface UsersQuery extends PaginationInput {
  role?: UserRole;
  status?: "active" | "inactive";
}

async function safeUsers(users: readonly HydratedDocument<IUser>[]) {
  const managerIds = users.flatMap((user) => user.managerId ? [user.managerId] : []);
  const managers = managerIds.length > 0
    ? await User.find({ _id: { $in: managerIds } }).select("_id name email role").lean()
    : [];
  const managersById = new Map<string, { id: string; name: string; email: string; role: UserRole }>();
  for (const manager of managers) {
    managersById.set(manager._id.toString(), {
      id: manager._id.toString(),
      name: manager.name,
      email: manager.email,
      role: manager.role,
    });
  }

  return users.map((user) => {
    const managerId = user.managerId?.toString() ?? null;
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      managerId,
      manager: managerId ? managersById.get(managerId) ?? null : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });
}

export async function listUsers(query: UsersQuery, actor: AuthenticatedUser) {
  const filter: Record<string, unknown> = actor.role === "admin"? {}: actor.role === "sales_manager"
      ? { $and: [{ $or: [{ _id: new Types.ObjectId(actor.id) }, { managerId: new Types.ObjectId(actor.id) }] }] }
      : { _id: new Types.ObjectId(actor.id) };
  if (query.role) filter.role = query.role;
  if (query.status) filter.isActive = query.status === "active";
  if (query.search) {
    const pattern = escapedSearch(query.search);
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { role: pattern }];
  }
  addCreatedDateRange(filter, query);
  const result = await paginate(User, filter, query, ["name", "email", "role", "isActive", "createdAt", "updatedAt"]);
  return { ...result, items: await safeUsers(result.items) };
}

export async function getUser(userId: string, actor: AuthenticatedUser) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  if (actor.role === "sales_executive" && user._id.toString() !== actor.id) throw new AppError(404, "User not found");
  if (actor.role === "sales_manager" && user._id.toString() !== actor.id && user.managerId?.toString() !== actor.id) {
    throw new AppError(404, "User not found");
  }
  return (await safeUsers([user]))[0];
}

async function validateManagerEmail(managerEmail: string | null | undefined) {
  if (!managerEmail) return null;
  const manager = await User.findOne({ email: managerEmail.trim().toLowerCase() }).select("_id role isActive");
  if (!manager || manager.role !== "sales_manager" || !manager.isActive) {
    throw new AppError(400, "managerEmail must refer to an active sales manager");
  }
  return manager._id;
}

export async function createUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  managerEmail?: string | null;
  isActive?: boolean;
}, actor: AuthenticatedUser) {
  if (actor.role === "sales_manager") {
    if (input.role !== "sales_executive" || (input.managerEmail && input.managerEmail.toLowerCase() !== actor.email.toLowerCase())) {
      throw new AppError(403, "Managers can create sales executives only within their own team");
    }
    input = { ...input, managerEmail: actor.email };
  } else if (actor.role !== "admin") {
    throw new AppError(403, "You do not have permission to create users");
  }
  let managerId: Types.ObjectId | null = null;
  if (input.role === "sales_executive") {
    managerId = actor.role === "sales_manager"
      ? new Types.ObjectId(actor.id)
      : await validateManagerEmail(input.managerEmail);
  }
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    role: input.role,
    isActive: input.isActive,
    managerId,
  });
  return (await safeUsers([user]))[0];
}

export async function updateUser(
  userId: string,
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    managerEmail: string | null;
    isActive: boolean;
  }>,
  actor: AuthenticatedUser,
) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError(404, "User not found");
  if (userId === actor.id && input.isActive === false) throw new AppError(400, "You cannot deactivate your own account");
  if (actor.role === "sales_manager") {
    if (user.role !== "sales_executive" || user.managerId?.toString() !== actor.id) throw new AppError(404, "User not found");
    if (input.role !== undefined || input.managerEmail !== undefined) throw new AppError(403, "Managers cannot change user roles or team assignments");
  } else if (actor.role !== "admin") {
    throw new AppError(403, "You do not have permission to update users");
  }

  const nextRole = input.role ?? user.role;
  if (nextRole !== "sales_executive" && input.managerEmail) {
    throw new AppError(400, "Only sales executives can be assigned to a manager");
  }
  if (nextRole === "sales_executive" && input.managerEmail !== undefined) {
    user.managerId = await validateManagerEmail(input.managerEmail);
  } else if (user.role !== "sales_executive" && nextRole === "sales_executive") {
    user.managerId = null;
  } else if (input.role !== undefined && input.role !== "sales_executive") {
    user.managerId = null;
  }

  if (
    user.role === "sales_manager" &&
    ((input.role !== undefined && input.role !== "sales_manager") || input.isActive === false)
  ) {
    const directReports = await User.countDocuments({ managerId: user._id, isActive: true });
    if (directReports > 0) throw new AppError(409, "Reassign or deactivate this manager's active team members first");
  }

  if (user.role === "admin" && ((input.role !== undefined && input.role !== "admin") || input.isActive === false)) {
    const activeAdmins = await User.countDocuments({ role: "admin", isActive: true, _id: { $ne: user._id } });
    if (activeAdmins === 0) throw new AppError(409, "Cannot remove or deactivate the last active admin");
  }

  if (input.password) user.password = input.password;
  if (input.name !== undefined) user.name = input.name;
  if (input.email !== undefined) user.email = input.email;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.role !== undefined) user.role = input.role;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  await user.save();
  return (await safeUsers([user]))[0];
}

export async function deactivateUser(userId: string, actor: AuthenticatedUser) {
  return updateUser(userId, { isActive: false }, actor);
}
