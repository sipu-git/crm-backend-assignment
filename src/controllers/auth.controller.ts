import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getValidated } from "../middleware/validate.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { loginUser, logoutUser, refreshSession, registerUser } from "../services/auth.service.js";
import { getUser } from "../services/user.service.js";
import type { AuthenticatedUser } from "../types/express.js";

const REFRESH_COOKIE = "crm_refresh";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth" });
}

export const register = asyncHandler(async (_req: Request, res: Response) => {
  const input = getValidated<Parameters<typeof registerUser>[0]>(res, "body");
  const session = await registerUser(input);
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, 201, "Account created", { user: session.user, accessToken: session.accessToken });
});

export const login = asyncHandler(async (_req: Request, res: Response) => {
  const input = getValidated<{ email: string; password: string }>(res, "body");
  const session = await loginUser(input);
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, 200, "Signed in", { user: session.user, accessToken: session.accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const session = await refreshSession(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  setRefreshCookie(res, session.refreshToken);
  return sendSuccess(res, 200, "Session refreshed", { user: session.user, accessToken: session.accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  clearRefreshCookie(res);
  return sendSuccess(res, 200, "Signed out");
});

export const currentUser = asyncHandler(async (req, res) => {
  const user = req.user as AuthenticatedUser;
  return sendSuccess(res, 200, "Current user", await getUser(user.id, user));
});
