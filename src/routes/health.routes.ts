import { Router } from "express";
import mongoose from "mongoose";

const healthRouter = Router();
healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default healthRouter;
