import { Schema, model, Types } from "mongoose";

export type TimelineEntityType = "lead" | "customer" | "deal";
export interface ITimeline {
  action: string;
  entityType: TimelineEntityType;
  entityId: Types.ObjectId;
  performedBy: Types.ObjectId;
  previousValue?: unknown;
  newValue?: unknown;
  details?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const timelineSchema = new Schema<ITimeline>(
  {
    action: { type: String, required: true, trim: true, maxlength: 120 },
    entityType: { type: String, enum: ["lead", "customer", "deal"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false },
);

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
timelineSchema.index({ performedBy: 1, createdAt: -1 });

const Timeline = model<ITimeline>("Timeline", timelineSchema);
export default Timeline;
