import type { UserRole } from "../models/user.model.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
