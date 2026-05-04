import type { OrgRole } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

export type Permission =
  | "manage_billing"
  | "manage_members"
  | "view_all_usage"
  | "use_tools"
  | "view_dashboard"
  | "manage_plan"
  | "export_reports"
  | "view_own_usage"
  | "invite_members"
  | "remove_members";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: [
    "manage_billing",
    "manage_members",
    "view_all_usage",
    "use_tools",
    "view_dashboard",
    "manage_plan",
    "export_reports",
    "invite_members",
    "remove_members",
    "view_own_usage",
  ],
  ADMIN: [
    "manage_members",
    "view_all_usage",
    "use_tools",
    "view_dashboard",
    "export_reports",
    "invite_members",
    "view_own_usage",
  ],
  MEMBER: ["use_tools", "view_own_usage"],
};

export function can(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).authUser;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Platform ADMIN bypasses all org permissions
    if (user.role === "ADMIN") {
      next();
      return;
    }

    const orgRole: OrgRole = user.orgRole ?? "MEMBER";
    if (!can(orgRole, permission)) {
      res.status(403).json({
        error: "Forbidden",
        required: permission,
        yourRole: orgRole,
      });
      return;
    }

    next();
  };
}
