import mongoose, { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import Lead, { type ILead, type LeadPriority, type LeadSource, type LeadStatus } from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import Deal from "../models/deal.model.js";
import Activity from "../models/activity.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { assignedScope, ensureAssignee, ensureAssigneeByEmail, ensureVisible } from "../utils/access.js";
import { paginate, type PaginationInput } from "../utils/pagination.js";
import { combineFilters, escapedSearch } from "../utils/query.js";
import { recordTimeline } from "../utils/timeline.js";

export interface LeadsQuery extends PaginationInput {
  status?: LeadStatus;
  source?: LeadSource;
  priority?: LeadPriority;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function parseId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function assertLeadStatusTransition(current: LeadStatus, next: LeadStatus): void {
  const allowed: Record<LeadStatus, readonly LeadStatus[]> = {
    new: ["contacted", "qualified", "unqualified", "lost"],
    contacted: ["qualified", "unqualified", "lost"],
    qualified: ["unqualified", "lost"],
    converted: [],
    unqualified: [],
    lost: [],
  };
  if (current === next) throw new AppError(409, `Lead is already ${next}`);
  if (!allowed[current].includes(next)) {
    throw new AppError(409, `Lead status cannot move from ${current} to ${next}`);
  }
}

function assertManagerOrAdmin(actor: AuthenticatedUser, action: string): void {
  if (actor.role !== "admin" && actor.role !== "sales_manager") {
    throw new AppError(403, `Only admins and sales managers can ${action}`);
  }
}

async function findVisibleLead(
  id: string,
  actor: AuthenticatedUser,
  options: { allowUnassignedManagerRecord?: boolean; managerCanViewAll?: boolean } = { allowUnassignedManagerRecord: true },
): Promise<HydratedDocument<ILead>> {
  const lead = await Lead.findById(id);
  if (!lead) throw new AppError(404, "Lead not found");
  await ensureVisible(lead, actor, options);
  return lead;
}

async function leadScope(actor: AuthenticatedUser): Promise<FilterQuery<ILead>> {
  if (actor.role === "admin" || actor.role === "sales_manager") return {};
  return await assignedScope(actor) as FilterQuery<ILead>;
}

export async function listLeads(query: LeadsQuery, actor: AuthenticatedUser) {
  const clauses: Array<FilterQuery<ILead> | Record<string, unknown>> = [await leadScope(actor)];
  if (query.status) clauses.push({ status: query.status });
  if (query.source) clauses.push({ source: query.source });
  if (query.priority) clauses.push({ priority: query.priority });
  if (query.assignedTo) {
    if (actor.role === "sales_executive") {
      const visible = await Lead.findOne({
        assignedTo: parseId(query.assignedTo),
        ...await assignedScope(actor),
      }).select("_id");
      if (!visible) throw new AppError(404, "Resource not found");
    }
    clauses.push({ assignedTo: parseId(query.assignedTo) });
  }
  const dateFrom = query.dateFrom ?? query.createdFrom;
  const dateTo = query.dateTo ?? query.createdTo;
  if (dateFrom || dateTo) {
    clauses.push({ createdAt: { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) } });
  }
  if (query.search) {
    const pattern = escapedSearch(query.search);
    clauses.push({ $or: [
      { name: pattern }, { email: pattern }, { company: pattern }, { phone: pattern },
      { description: pattern }, { status: pattern }, { source: pattern }, { priority: pattern },
    ] });
  }
  const filter = combineFilters<ILead>(...clauses);
  const result = await paginate(Lead, filter, query, ["name", "email", "company", "status", "source", "priority", "createdAt", "updatedAt"]);
  return { ...result, items: await Lead.populate(result.items, { path: "assignedTo", select: "name email role" }) };
}

export async function listAssignedLeads(query: Omit<LeadsQuery, "assignedTo">, actor: AuthenticatedUser) {
  return listLeads({ ...query, assignedTo: actor.id }, actor);
}

export async function getLead(id: string, actor: AuthenticatedUser) {
  const lead = await findVisibleLead(id, actor, { managerCanViewAll: true });
  return Lead.populate(lead, { path: "assignedTo", select: "name email role" });
}

export async function createLead(
  input: { name: string; email?: string; phone?: string; company?: string; source?: LeadSource; priority?: LeadPriority; assignedTo?: string; description?: string },
  actor: AuthenticatedUser,
) {
  const assignedTo = input.assignedTo
    ? await ensureAssignee(actor, input.assignedTo)
    : actor.role === "sales_executive" ? parseId(actor.id) : null;
  const lead = await Lead.create({
    ...input,
    assignedTo,
    createdBy: parseId(actor.id),
  });
  await recordTimeline({
    action: "lead_created",
    entityType: "lead",
    entityId: lead._id,
    performedBy: actor.id,
    newValue: { status: lead.status, priority: lead.priority },
  });
  return lead;
}

export async function updateLead(
  id: string,
  input: Partial<{ name: string; email?: string; phone?: string; company?: string; source: LeadSource; priority: LeadPriority; status: Exclude<LeadStatus, "converted">; assignedTo: string; description?: string }>,
  actor: AuthenticatedUser,
) {
  const lead = await findVisibleLead(id, actor);
  if (lead.status === "converted") throw new AppError(409, "A converted lead cannot be changed");
  if (input.assignedTo !== undefined) {
    input.assignedTo = (await ensureAssignee(actor, input.assignedTo)).toString();
  }
  const previousStatus = lead.status;
  const previousPriority = lead.priority;
  const previousAssignee = lead.assignedTo?.toString() ?? null;
  if (input.status !== undefined) assertLeadStatusTransition(previousStatus, input.status);
  Object.assign(lead, input);
  await lead.save();

  if (input.status && input.status !== previousStatus) {
    await recordTimeline({ action: "lead_status_changed", entityType: "lead", entityId: lead._id, performedBy: actor.id, previousValue: previousStatus, newValue: input.status });
  }
  if (input.priority && input.priority !== previousPriority) {
    await recordTimeline({ action: "lead_priority_changed", entityType: "lead", entityId: lead._id, performedBy: actor.id, previousValue: previousPriority, newValue: input.priority });
  }
  if (input.assignedTo !== undefined && input.assignedTo !== previousAssignee) {
    await recordTimeline({ action: previousAssignee ? "lead_reassigned" : "lead_assigned", entityType: "lead", entityId: lead._id, performedBy: actor.id, previousValue: previousAssignee, newValue: input.assignedTo });
  }
  return lead;
}

export async function setLeadStatus(id: string, status: Exclude<LeadStatus, "converted">, actor: AuthenticatedUser) {
  const lead = await findVisibleLead(id, actor);
  if (lead.status === "converted") throw new AppError(409, "A converted lead cannot change status");
  const previousValue = lead.status;
  assertLeadStatusTransition(previousValue, status);
  lead.status = status;
  await lead.save();
  if (previousValue !== status) {
    await recordTimeline({ action: "lead_status_changed", entityType: "lead", entityId: lead._id, performedBy: actor.id, previousValue, newValue: status });
  }
  return lead;
}

export async function assignLead(id: string, assigneeEmail: string, actor: AuthenticatedUser) {
  const lead = await findVisibleLead(id, actor);
  if (lead.status === "converted") throw new AppError(409, "A converted lead cannot be reassigned");
  const assignee = await ensureAssigneeByEmail(actor, assigneeEmail);
  const previousValue = lead.assignedTo?.toString() ?? null;
  if (previousValue === assignee.toString()) throw new AppError(409, "Lead is already assigned to this user");
  lead.assignedTo = assignee;
  await lead.save();
  await recordTimeline({
    action: previousValue ? "lead_reassigned" : "lead_assigned",
    entityType: "lead",
    entityId: lead._id,
    performedBy: actor.id,
    previousValue,
    newValue: assignee.toString(),
  });
  return lead;
}

export async function convertLead(
  id: string,
  input: {
    customer?: { name?: string; email?: string; phone?: string; company?: string; address?: string };
    deal: { name: string; amount: number; probability: number; expectedClosingDate: Date; description?: string };
  },
  actor: AuthenticatedUser,
) {
  assertManagerOrAdmin(actor, "convert leads");
  const initial = await findVisibleLead(id, actor);
  if (initial.status !== "qualified") throw new AppError(409, "Only qualified leads can be converted");
  if (initial.convertedCustomerId || initial.convertedDealId) throw new AppError(409, "This lead has already been converted");
  if (input.deal.expectedClosingDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    throw new AppError(400, "Expected closing date must be today or in the future");
  }

  const session = await mongoose.startSession();
  let result: { customer: unknown; deal: unknown; lead: unknown } | undefined;
  try {
    await session.withTransaction(async () => {
      const lead = await Lead.findOne({ _id: id, status: "qualified" }).session(session);
      if (!lead) throw new AppError(409, "Lead is no longer eligible for conversion");
      const customerData = input.customer ?? {};
      const customer = new Customer({
        name: customerData.name ?? lead.name,
        email: customerData.email ?? lead.email,
        phone: customerData.phone ?? lead.phone,
        company: customerData.company ?? lead.company,
        address: customerData.address,
        leadId: lead._id,
        assignedTo: lead.assignedTo ?? (actor.role === "sales_executive" ? parseId(actor.id) : null),
        createdBy: parseId(actor.id),
        status: "active",
      });
      await customer.save({ session });

      const deal = new Deal({
        ...input.deal,
        leadId: lead._id,
        customerId: customer._id,
        assignedTo: lead.assignedTo ?? (actor.role === "sales_executive" ? parseId(actor.id) : null),
        createdBy: parseId(actor.id),
        stage: "qualification",
      });
      await deal.save({ session });

      lead.status = "converted";
      lead.convertedCustomerId = customer._id;
      lead.convertedDealId = deal._id;
      await lead.save({ session });

      await recordTimeline({ action: "lead_converted", entityType: "lead", entityId: lead._id, performedBy: actor.id, newValue: { customerId: customer._id.toString(), dealId: deal._id.toString() } }, session);
      await recordTimeline({ action: "customer_created_from_lead", entityType: "customer", entityId: customer._id, performedBy: actor.id, newValue: { leadId: lead._id.toString() } }, session);
      await recordTimeline({ action: "deal_created_from_lead", entityType: "deal", entityId: deal._id, performedBy: actor.id, newValue: { leadId: lead._id.toString(), customerId: customer._id.toString() } }, session);
      result = { customer: customer.toObject(), deal: deal.toObject(), lead: lead.toObject() };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/Transaction numbers are only allowed|replica set|transactions are not supported/i.test(message)) {
      throw new AppError(503, "Lead conversion requires MongoDB transaction support (a replica set or sharded cluster)");
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return result;
}

export async function deleteLead(id: string, actor: AuthenticatedUser) {
  assertManagerOrAdmin(actor, "delete leads");
  const lead = await findVisibleLead(id, actor);
  const hasRelations = await Promise.all([
    Customer.exists({ leadId: lead._id }),
    Deal.exists({ leadId: lead._id }),
    Activity.exists({ entityType: "lead", entityId: lead._id }),
  ]);
  if (hasRelations.some(Boolean)) throw new AppError(409, "Lead has related CRM records and cannot be deleted");
  await recordTimeline({ action: "lead_deleted", entityType: "lead", entityId: lead._id, performedBy: actor.id, details: { name: lead.name } });
  await lead.deleteOne();
}
