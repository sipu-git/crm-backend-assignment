import { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import Customer, { type ICustomer, type CustomerStatus } from "../models/customer.model.js";
import Lead from "../models/lead.model.js";
import Deal from "../models/deal.model.js";
import Activity from "../models/activity.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { assignedScope, ensureAssignee, ensureVisible } from "../utils/access.js";
import { paginate, type PaginationInput } from "../utils/pagination.js";
import { combineFilters, escapedSearch } from "../utils/query.js";
import { recordTimeline } from "../utils/timeline.js";

export interface CustomersQuery extends PaginationInput {
  status?: CustomerStatus;
  assignedTo?: string;
}

async function findVisibleCustomer(id: string, actor: AuthenticatedUser): Promise<HydratedDocument<ICustomer>> {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, "Customer not found");
  await ensureVisible(customer, actor);
  return customer;
}

export async function listCustomers(query: CustomersQuery, actor: AuthenticatedUser) {
  const clauses: Array<FilterQuery<ICustomer> | Record<string, unknown>> = [await assignedScope(actor)];
  if (query.status) clauses.push({ status: query.status });
  if (query.assignedTo) {
    if (actor.role !== "admin") {
      const visible = await Customer.findOne({ assignedTo: new Types.ObjectId(query.assignedTo), ...await assignedScope(actor) }).select("_id");
      if (!visible) throw new AppError(404, "Resource not found");
    }
    clauses.push({ assignedTo: new Types.ObjectId(query.assignedTo) });
  }
  if (query.createdFrom || query.createdTo) {
    clauses.push({ createdAt: { ...(query.createdFrom ? { $gte: query.createdFrom } : {}), ...(query.createdTo ? { $lte: query.createdTo } : {}) } });
  }
  if (query.search) {
    const pattern = escapedSearch(query.search);
    clauses.push({ $or: [
      { name: pattern }, { email: pattern }, { company: pattern }, { phone: pattern },
      { address: pattern }, { status: pattern },
    ] });
  }
  const result = await paginate(Customer, combineFilters<ICustomer>(...clauses), query, ["name", "email", "company", "status", "createdAt", "updatedAt"]);
  return { ...result, items: await Customer.populate(result.items, [
    { path: "assignedTo", select: "name email role" },
    { path: "leadId", select: "name email status" },
  ]) };
}

export async function getCustomer(id: string, actor: AuthenticatedUser) {
  const customer = await findVisibleCustomer(id, actor);
  return Customer.populate(customer, [
    { path: "assignedTo", select: "name email role" },
    { path: "leadId", select: "name email status" },
  ]);
}

export async function createCustomer(
  input: { name: string; email?: string; phone?: string; company?: string; address?: string; assignedTo?: string; status?: CustomerStatus },
  actor: AuthenticatedUser,
) {
  const assignedTo = input.assignedTo
    ? await ensureAssignee(actor, input.assignedTo)
    : actor.role === "sales_executive" ? new Types.ObjectId(actor.id) : null;
  const customer = await Customer.create({ ...input, assignedTo, createdBy: new Types.ObjectId(actor.id), leadId: null });
  await recordTimeline({ action: "customer_created", entityType: "customer", entityId: customer._id, performedBy: actor.id });
  return customer;
}

export async function updateCustomer(
  id: string,
  input: Partial<{ name: string; email?: string; phone?: string; company?: string; address?: string; assignedTo: string; status: CustomerStatus }>,
  actor: AuthenticatedUser,
) {
  const customer = await findVisibleCustomer(id, actor);
  const previousAssignee = customer.assignedTo?.toString() ?? null;
  if (input.assignedTo !== undefined) customer.assignedTo = await ensureAssignee(actor, input.assignedTo);
  if (input.name !== undefined) customer.name = input.name;
  if (input.email !== undefined) customer.email = input.email;
  if (input.phone !== undefined) customer.phone = input.phone;
  if (input.company !== undefined) customer.company = input.company;
  if (input.address !== undefined) customer.address = input.address;
  if (input.status !== undefined) customer.status = input.status;
  await customer.save();

  if (input.assignedTo !== undefined && input.assignedTo !== previousAssignee) {
    await recordTimeline({
      action: previousAssignee ? "customer_reassigned" : "customer_assigned",
      entityType: "customer",
      entityId: customer._id,
      performedBy: actor.id,
      previousValue: previousAssignee,
      newValue: input.assignedTo,
    });
  }
  await recordTimeline({ action: "customer_updated", entityType: "customer", entityId: customer._id, performedBy: actor.id });
  return customer;
}

export async function deleteCustomer(id: string, actor: AuthenticatedUser) {
  const customer = await findVisibleCustomer(id, actor);
  const related = await Promise.all([
    Lead.exists({ convertedCustomerId: customer._id }),
    Deal.exists({ customerId: customer._id }),
    Activity.exists({ entityType: "customer", entityId: customer._id }),
  ]);
  if (related.some(Boolean)) throw new AppError(409, "Customer has related CRM records and cannot be deleted");
  await recordTimeline({ action: "customer_deleted", entityType: "customer", entityId: customer._id, performedBy: actor.id, details: { name: customer.name } });
  await customer.deleteOne();
}
