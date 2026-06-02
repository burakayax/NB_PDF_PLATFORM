import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { getClientIp } from "../../middleware/api-security.middleware.js";
import { prisma } from "../../lib/prisma.js";
import {
  createTeamForOwner,
  inviteTeamMember,
  acceptTeamInvite,
  revokeTeamMember,
  getTeamDashboard,
  logMemberActivity,
  setMemberRole,
} from "./team.service.js";
import { generateCSVReport, generateExcelReport } from "./report.generator.js";

const teamRouter = Router();

const invitePreviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: "Too many preview requests. Try again later." },
});

// Public endpoint — no auth required
teamRouter.get("/invite/preview", invitePreviewLimiter, async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ message: "Token gerekli." });
      return;
    }
    const member = await prisma.teamMember.findUnique({
      where: { inviteToken: token },
      include: { team: { include: { owner: { select: { firstName: true, lastName: true, email: true } } } } },
    });
    if (!member) {
      res.status(404).json({ message: "INVITE_NOT_FOUND" });
      return;
    }
    if (member.inviteStatus !== "PENDING") {
      res.status(400).json({ message: "INVITE_ALREADY_USED" });
      return;
    }
    const ownerName =
      [member.team.owner.firstName, member.team.owner.lastName].filter(Boolean).join(" ") ||
      member.team.owner.email;
    res.json({ email: member.inviteEmail, teamName: member.team.name, ownerName });
  } catch {
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

teamRouter.use(requireAuth);

teamRouter.get("/dashboard", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const authUser = req.authUser!;

    // Manager: patronun teamOwnerId'si üzerinden ekibe eriş
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamMemberRole: true, teamOwnerId: true, plan: true, firstName: true, lastName: true, email: true },
    });
    if (dbUser?.teamMemberRole === "MANAGER" && dbUser.teamOwnerId) {
      const ownerTeam = await prisma.team.findUnique({ where: { ownerId: dbUser.teamOwnerId } });
      if (!ownerTeam) {
        res.status(404).json({ message: "Ekip bulunamadı." });
        return;
      }
      const data = await getTeamDashboard(ownerTeam.id, ownerTeam.ownerId);
      res.json(data);
      return;
    }

    let team = await prisma.team.findUnique({ where: { ownerId: userId } });

    if (!team) {
      const user = dbUser;
      if (user?.plan !== "BUSINESS") {
        res.status(403).json({ message: "Ekip özelliği sadece Business planına dahildir." });
        return;
      }
      const ownerName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.email?.split("@")[0] ||
        "Business";
      team = await createTeamForOwner(userId, ownerName);
    }

    const data = await getTeamDashboard(team.id, userId);
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası.";
    res.status(500).json({ message: msg });
  }
});

teamRouter.post("/invite", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, plan: true, teamMemberRole: true, teamOwnerId: true },
    });

    // Manager: patronun ekibine davet gönderebilir
    if (user?.teamMemberRole === "MANAGER" && user.teamOwnerId) {
      const ownerTeam = await prisma.team.findUnique({ where: { ownerId: user.teamOwnerId } });
      if (!ownerTeam) {
        res.status(404).json({ message: "Ekip bulunamadı." });
        return;
      }
      const managerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.email ?? "Yönetici");
      const member = await inviteTeamMember(ownerTeam.id, email, managerName, ownerTeam.name);
      res.status(201).json(member);
      return;
    }

    let team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      if (user?.plan !== "BUSINESS") {
        res.status(403).json({ message: "Ekip özelliği sadece Business planına dahildir." });
        return;
      }
      const ownerName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email?.split("@")[0] ||
        "Business";
      team = await createTeamForOwner(userId, ownerName);
    }
    const patronName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") || (user?.email ?? "Patron");
    const member = await inviteTeamMember(team.id, email, patronName, team.name);
    res.status(201).json(member);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davet gönderilemedi.";
    if (msg === "SEAT_LIMIT_REACHED") {
      res.status(402).json({ message: msg });
      return;
    }
    res.status(400).json({ message: msg });
  }
});

