import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { listTimeline } from "../services/timeline.service.js";
import type { AuthenticatedUser } from "../types/express.js";

export const list = asyncHandler(async (req, res) => {
  const { entityType, entityId } = getValidated<{ entityType: "lead" | "customer" | "deal"; entityId: string }>(res, "params");
  const query = getValidated<Parameters<typeof listTimeline>[2]>(res, "query");
  const result = await listTimeline(entityType, entityId, query, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Timeline fetched", { items: result.items }, result.meta);
});
