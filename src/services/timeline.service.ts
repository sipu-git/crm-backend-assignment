import { Types } from "mongoose";
import Customer from "../models/customer.model.js";
import Deal from "../models/deal.model.js";
import Lead from "../models/lead.model.js";
import Timeline from "../models/timeline.model.js";
import { AppError } from "../middleware/errorHandler.js";
import type { AuthenticatedUser } from "../types/express.js";
import { ensureVisible } from "../utils/access.js";
import { paginate, type PaginationInput } from "../utils/pagination.js";
import { escapedSearch } from "../utils/query.js";

export async function listTimeline(
  entityType: "lead" | "customer" | "deal",
  entityId: string,
  query: PaginationInput,
  actor: AuthenticatedUser,
) {
  const id = new Types.ObjectId(entityId);
  const entity = entityType === "lead"
    ? await Lead.findById(id)
    : entityType === "customer"
      ? await Customer.findById(id)
      : await Deal.findById(id);
  if (!entity) throw new AppError(404, "CRM record not found");
  await ensureVisible(entity, actor, { managerCanViewAll: entityType === "lead" });
  const filter: Record<string, unknown> = { entityType, entityId: id };
  if (query.search) {
    const pattern = escapedSearch(query.search);
    filter.$or = [
      { action: pattern },
      { previousValue: pattern },
      { newValue: pattern },
      { "details.name": pattern },
    ];
  }
  const result = await paginate(
    Timeline,
    filter,
    query,
    ["action", "createdAt"],
    "createdAt",
  );
  const items = await Timeline.populate(result.items, { path: "performedBy", select: "name email role" });
  return { ...result, items };
}
