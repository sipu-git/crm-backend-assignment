import "dotenv/config";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import User from "../models/user.model.js";

const seedSchema = z.object({
  SEED_ADMIN_NAME: z.string().trim().min(2).max(120),
  SEED_ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
  SEED_ADMIN_PHONE: z.string().trim().min(7).max(30),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(72),
});

const parsed = seedSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PHONE, and a 12+ character SEED_ADMIN_PASSWORD before seeding.");
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    const existing = await User.findOne({ email: parsed.data.SEED_ADMIN_EMAIL }).select("_id");
    if (existing) throw new Error("An account already exists for the configured admin email");
    await User.create({
      name: parsed.data.SEED_ADMIN_NAME,
      email: parsed.data.SEED_ADMIN_EMAIL,
      phone: parsed.data.SEED_ADMIN_PHONE,
      password: parsed.data.SEED_ADMIN_PASSWORD,
      role: "admin",
      isActive: true,
      managerId: null,
    });
    console.info("Initial admin account created");
  } catch (error) {
    console.error("Admin seeding failed", error instanceof Error ? error.name : "UnknownError");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
