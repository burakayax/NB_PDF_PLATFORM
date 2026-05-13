import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";
import {
  inviteTeamMember,
  acceptTeamInvite,
  revokeTeamMember,
  getTeamDashboard,
  logMemberActivity,
} from "./team.service.js";
import { generateCSVReport, generateExcelReport } from "./report.generator.js";

const teamRouter = Router();

teamRouter.use(requireAuth);

teamRouter.get("/dashboard", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
    }
    const data = await getTeamDashboard(team.id, userId);
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası.";
    res.status(403).json({ message: msg });
  }
});

teamRouter.post("/invite", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    const team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
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

teamRouter.delete("/members/:memberId", async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { memberId } = req.params;
    const team = await prisma.team.findUnique({ where: { ownerId: userId } });
    if (!team) {
      res.status(404).json({ message: "Ekip bulunamadı." });
      return;
    }
    await revokeTeamMember(team.id, memberId, userId);
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

export default teamRouter;
