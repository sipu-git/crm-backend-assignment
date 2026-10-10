import { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import Deal, { type IDeal, type DealStage } from "../models/deal.model.js";
import Customer, { type ICustomer } from "../models/customer.model.js";
import Lead, { type ILead } from "../models/lead.model.js";
import Activity from "../models/activity.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { assignedScope, ensureAssignee, ensureVisible, readableRecordScope } from "../utils/access.js";
import { paginate, type PaginationInput } from "../utils/pagination.js";
import { combineFilters, escapedSearch } from "../utils/query.js";
import { recordTimeline } from "../utils/timeline.js";

export interface DealsQuery extends PaginationInput {
  stage?: DealStage;
  assignedTo?: string;
  minAmount?: number;
  maxAmount?: number;
  closingFrom?: Date;
  closingTo?: Date;
  status?: "open" | "closed" | "won" | "lost";
}

async function findVisibleDeal(
  id: string,
  actor: AuthenticatedUser,
  options: { managerCanViewAll?: boolean } = {},
): Promise<HydratedDocument<IDeal>> {
  const deal = await Deal.findById(id);
  if (!deal) throw new AppError(404, "Deal not found");
  await ensureVisible(deal, actor, options);
  return deal;
}

function assertStageTransition(current: DealStage, next: DealStage): void {
  const order: DealStage[] = ["qualification", "discovery", "proposal", "negotiation", "won"];
  if (current === "won" || current === "lost") {
    if (next !== current) throw new AppError(409, "Closed deals cannot be reopened or moved to another stage");
    return;
  }
  if (next === "lost") return;
  if (order.indexOf(next) < order.indexOf(current)) {
    throw new AppError(409, `Deal stage cannot move backward from ${current} to ${next}`);
  }
}

async function visibleCustomer(customerId: string, actor: AuthenticatedUser) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError(400, "Customer not found");
  await ensureVisible(customer, actor);
  return customer;
}

function validateExpectedCloseDate(stage: DealStage, date: Date): void {
  if (stage !== "won" && stage !== "lost" && date < new Date(new Date().setHours(0, 0, 0, 0))) {
    throw new AppError(400, "Expected closing date for an open deal must be today or in the future");
  }
}

export async function listDeals(query: DealsQuery, actor: AuthenticatedUser) {
  const clauses: Array<FilterQuery<IDeal> | Record<string, unknown>> = [await readableRecordScope(actor)];
  if (query.stage) clauses.push({ stage: query.stage });
  if (query.status === "open") clauses.push({ stage: { $nin: ["won", "lost"] } });
  if (query.status === "closed") clauses.push({ stage: { $in: ["won", "lost"] } });
  if (query.status === "won") clauses.push({ stage: "won" });
  if (query.status === "lost") clauses.push({ stage: "lost" });
  if (query.assignedTo) {
    if (actor.role === "sales_executive") {
      const visible = await Deal.findOne({ assignedTo: new Types.ObjectId(query.assignedTo), ...await assignedScope(actor) }).select("_id");
      if (!visible) throw new AppError(404, "Resource not found");
    }
    clauses.push({ assignedTo: new Types.ObjectId(query.assignedTo) });
  }
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    clauses.push({ amount: { ...(query.minAmount !== undefined ? { $gte: query.minAmount } : {}), ...(query.maxAmount !== undefined ? { $lte: query.maxAmount } : {}) } });
  }
  if (query.closingFrom || query.closingTo) {
    clauses.push({ expectedClosingDate: { ...(query.closingFrom ? { $gte: query.closingFrom } : {}), ...(query.closingTo ? { $lte: query.closingTo } : {}) } });
  }
  if (query.createdFrom || query.createdTo) {
    clauses.push({ createdAt: { ...(query.createdFrom ? { $gte: query.createdFrom } : {}), ...(query.createdTo ? { $lte: query.createdTo } : {}) } });
  }
  if (query.search) {
    const pattern = escapedSearch(query.search);
    const relatedScope = await readableRecordScope(actor);
    const [matchingCustomers, matchingLeads] = await Promise.all([
      Customer.find(combineFilters<ICustomer>(relatedScope, {
        $or: [{ name: pattern }, { email: pattern }, { company: pattern }, { phone: pattern }],
      })).select("_id"),
      Lead.find(combineFilters<ILead>(relatedScope, {
        $or: [{ name: pattern }, { email: pattern }, { company: pattern }, { phone: pattern }],
      })).select("_id"),
    ]);
    const matchingCustomerIds = matchingCustomers.map((customer) => customer._id);
    const matchingLeadIds = matchingLeads.map((lead) => lead._id);
    clauses.push({ $or: [
      { name: pattern }, { stage: pattern }, { description: pattern }, { lostReason: pattern },
      { customerId: { $in: matchingCustomerIds } }, { leadId: { $in: matchingLeadIds } },
    ] });
  }
  const result = await paginate(Deal, combineFilters<IDeal>(...clauses), query, ["name", "stage", "amount", "probability", "expectedRevenue", "expectedClosingDate", "createdAt", "updatedAt"]);
  return { ...result, items: await Deal.populate(result.items, [
    { path: "assignedTo", select: "name email role" },
    { path: "customerId", select: "name email company" },
    { path: "leadId", select: "name email status" },
  ]) };
}

