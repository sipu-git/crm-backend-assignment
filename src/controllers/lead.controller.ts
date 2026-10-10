import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as leads from "../services/lead.service.js";
import type { AuthenticatedUser } from "../types/express.js";

function actor(req: import("express").Request): AuthenticatedUser {
  return req.user as AuthenticatedUser;
}

export const list = asyncHandler(async (req, res) => {
  const query = getValidated<leads.LeadsQuery>(res, "query");
  const result = await leads.listLeads(query, actor(req));
  return sendSuccess(res, 200, "Leads fetched", { items: result.items }, result.meta);
});
export const listAssignedToMe = asyncHandler(async (req, res) => {
  const query = getValidated<Omit<leads.LeadsQuery, "assignedTo">>(res, "query");
  const result = await leads.listAssignedLeads(query, actor(req));
  return sendSuccess(res, 200, "Assigned leads fetched", { items: result.items }, result.meta);
});
export const getById = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "Lead fetched", await leads.getLead(id, actor(req)));
});
export const create = asyncHandler(async (req, res) => {
  const input = getValidated<Parameters<typeof leads.createLead>[0]>(res, "body");
  return sendSuccess(res, 201, "Lead created", await leads.createLead(input, actor(req)));
});
export const update = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof leads.updateLead>[1]>(res, "body");
  return sendSuccess(res, 200, "Lead updated", await leads.updateLead(id, input, actor(req)));
});
export const status = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const { status: leadStatus } = getValidated<{ status: Parameters<typeof leads.setLeadStatus>[1] }>(res, "body");
  return sendSuccess(res, 200, "Lead status updated", await leads.setLeadStatus(id, leadStatus, actor(req)));
});
export const assign = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const { email } = getValidated<{ email: string }>(res, "body");
  return sendSuccess(res, 200, "Lead assignment updated", await leads.assignLead(id, email, actor(req)));
});
export const convert = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof leads.convertLead>[1]>(res, "body");
  return sendSuccess(res, 201, "Lead converted", await leads.convertLead(id, input, actor(req)));
});
export const remove = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  await leads.deleteLead(id, actor(req));
  return sendSuccess(res, 200, "Lead deleted");
});
