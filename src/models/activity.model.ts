import { Schema, model, Types } from "mongoose";

export const ACTIVITY_TYPES = ["call", "email", "meeting", "demo", "follow_up", "reminder", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ActivityStatus = "pending" | "completed";

export interface IActivity {
  type: ActivityType;
  title: string;
  description?: string;
  assignedTo: Types.ObjectId;
  dueAt: Date;
  status: ActivityStatus;
  entityType: "lead" | "customer" | "deal" | "user";
  entityId: Types.ObjectId;
  createdBy: Types.ObjectId;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 5000 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "completed"], required: true, default: "pending" },
    entityType: { type: String, enum: ["lead", "customer", "deal", "user"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

activitySchema.index({ dueAt: 1 });
activitySchema.index({ assignedTo: 1, status: 1, dueAt: 1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

const Activity = model<IActivity>("Activity", activitySchema);
export default Activity;
