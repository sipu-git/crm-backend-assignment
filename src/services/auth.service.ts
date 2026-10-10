import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import User, { type IUser, type UserRole } from "../models/user.model.js";
import type { HydratedDocument } from "mongoose";
import { AppError } from "../middleware/errorHandler.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  managerId: string | null;
  manager: { id: string; name: string; email: string; role: UserRole } | null;
  createdAt: Date;
  updatedAt: Date;
}

async function publicUser(user: HydratedDocument<IUser>): Promise<SafeUser> {
  const manager = user.managerId
    ? await User.findById(user.managerId).select("_id name email role").lean()
    : null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    managerId: user.managerId?.toString() ?? null,
    manager: manager ? {
      id: manager._id.toString(),
      name: manager.name,
      email: manager.email,
      role: manager.role,
    } : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function hashToken(token: string): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) throw new Error("JWT_REFRESH_SECRET must be set");
  return createHmac("sha256", refreshSecret).update(token).digest("hex");
}

function createAccessToken(userId: string): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET must be set");
  const accessTokenTtl = process.env.ACCESS_TOKEN_TTL ?? "2h";
  if (!/^\d+[smhd]$/.test(accessTokenTtl)) throw new Error("ACCESS_TOKEN_TTL is invalid");

  return jwt.sign({}, jwtSecret, {
    subject: userId,
    expiresIn: accessTokenTtl as SignOptions["expiresIn"],
  });
}

async function issueSession(user: HydratedDocument<IUser>) {
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  user.set({ refreshTokenHash: hashToken(refreshToken), refreshTokenExpiresAt: expiresAt });
  await user.save();
  return {
    user: await publicUser(user),
    accessToken: createAccessToken(user._id.toString()),
    refreshToken,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}) {
  const user = await User.create({
    ...input,
    role: input.role ?? "sales_executive",
    managerId: null,
  });
  return issueSession(user);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email }).select("+password +refreshTokenHash +refreshTokenExpiresAt");
  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AppError(401, "Email or password is incorrect");
  }
  if (!user.isActive) throw new AppError(403, "This account is inactive");
  return issueSession(user);
}

export async function refreshSession(refreshToken: string | undefined) {
  if (!refreshToken) throw new AppError(401, "A refresh session is required");
  const user = await User.findOne({ refreshTokenHash: hashToken(refreshToken) })
    .select("+refreshTokenHash +refreshTokenExpiresAt");
  if (!user || !user.isActive || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt <= new Date()) {
    throw new AppError(401, "Refresh session is invalid or expired");
  }
  return issueSession(user);
}

export async function logoutUser(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await User.updateOne(
    { refreshTokenHash: hashToken(refreshToken) },
    { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } },
  );
}
