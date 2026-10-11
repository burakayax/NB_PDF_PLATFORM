/**
 * Araç videosu "fabrikası" uçları (GitHub iş akışı için) + videonun herkese açık adresi.
 *
 *   GET  /api/tool-reel-factory/needed          → şu an video üretilmeli mi, hangi araç için?
 *   PUT  /api/tool-reel-factory/:toolId/video   → üretilen MP4'ü yükle
 *   GET  /api/public/tool-reels/:id.mp4         → Instagram/Facebook videoyu buradan indirir
 *
 * Fabrika uçları oturum değil `TOOL_REEL_FACTORY_KEY` ile yetkilenir (iş akışı bir kullanıcı
 * değildir). Anahtar tanımlı DEĞİLSE uçlar kapalıdır (fail-closed).
 */

import { timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/file-log.js";
import { readSocialConfig } from "./social.service.js";
import {
  findCatalogEntry,
  pickDueToolReel,
  readToolVideo,
  saveToolVideo,
  unusedFreshVideoFor,
} from "./tool-reels.service.js";

/** Yüklenebilecek en büyük video (üretilen videolar ~5 MB). */
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

function requireFactoryKey(request: Request, _response: Response, next: NextFunction) {
  const expected = (process.env.TOOL_REEL_FACTORY_KEY ?? "").trim();
  if (!expected) throw new HttpError(503, "Araç videosu üretimi yapılandırılmamış (TOOL_REEL_FACTORY_KEY yok).");
  const raw = request.headers["x-factory-key"];
  const provided = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Geçersiz anahtar.");
  next();
}

export const toolReelFactoryRouter = Router();
toolReelFactoryRouter.use(requireFactoryKey);

/**
 * Üretim gerekli mi?
 * `?tool=<id>` verilirse (elle çalıştırma) sıklık/sıra kuralı atlanır ve o araç için "gerekli" döner.
 */
toolReelFactoryRouter.get(
  "/needed",
  asyncHandler(async (request, response) => {
    const forced = typeof request.query.tool === "string" ? request.query.tool : "";
    if (forced) {
      if (!findCatalogEntry(forced)) throw new HttpError(404, "Bilinmeyen araç.");
      response.json({ needed: true, tool: forced, reason: "elle istendi" });
      return;
    }
    const config = await readSocialConfig();
    if (config.toolReelEveryDays <= 0) {
      response.json({ needed: false, reason: "araç videosu ayarı kapalı" });
      return;
    }
    const due = await pickDueToolReel(new Date(), config.toolReelEveryDays);
    if (!due) {
      response.json({ needed: false, reason: "bugün araç videosu günü değil" });
      return;
    }
    if (await unusedFreshVideoFor(due.id)) {
      response.json({ needed: false, tool: due.id, reason: "video zaten hazır" });
      return;
    }
    response.json({ needed: true, tool: due.id, reason: "sıradaki araç" });
  }),
);

toolReelFactoryRouter.put(
  "/:toolId/video",
  express.raw({ type: () => true, limit: MAX_VIDEO_BYTES }),
  asyncHandler(async (request, response) => {
    const toolId = String(request.params.toolId);
    if (!findCatalogEntry(toolId)) throw new HttpError(404, "Bilinmeyen araç.");
    const body = request.body as unknown;
    if (!Buffer.isBuffer(body) || body.length < 1024) throw new HttpError(400, "Video boş ya da çok küçük.");
    // MP4 imzası: 4. baytta "ftyp". Rastgele bir dosya adres olarak sunulmasın.
    if (body.subarray(4, 8).toString("latin1") !== "ftyp") throw new HttpError(400, "Dosya MP4 değil.");
    const seconds = Math.max(0, Math.round(Number(request.headers["x-video-seconds"]) || 0));
    const video = await saveToolVideo(toolId, body, seconds);
    logger.info("social", `Araç videosu yüklendi: ${video.id} (${Math.round(body.length / 1024)} KB)`);
    response.json({ id: video.id, url: video.url, seconds: video.seconds });
  }),
);

/** Videonun herkese açık adresi — Range destekli (Instagram/Facebook parça parça isteyebilir). */
export const toolReelMediaRouter = Router();

toolReelMediaRouter.get(
  "/:file",
  asyncHandler(async (request, response) => {
    const match = /^([a-z0-9-]+-\d{10,})\.mp4$/.exec(String(request.params.file));
    if (!match) throw new HttpError(404, "Bulunamadı.");
    const data = await readToolVideo(match[1] as string);
    if (!data) throw new HttpError(404, "Video bulunamadı ya da paylaşıldıktan sonra silindi.");

    response.setHeader("Content-Type", "video/mp4");
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", "public, max-age=3600");
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ""));
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start >= data.length || start > end) {
        response.status(416).setHeader("Content-Range", `bytes */${data.length}`).end();
        return;
      }
      response.status(206);
      response.setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`);
      response.setHeader("Content-Length", String(end - start + 1));
      response.end(data.subarray(start, end + 1));
      return;
    }
    response.setHeader("Content-Length", String(data.length));
    response.end(data);
  }),
);
