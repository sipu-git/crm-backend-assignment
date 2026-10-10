import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  MONGODB_URI: z.string().min(1).default("mongodb+srv://sipusagar982_db_user:CrmBackend2026@crm-cluster.eag6nfp.mongodb.net"),
  JWT_SECRET: z.string().min(32).default("local-development-secret-change-before-production"),
  JWT_REFRESH_SECRET: z.string().min(32).default("local-refresh-secret-change-before-production"),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default("2h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Environment configuration is invalid");
}
if (parsedEnv.data.NODE_ENV === "production") {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must be set explicitly in production");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be set explicitly in production");
  if (!process.env.JWT_REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET must be set explicitly in production");
}

export const env = parsedEnv.data;
