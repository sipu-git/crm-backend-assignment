import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as activities from "../services/activity.service.js";
import type { AuthenticatedUser } from "../types/express.js";

export const list = asyncHandler(async (req, res) => {
  const query = getValidated<activities.ActivitiesQuery>(res, "query");
  const result = await activities.listActivities(query, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Activities fetched", { items: result.items }, result.meta);
});
export const getById = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "Activity fetched", await activities.getActivity(id, req.user as AuthenticatedUser));
});
export const create = asyncHandler(async (req, res) => {
  const input = getValidated<Parameters<typeof activities.createActivity>[0]>(res, "body");
  return sendSuccess(res, 201, "Activity created", await activities.createActivity(input, req.user as AuthenticatedUser));
});
export const update = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof activities.updateActivity>[1]>(res, "body");
  return sendSuccess(res, 200, "Activity updated", await activities.updateActivity(id, input, req.user as AuthenticatedUser));
});
export const complete = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "Activity completed", await activities.completeActivity(id, req.user as AuthenticatedUser));
});
export const remove = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  await activities.deleteActivity(id, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Activity deleted");
});
