import { connectDatabase, disconnectDatabase } from "../config/database.js";
import User from "../models/user.model.js";
import Lead from "../models/lead.model.js";
import Customer from "../models/customer.model.js";
import Deal from "../models/deal.model.js";
import Activity from "../models/activity.model.js";
import Timeline from "../models/timeline.model.js";

try {
  await connectDatabase();
  for (const model of [User, Lead, Customer, Deal, Activity, Timeline]) {
    await model.createIndexes();
    console.info("Indexes created for " + model.modelName);
  }
} catch (error) {
  console.error("Index creation failed", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
