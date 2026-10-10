import type { ClientSession, Types } from "mongoose";
import Timeline, { type TimelineEntityType } from "../models/timeline.model.js";

export interface TimelineEntryInput {
  action: string;
  entityType: TimelineEntityType;
  entityId: Types.ObjectId;
  performedBy: Types.ObjectId | string;
  previousValue?: unknown;
  newValue?: unknown;
  details?: Record<string, unknown>;
}

export async function recordTimeline(input: TimelineEntryInput, session?: ClientSession): Promise<void> {
  const entry = new Timeline(input);
  await entry.save(session ? { session } : undefined);
}
