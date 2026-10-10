import { Schema, model, Types } from "mongoose";

export const CUSTOMER_STATUSES = ["active", "inactive"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface ICustomer {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  leadId?: Types.ObjectId | null;
  assignedTo: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, match: [/^[0-9]{10}$/, "Phone number must be exactly 10 digits"] },
    company: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 1000 },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: CUSTOMER_STATUSES, required: true, default: "active" },
  },
  { timestamps: true, versionKey: false },
);

customerSchema.index({ email: 1 });
customerSchema.index({ assignedTo: 1, createdAt: -1 });
customerSchema.index({ status: 1, createdAt: -1 });
customerSchema.index({ createdAt: -1 });

const Customer = model<ICustomer>("Customer", customerSchema);
export default Customer;
