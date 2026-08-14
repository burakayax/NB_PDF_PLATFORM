import type { Request, Response } from "express";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Belge Tarayıcı "Hesabıma kaydet" — kullanıcının son taramaları.
 * Dosya bytea olarak Postgres'te saklanır (Render diski geçici; S3 bağımlılığı yok).
 * FIFO saklama: FREE düşük limit, Pro yüksek. Tüm rotalar requireAuth altında.
 */

const FREE_LIMIT = Number(process.env.SCAN_LIBRARY_FREE_LIMIT ?? 3);
const PRO_LIMIT = Number(process.env.SCAN_LIBRARY_PRO_LIMIT ?? 10);
const MAX_BYTES = 12 * 1024 * 1024; // 12MB — tarama dosyaları küçük olur

/** ADMIN sınırsızdır: 0 = "limit yok" (istemci sayaç göstermez, FIFO silme yapılmaz). */
const UNLIMITED = 0;

async function tierLimit(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, role: true },
  });
  if (!user) return FREE_LIMIT;
  if (user.role === "ADMIN") return UNLIMITED;
  if (user.plan !== "FREE") return PRO_LIMIT;
  return FREE_LIMIT;
}

export async function listScansController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const [scans, limit] = await Promise.all([
    prisma.scannedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, mime: true, sizeBytes: true, createdAt: true },
    }),
    tierLimit(userId),
  ]);
  response.json({ scans, limit });
}

export async function uploadScanController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const file = (request as Request & { file?: Express.Multer.File }).file;
  if (!file?.buffer) throw new HttpError(400, "Dosya gerekli.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Dosya çok büyük (en fazla 12MB).");

  const rawName =
    (typeof request.body?.filename === "string" && request.body.filename.trim()) ||
    file.originalname ||
    "tarama.pdf";
  const filename = rawName.slice(0, 200);
  const mime = file.mimetype || "application/octet-stream";
  const limit = await tierLimit(userId);

  const scan = await prisma.scannedDocument.create({
    data: { userId, filename, mime, sizeBytes: file.size, data: file.buffer },
    select: { id: true, filename: true, mime: true, sizeBytes: true, createdAt: true },
  });

  // FIFO: limitin ötesindeki (en eski) taramaları sil. limit === UNLIMITED (0) ise
  // (ADMIN) hiçbir şey silinmez.
  if (limit > 0) {
    const overflow = await prisma.scannedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
      skip: limit,
    });
    if (overflow.length) {
      await prisma.scannedDocument.deleteMany({
        where: { id: { in: overflow.map((r) => r.id) } },
      });
    }
  }

  response.status(201).json({ scan, limit });
}

export async function downloadScanController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const row = await prisma.scannedDocument.findFirst({
    where: { id: String(request.params.id), userId },
  });
  if (!row) throw new HttpError(404, "Tarama bulunamadı.");
  response.setHeader("Content-Type", row.mime);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
  );
  response.setHeader("Content-Length", String(row.sizeBytes));
  response.send(Buffer.from(row.data));
}

export async function deleteScanController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication is required.");
  const del = await prisma.scannedDocument.deleteMany({
    where: { id: String(request.params.id), userId },
  });
  if (del.count === 0) throw new HttpError(404, "Tarama bulunamadı.");
  response.json({ ok: true });
}
