import { z } from "zod";
import { emailSchema, phoneSchema } from "./common.js";
import { USER_ROLES } from "../models/user.model.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(8).max(72),
  role: z.enum(USER_ROLES).optional().default("sales_executive"),
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
}).strict();

