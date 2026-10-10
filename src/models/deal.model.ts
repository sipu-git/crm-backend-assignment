import { Schema, model, Types } from "mongoose";

export const DEAL_STAGES = ["qualification", "discovery", "proposal", "negotiation", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface IDeal {
  name: string;
  leadId?: Types.ObjectId | null;
  customerId: Types.ObjectId;
  assignedTo: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  amount: number;
  probability: number;
  expectedRevenue: number;
  expectedClosingDate: Date;
  stage: DealStage;
  description?: string;
  lostReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    probability: { type: Number, required: true, min: 0, max: 100, default: 10 },
    expectedRevenue: { type: Number, required: true, min: 0, default: 0 },
    expectedClosingDate: { type: Date, required: true },
    stage: { type: String, enum: DEAL_STAGES, required: true, default: "qualification" },
    description: { type: String, trim: true, maxlength: 5000 },
    lostReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);

dealSchema.pre("validate", function () {
  if (this.stage === "won") {
    this.probability = 100;
    this.expectedRevenue = this.amount;
  } else if (this.stage === "lost") {
    this.expectedRevenue = 0;
  } else {
    this.expectedRevenue = Number((this.amount * this.probability / 100).toFixed(2));
  }
  if (this.stage === "lost" && !this.lostReason?.trim()) {
    this.invalidate("lostReason", "A reason is required for a lost deal");
  }
});

dealSchema.index({ stage: 1, createdAt: -1 });
dealSchema.index({ assignedTo: 1, createdAt: -1 });
dealSchema.index({ expectedClosingDate: 1 });
dealSchema.index({ customerId: 1, createdAt: -1 });
dealSchema.index({ leadId: 1 });

const Deal = model<IDeal>("Deal", dealSchema);
export default Deal;