teamRouter.post("/invite/accept", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { token } = req.body as { token: string };
    const member = await acceptTeamInvite(token, userId);
    res.json(member);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Davet kabul edilemedi.";
    res.status(400).json({ message: msg });
  }
});

teamRouter.patch("/members/:memberId/role", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { memberId } = req.params;
    const { role } = req.body as { role: "MEMBER" | "MANAGER" };
    if (role !== "MEMBER" && role !== "MANAGER") {
      res.status(400).json({ message: "Geçersiz rol." });
      return;
    }
    const team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      res.status(403).json({ message: "Bu işlemi yalnızca ekip sahibi yapabilir." });
      return;
    }
    const result = await setMemberRole(team.id, memberId, userId, role);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Rol güncellenemedi.";
    res.status(400).json({ message: msg });
  }
});

teamRouter.delete("/members/:memberId", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { memberId } = req.params;
    const dbU = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamMemberRole: true, teamOwnerId: true },
    });
    let team = await prisma.team.findUnique({ where: { ownerId: userId } });

    // Manager: patronun teamOwnerId üzerinden
    if (!team && dbU?.teamMemberRole === "MANAGER" && dbU.teamOwnerId) {
      team = await prisma.team.findUnique({ where: { ownerId: dbU.teamOwnerId } });
    }
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
    }
    await revokeTeamMember(team.id, memberId, team.ownerId);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Üye kaldırılamadı.";
    res.status(403).json({ message: msg });
  }
});

teamRouter.get("/report", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const format = (req.query["format"] as string) ?? "excel";
    const startDate = req.query["startDate"] ? new Date(req.query["startDate"] as string) : undefined;
    const endDate = req.query["endDate"] ? new Date(req.query["endDate"] as string) : undefined;

    const team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
    }

    const data = await getTeamDashboard(team.id, userId);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    if (format === "csv") {
      const csv = generateCSVReport(data, startDate, endDate);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="team-report-${ts}.csv"`);
      res.send(csv);
      return;
    }

    const buffer = await generateExcelReport(data, startDate, endDate);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="team-report-${ts}.xlsx"`);
    res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Rapor oluşturulamadı.";
    res.status(500).json({ message: msg });
  }
});

teamRouter.post("/activity", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const {
      toolId,
      toolName,
      pageCount,
      fileSizeMB,
      durationMs,
      status,
      compressionResult,
    } = req.body as {
      toolId: string;
      toolName: string;
      pageCount?: number | null;
      fileSizeMB?: number | null;
      durationMs?: number | null;
      status?: "SUCCESS" | "FAILED";
      compressionResult?: {
        originalSizeMB: number;
        compressedSizeMB: number;
        compressionRatio: number;
      };
    };
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;
    await logMemberActivity(
      userId,
      toolId,
      toolName,
      pageCount ?? null,
      fileSizeMB ?? null,
      durationMs ?? null,
      status ?? "SUCCESS",
      ip,
      compressionResult,
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// PATCH /api/team/seats — koltuk sayısını azalt (sonraki dönemde devreye girer)
teamRouter.patch("/seats", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { extraSeats } = req.body as { extraSeats: number };

    if (typeof extraSeats !== "number" || extraSeats < 0 || extraSeats > 95) {
      res.status(400).json({ message: "Geçersiz koltuk sayısı." });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { ownerId: userId },
      include: { members: { where: { inviteStatus: "ACCEPTED" } } },
    });
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
    }

    const newTotal = team.maxSeats + extraSeats;
    if (team.members.length > newTotal) {
      res.status(400).json({
        message: `Aktif ${team.members.length} üye var. Koltuk sayısını en az ${Math.max(0, team.members.length - team.maxSeats)} ekstra olarak ayarlayın.`,
      });
      return;
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { extraSeats },
    });

    res.json({
      ok: true,
      totalSeats: newTotal,
      message: extraSeats < team.extraSeats
        ? `Koltuk sayısı azaltıldı. Çıkardığınız koltukların erişimi bu fatura döneminin sonuna kadar devam edecektir. Gelecek ay faturanız ${5 + extraSeats} kişi üzerinden güncellenecektir.`
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası.";
    res.status(500).json({ message: msg });
  }
});

export default teamRouter;
