import type { Response } from "express";

export function sendSuccess(
  res: Response,
  statusCode: number,
  message: string,
  data?: unknown,
  meta?: unknown,
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
    ...(meta === undefined ? {} : { meta }),
  });
}
