import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { validateEnvironment } from "./config/validateEnvironment.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import leadRouter from "./routes/lead.routes.js";
import customerRouter from "./routes/customer.routes.js";
import dealRouter from "./routes/deal.routes.js";
import activityRouter from "./routes/activity.routes.js";
import timelineRouter from "./routes/timeline.routes.js";
import analyticsRouter from "./routes/analytics.routes.js";

validateEnvironment();

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
const nodeEnv = process.env.NODE_ENV ?? "development";

app.disable("x-powered-by");
app.use(morgan(nodeEnv === "production" ? "combined" : "dev"));
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Try again later." },
}));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/leads", leadRouter);
app.use("/api/customers", customerRouter);
app.use("/api/deals", dealRouter);
app.use("/api/activities", activityRouter);
app.use("/api/timeline", timelineRouter);
app.use("/api/analytics", analyticsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
