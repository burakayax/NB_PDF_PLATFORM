import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../lib/rbac.js";
import { csrfOriginCheck } from "../../middleware/csrf.middleware.js";
import {
  inviteMember,
  acceptInvitation,
  removeMember,
  getOrganization,
} from "./organization.service.js";

const router = Router();

// GET /api/org — get current organization details
router.get("/", requireAuth(), async (req, res) => {
  try {
    const user = (req as any).authUser;
    if (!user.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const org = await getOrganization(user.organizationId);
    res.json({ org });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/org/invite — invite a member (OWNER/ADMIN only, BUSINESS plan)
router.post(
  "/invite",
  csrfOriginCheck,
  requireAuth(),
  requirePermission("invite_members"),
  async (req, res) => {
    try {
      const user = (req as any).authUser;
      const { email, role = "MEMBER" } = req.body;

      if (!email) {
        res.status(400).json({ error: "email required" });
        return;
      }

      const frontendOrigin =
        process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

      const invitation = await inviteMember(
        user.organizationId,
        user.name ?? user.email,
        email,
        role,
        frontendOrigin,
      );

      res.json({ invitation });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

// GET /api/org/invite/accept/:token — accept invitation (authenticated user)
router.get("/invite/accept/:token", requireAuth(), async (req, res) => {
  try {
    const user = (req as any).authUser;
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const org = await acceptInvitation(token as string, user.id);
    res.json({ org, message: "Davete başarıyla katıldınız." });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/org/members/:userId — remove a member
router.delete(
  "/members/:userId",
  csrfOriginCheck,
  requireAuth(),
  requirePermission("remove_members"),
  async (req, res) => {
    try {
      const user = (req as any).authUser;
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

      await removeMember(user.organizationId, userId as string, user.orgRole);
      res.json({ message: "Üye kaldırıldı." });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

export default router;
