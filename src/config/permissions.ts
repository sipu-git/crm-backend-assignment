import type { UserRole } from "../models/user.model.js";

export type PermissionResource =
  | "auth"
  | "users"
  | "leads"
  | "customers"
  | "deals"
  | "activities"
  | "timeline"
  | "analytics";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "update_status"
  | "assign"
  | "convert"
  | "complete"
  | "delete"
  | "deactivate"
  | "team_performance"
  | "logout";

const allPermissions = [
  "auth:read", "auth:logout",
  "users:read", "users:create", "users:update", "users:deactivate",
  "leads:read", "leads:create", "leads:update", "leads:update_status", "leads:assign", "leads:convert", "leads:delete",
  "customers:read", "customers:create", "customers:update", "customers:delete",
  "deals:read", "deals:create", "deals:update", "deals:update_status", "deals:delete",
  "activities:read", "activities:create", "activities:update", "activities:complete", "activities:delete",
  "timeline:read",
  "analytics:read", "analytics:team_performance",
] as const satisfies readonly `${PermissionResource}:${PermissionAction}`[];

export type Permission = (typeof allPermissions)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: allPermissions,
  sales_manager: [
    "auth:read", "auth:logout",
    // "users:read", "users:create", "users:update", "users:deactivate",
    "leads:read", "leads:create", "leads:update", "leads:update_status", "leads:assign", "leads:convert", "leads:delete",
    "customers:read", "customers:create", "customers:update", "customers:delete",
    "deals:read", "deals:create", "deals:update", "deals:update_status", "deals:delete",
    "activities:read", "activities:create", "activities:update", "activities:complete", "activities:delete",
    "timeline:read",
    "analytics:read", "analytics:team_performance",
  ],
  sales_executive: [
    "auth:read", "auth:logout",
    // "users:read",
    "leads:create", "leads:update", "leads:update_status",
    "customers:read", "customers:create", "customers:update", "customers:delete",
    "deals:read", "deals:create", "deals:update", "deals:update_status",
    "activities:read", "activities:create", "activities:update", "activities:complete", "activities:delete",
    "timeline:read",
    "analytics:read",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
