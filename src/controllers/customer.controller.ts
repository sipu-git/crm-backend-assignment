import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as customers from "../services/customer.service.js";
import type { AuthenticatedUser } from "../types/express.js";

export const list = asyncHandler(async (req, res) => {
  const query = getValidated<customers.CustomersQuery>(res, "query");
  const result = await customers.listCustomers(query, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Customers fetched", { items: result.items }, result.meta);
});
export const getById = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "Customer fetched", await customers.getCustomer(id, req.user as AuthenticatedUser));
});
export const create = asyncHandler(async (req, res) => {
  const input = getValidated<Parameters<typeof customers.createCustomer>[0]>(res, "body");
  return sendSuccess(res, 201, "Customer created", await customers.createCustomer(input, req.user as AuthenticatedUser));
});
export const update = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof customers.updateCustomer>[1]>(res, "body");
  return sendSuccess(res, 200, "Customer updated", await customers.updateCustomer(id, input, req.user as AuthenticatedUser));
});
export const remove = asyncHandler(async (req, res) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  await customers.deleteCustomer(id, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Customer deleted");
});
