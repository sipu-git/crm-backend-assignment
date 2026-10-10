import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import User from "../models/user.model.js";
import { AppError } from "./errorHandler.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) throw new AppError(401, "Authentication is required");

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new AppError(500, "Authentication is not configured");

    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new AppError(401, "Authentication token is invalid");

    const user = await User.findById(payload.sub).select("_id name email phone role isActive managerId createdAt updatedAt");
    if (!user || !user.isActive) throw new AppError(401, "Account is unavailable");

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      managerId: user.managerId?.toString() ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    next();
  } catch (error) {
    next(error);
  }
};
