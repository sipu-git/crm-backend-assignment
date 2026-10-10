import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { createUser, deactivateUser, getUser, listUsers, updateUser } from "../services/user.service.js";
import type { AuthenticatedUser } from "../types/express.js";
import { Request, Response } from "express";

export const list = asyncHandler(async (req:Request, res:Response) => {
  const query = getValidated<Parameters<typeof listUsers>[0]>(res, "query");
  const result = await listUsers(query, req.user as AuthenticatedUser);
  return sendSuccess(res, 200, "Users fetched", { items: result.items }, result.meta);
});

export const getById = asyncHandler(async (req:Request, res:Response) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "User fetched", await getUser(id, req.user as AuthenticatedUser));
});

export const create = asyncHandler(async (req:Request, res:Response) => {
  const input = getValidated<Parameters<typeof createUser>[0]>(res, "body");
  return sendSuccess(res, 201, "User created", await createUser(input, req.user as AuthenticatedUser));
});

export const update = asyncHandler(async (req:Request, res:Response) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  const input = getValidated<Parameters<typeof updateUser>[1]>(res, "body");
  return sendSuccess(res, 200, "User updated", await updateUser(id, input, req.user as AuthenticatedUser));
});

export const deactivate = asyncHandler(async (req:Request, res:Response) => {
  const { id } = getValidated<{ id: string }>(res, "params");
  return sendSuccess(res, 200, "User deactivated", await deactivateUser(id, req.user as AuthenticatedUser));
});