export async function getDeal(id: string, actor: AuthenticatedUser) {
  const deal = await findVisibleDeal(id, actor, { managerCanViewAll: true });
  return Deal.populate(deal, [
    { path: "assignedTo", select: "name email role" },
    { path: "customerId", select: "name email company" },
    { path: "leadId", select: "name email status" },
  ]);
}

export async function createDeal(
  input: { name: string; leadId?: string | null; customerId: string; assignedTo?: string; amount: number; probability: number; expectedClosingDate: Date; stage: DealStage; description?: string; lostReason?: string },
  actor: AuthenticatedUser,
) {
  const customer = await visibleCustomer(input.customerId, actor);
  if (input.leadId) {
    const lead = await Lead.findById(input.leadId);
    if (!lead || lead.convertedCustomerId?.toString() !== customer._id.toString()) {
      throw new AppError(400, "The selected lead must be converted to the selected customer");
    }
    await ensureVisible(lead, actor);
  }
  const assignedTo = input.assignedTo
    ? await ensureAssignee(actor, input.assignedTo)
    : actor.role === "sales_executive" ? new Types.ObjectId(actor.id) : null;
  validateExpectedCloseDate(input.stage, input.expectedClosingDate);
  const deal = await Deal.create({ ...input, leadId: input.leadId ?? null, assignedTo, createdBy: new Types.ObjectId(actor.id) });
  await recordTimeline({ action: "deal_created", entityType: "deal", entityId: deal._id, performedBy: actor.id, newValue: { stage: deal.stage, amount: deal.amount } });
  return deal;
}

export async function updateDeal(
  id: string,
  input: Partial<{ name: string; customerId: string; assignedTo: string; amount: number; probability: number; expectedClosingDate: Date; stage: DealStage; description?: string; lostReason?: string }>,
  actor: AuthenticatedUser,
) {
  const deal = await findVisibleDeal(id, actor);
  const wasClosed = deal.stage === "won" || deal.stage === "lost";
  if (wasClosed) {
    if (input.stage && input.stage !== deal.stage) throw new AppError(409, "Closed deals cannot be reopened or moved to another stage");
    const immutableChange = input.amount !== undefined || input.probability !== undefined ||
      input.expectedClosingDate !== undefined || input.customerId !== undefined ||
      input.assignedTo !== undefined;
    if (immutableChange) throw new AppError(409, "Closed deal financial and ownership fields cannot be changed");
  }
  const previousStage = deal.stage;
  const previousAssignee = deal.assignedTo?.toString() ?? null;
  if (input.customerId) {
    const customer = await visibleCustomer(input.customerId, actor);
    deal.customerId = customer._id;
  }
  if (input.assignedTo !== undefined) deal.assignedTo = await ensureAssignee(actor, input.assignedTo);
  if (input.stage !== undefined) {
    assertStageTransition(deal.stage, input.stage);
    deal.stage = input.stage;
  }
  if (input.name !== undefined) deal.name = input.name;
  if (input.amount !== undefined) deal.amount = input.amount;
  if (input.probability !== undefined) deal.probability = input.probability;
  if (input.expectedClosingDate !== undefined) deal.expectedClosingDate = input.expectedClosingDate;
  if (input.description !== undefined) deal.description = input.description;
  if (input.lostReason !== undefined) deal.lostReason = input.lostReason;
  validateExpectedCloseDate(deal.stage, deal.expectedClosingDate);
  await deal.save();

  if (previousStage !== deal.stage) {
    await recordTimeline({ action: deal.stage === "won" ? "deal_won" : deal.stage === "lost" ? "deal_lost" : "deal_stage_changed", entityType: "deal", entityId: deal._id, performedBy: actor.id, previousValue: previousStage, newValue: deal.stage });
  }
  if (input.assignedTo !== undefined && input.assignedTo !== previousAssignee) {
    await recordTimeline({ action: previousAssignee ? "deal_reassigned" : "deal_assigned", entityType: "deal", entityId: deal._id, performedBy: actor.id, previousValue: previousAssignee, newValue: deal.assignedTo?.toString() });
  }
  return deal;
}

export async function changeDealStage(id: string, stage: DealStage, lostReason: string | undefined, actor: AuthenticatedUser) {
  return updateDeal(id, { stage, ...(lostReason === undefined ? {} : { lostReason }) }, actor);
}

export async function deleteDeal(id: string, actor: AuthenticatedUser) {
  if (actor.role !== "admin" && actor.role !== "sales_manager") {
    throw new AppError(403, "Only admins and sales managers can delete deals");
  }
  const deal = await findVisibleDeal(id, actor);
  if (await Activity.exists({ entityType: "deal", entityId: deal._id })) {
    throw new AppError(409, "Deal has related activities and cannot be deleted");
  }
  await recordTimeline({ action: "deal_deleted", entityType: "deal", entityId: deal._id, performedBy: actor.id, details: { name: deal.name } });
  await deal.deleteOne();
}
