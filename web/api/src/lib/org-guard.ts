import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma.js";

export interface OrgRequest extends Request {
  authUser?: any;
  organization?: any;
}

export function requireOrg() {
  return async (req: OrgRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!user.organizationId) {
      res.status(403).json({ error: "No organization found. Please complete registration." });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });

    if (!org) {
      res.status(403).json({ error: "Organization not found." });
      return;
    }

    req.organization = org;
    next();
  };
}

export function scopeToOrg() {
  return (req: OrgRequest, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user?.organizationId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
