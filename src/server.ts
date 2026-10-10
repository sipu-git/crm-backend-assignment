import { createServer } from "node:http";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const server = createServer(app);
server.listen(env.PORT, () => {
  console.info(`CRM Sales Management API listening on ${env.PORT}`);
  // Keep HTTP health checks available if MongoDB is not running locally.
  void connectDatabase().catch((error: unknown) => {
    console.error("MongoDB connection failed:", error);
  });
});

function shutdown(signal: NodeJS.Signals): void {
  console.info(signal + " received; shutting down");
  server.close((error) => {
    if (error) {
      console.error("HTTP server shutdown failed:", error);
      process.exitCode = 1;
      return;
    }
    void disconnectDatabase()
      .catch((disconnectError: unknown) => {
        console.error("MongoDB disconnect failed:", disconnectError);
        process.exitCode = 1;
      })
      .finally(() => {
        process.exitCode ??= 0;
      });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
