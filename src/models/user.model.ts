import bcrypt from "bcryptjs";
import { Schema, model, Types } from "mongoose";

export const USER_ROLES = ["admin", "sales_manager", "sales_executive"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  managerId: Types.ObjectId | null;
  refreshTokenHash?: string;
  refreshTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, match: [/^[0-9]{10}$/, "Phone number must be exactly 10 digits"] },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: "sales_executive" },
    isActive: { type: Boolean, required: true, default: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiresAt: { type: Date, select: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ managerId: 1, isActive: 1 });

userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
});

const User = model<IUser>("User", userSchema);
export default User;
