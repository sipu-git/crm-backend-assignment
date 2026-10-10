import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { getPipeline, getSummary, getTeamPerformance } from "../services/analytics.service.js";
import type { AuthenticatedUser } from "../types/express.js";

export const summary = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Sales summary fetched", await getSummary(req.user as AuthenticatedUser)),
);
export const pipeline = asyncHandler(async (req, res) =>
  sendSuccess(res, 200, "Sales pipeline fetched", await getPipeline(req.user as AuthenticatedUser)),
);
export const teamPerformance = asyncHandler(async (req, res) => {
  const query = getValidated<{ search?: string }>(res, "query");
  return sendSuccess(res, 200, "Team performance fetched", await getTeamPerformance(req.user as AuthenticatedUser, query.search));
});
