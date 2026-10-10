import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as deals from "../services/deal.service.js";
import type { AuthenticatedUser } from "../types/express.js";

export const list = asyncHandler(async (req, res) => {
  const query = getValidated<deals.DealsQuery>(res, "query");
  const result = await deals.listDeals(query, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Deals fetched", { items: result.items }, result.meta);
});
export const getById = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "Deal fetched", await deals.getDeal(id, req.user as AuthenticatedUser));
});
export const create = asyncHandler(async (req, res) => {
  const input = getValidated<Parameters<typeof deals.createDeal>[0]>(res, "body");
  return sendSuccess(res, 201, "Deal created", await deals.createDeal(input, req.user as AuthenticatedUser));
});
export const update = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof deals.updateDeal>[1]>(res, "body");
  return sendSuccess(res, 200, "Deal updated", await deals.updateDeal(id, input, req.user as AuthenticatedUser));
});
export const stage = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<{ stage: Parameters<typeof deals.changeDealStage>[1]; lostReason?: string }>(res, "body");
  return sendSuccess(res, 200, "Deal stage updated", await deals.changeDealStage(id, input.stage, input.lostReason, req.user as AuthenticatedUser));
});
export const remove = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  await deals.deleteDeal(id, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Deal deleted");
});
