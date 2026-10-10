import type { ErrorRequestHandler, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (typeof error === "object" && error !== null && "name" in error) {
    const typedError = error as { name: string; code?: number; errors?: Record<string, { message?: string }> };
    if (typedError.name === "ValidationError") {
      statusCode = 400;
      message = "Request validation failed";
      details = Object.values(typedError.errors ?? {}).map((item) => item.message).filter(Boolean);
    } else if (typedError.name === "CastError") {
      statusCode = 400;
      message = "Invalid resource identifier";
    } else if (typedError.name === "JsonWebTokenError" || typedError.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Authentication token is invalid or expired";
    } else if (typedError.code === 11000) {
      statusCode = 409;
      message = "A record with this value already exists";
    }
  }

  if (statusCode >= 500) {
    console.error("Unhandled API error", {
      name: error instanceof Error ? error.name : "UnknownError",
      method: req.method,
      path: req.path,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details === undefined ? {} : { details }),
  });
};
