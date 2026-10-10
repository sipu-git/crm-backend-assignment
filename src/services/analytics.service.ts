import { Types } from "mongoose";
import Activity from "../models/activity.model.js";
import Customer from "../models/customer.model.js";
import Deal, { type DealStage } from "../models/deal.model.js";
import Lead from "../models/lead.model.js";
import User from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { readableRecordScope, teamUserIds } from "../utils/access.js";
import { escapedSearch } from "../utils/query.js";

const openStages: DealStage[] = ["qualification", "discovery", "proposal", "negotiation"];

export async function getSummary(actor: AuthenticatedUser) {
  const scope = await readableRecordScope(actor);
  const now = new Date();
  const [
    totalLeads, newLeads, qualifiedLeads, convertedLeads, totalCustomers, totalDeals,
    openDeals, wonDeals, lostDeals, revenue, expectedRevenue, pendingActivities, overdueActivities,
  ] = await Promise.all([
    Lead.countDocuments(scope),
    Lead.countDocuments({ ...scope, status: "new" }),
    Lead.countDocuments({ ...scope, status: "qualified" }),
    Lead.countDocuments({ ...scope, status: "converted" }),
    Customer.countDocuments(scope),
    Deal.countDocuments(scope),
    Deal.countDocuments({ ...scope, stage: { $in: openStages } }),
    Deal.countDocuments({ ...scope, stage: "won" }),
    Deal.countDocuments({ ...scope, stage: "lost" }),
    Deal.aggregate([{ $match: { ...scope, stage: "won" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Deal.aggregate([{ $match: { ...scope, stage: { $in: openStages } } }, { $group: { _id: null, total: { $sum: "$expectedRevenue" } } }]),
    Activity.countDocuments({ ...scope, status: "pending", dueAt: { $gte: now } }),
    Activity.countDocuments({ ...scope, status: "pending", dueAt: { $lt: now } }),
  ]);

  return {
    totalLeads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    totalCustomers,
    totalDeals,
    openDeals,
    wonDeals,
    lostDeals,
    totalRevenue: revenue[0]?.total ?? 0,
    expectedRevenue: expectedRevenue[0]?.total ?? 0,
    conversionRate: totalLeads === 0 ? 0 : Number((convertedLeads / totalLeads * 100).toFixed(2)),
    pendingActivities,
    overdueActivities,
  };
}

export async function getPipeline(actor: AuthenticatedUser) {
  const scope = await readableRecordScope(actor);
  const grouped = await Deal.aggregate([
    { $match: scope },
    { $group: { _id: "$stage", count: { $sum: 1 }, value: { $sum: "$amount" }, expectedRevenue: { $sum: "$expectedRevenue" } } },
  ]);
  const byStage = new Map(grouped.map((item: { _id: string; count: number; value: number; expectedRevenue: number }) => [item._id, item]));
  const allStages: DealStage[] = [...openStages, "won", "lost"];
  return allStages.map((stage) => {
    const value = byStage.get(stage);
    return { stage, dealCount: value?.count ?? 0, totalValue: value?.value ?? 0, expectedRevenue: value?.expectedRevenue ?? 0 };
  });
}

export async function getTeamPerformance(actor: AuthenticatedUser, search?: string) {
  if (actor.role === "sales_executive") throw new AppError(403, "Team performance is available to managers and admins");
  const ids = actor.role === "sales_manager"
    ? (await teamUserIds(actor)).filter((id) => id.toString() !== actor.id)
    : (await User.find({ role: "sales_executive", isActive: true }).select("_id").lean()).map((user) => new Types.ObjectId(user._id));
  const userFilter: Record<string, unknown> = { _id: { $in: ids } };
  if (search) {
    const pattern = escapedSearch(search);
    userFilter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  const users = await User.find(userFilter).select("_id name email role managerId").lean();
  const idList = users.map((user) => new Types.ObjectId(user._id));

  const [leadStats, customerStats, dealStats] = await Promise.all([
    Lead.aggregate([
      { $match: { assignedTo: { $in: idList } } },
      { $group: { _id: "$assignedTo", totalLeads: { $sum: 1 }, convertedLeads: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } } } },
    ]),
    Customer.aggregate([{ $match: { assignedTo: { $in: idList } } }, { $group: { _id: "$assignedTo", totalCustomers: { $sum: 1 } } }]),
    Deal.aggregate([
      { $match: { assignedTo: { $in: idList } } },
      { $group: {
        _id: "$assignedTo",
        totalDeals: { $sum: 1 },
        openDeals: { $sum: { $cond: [{ $in: ["$stage", openStages] }, 1, 0] } },
        wonDeals: { $sum: { $cond: [{ $eq: ["$stage", "won"] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ["$stage", "won"] }, "$amount", 0] } },
        expectedRevenue: { $sum: { $cond: [{ $in: ["$stage", openStages] }, "$expectedRevenue", 0] } },
      } },
    ]),
  ]);

  const leadsById = new Map(leadStats.map((item: { _id: Types.ObjectId }) => [item._id.toString(), item]));
  const customersById = new Map(customerStats.map((item: { _id: Types.ObjectId }) => [item._id.toString(), item]));
  const dealsById = new Map(dealStats.map((item: { _id: Types.ObjectId }) => [item._id.toString(), item]));

  return users.map((user) => {
    const id = user._id.toString();
    const leads = leadsById.get(id) as { totalLeads?: number; convertedLeads?: number } | undefined;
    const customers = customersById.get(id) as { totalCustomers?: number } | undefined;
    const deals = dealsById.get(id) as { totalDeals?: number; openDeals?: number; wonDeals?: number; revenue?: number; expectedRevenue?: number } | undefined;
    return {
      user: { id, name: user.name, email: user.email, role: user.role },
      totalLeads: leads?.totalLeads ?? 0,
      convertedLeads: leads?.convertedLeads ?? 0,
      totalCustomers: customers?.totalCustomers ?? 0,
      totalDeals: deals?.totalDeals ?? 0,
      openDeals: deals?.openDeals ?? 0,
      wonDeals: deals?.wonDeals ?? 0,
      totalRevenue: deals?.revenue ?? 0,
      expectedRevenue: deals?.expectedRevenue ?? 0,
    };
  });
}
