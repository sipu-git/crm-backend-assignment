import { Schema, model, Types } from "mongoose";

export const LEAD_SOURCES = ["website", "referral", "social_media", "email", "phone", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_PRIORITIES = ["low", "medium", "high"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export interface ILead {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  description?: string;
  convertedCustomerId?: Types.ObjectId | null;
  convertedDealId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, match: [/^[0-9]{10}$/, "Phone number must be exactly 10 digits"] },
    company: { type: String, trim: true, maxlength: 160 },
    source: { type: String, enum: LEAD_SOURCES, required: true, default: "other" },
    status: { type: String, enum: LEAD_STATUSES, required: true, default: "new" },
    priority: { type: String, enum: LEAD_PRIORITIES, required: true, default: "medium" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, trim: true, maxlength: 5000 },
    convertedCustomerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    convertedDealId: { type: Schema.Types.ObjectId, ref: "Deal", default: null },
  },
  { timestamps: true, versionKey: false },
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ email: 1 });

const Lead = model<ILead>("Lead", leadSchema);
export default Lead;
