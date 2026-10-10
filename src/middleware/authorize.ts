import type { RequestHandler } from "express";
import type { UserRole } from "../models/user.model.js";
import type { Permission } from "../config/permissions.js";
import { hasPermission } from "../config/permissions.js";
import { AppError } from "./errorHandler.js";

export const authorize = (permission: Permission): RequestHandler => (req, _res, next) => {
  if (!req.user) {
    next(new AppError(401, "Authentication is required"));
    return;
  }
  if (!hasPermission(req.user.role, permission)) {
    next(new AppError(403, "You do not have permission to perform this action"));
    return;
  }
  next();
};

export const authorizeRole = (...roles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.user) {
    next(new AppError(401, "Authentication is required"));
    return;
  }
  if (!roles.includes(req.user.role)) {
    next(new AppError(403, "You do not have permission to perform this action"));
    return;
  }
  next();
};
