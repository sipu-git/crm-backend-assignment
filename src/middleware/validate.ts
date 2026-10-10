import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "./errorHandler.js";

type InputPart = "body" | "query" | "params";
type InputSchemas = Partial<Record<InputPart, ZodType>>;

export const validateRequest = (schemas: InputSchemas): RequestHandler => (req, res, next) => {
  const validated: Partial<Record<InputPart, unknown>> = {};
  for (const part of ["params", "query", "body"] as const) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new AppError(400, "Request validation failed", result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))));
      return;
    }
    validated[part] = result.data;
    req[part] = result.data as any;
  }
  res.locals.validated = validated;
  next();
};

export function getValidated<T>(res: import("express").Response, part: InputPart): T {
  return res.locals.validated?.[part] as T;
}
