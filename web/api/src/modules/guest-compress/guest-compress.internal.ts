import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { requestHasInternalServiceSecret } from "../../middleware/api-security.middleware.js";
import { isGuestCompressClosed, readGuestCompressConfig } from "./guest-compress.config.js";
import {
  GLOBAL_ID,
  consumeGuestCompress,
  nextMidnightIstanbulIso,
  peekGuestCompress,
  personIdKey,
  refundGuestCompress,
} from "./guest-compress.usage.js";

/**
 * DAHİLİ UÇLAR — yalnızca PDF servisi (FastAPI) çağırır; `X-Internal-Secret` ile yetkilenir.
 *
 *  GET  /api/entitlement/internal/guest-compress/config  → panelden ayarlanan değerler
 *  POST /api/entitlement/internal/guest-compress/usage   → hak sayacı (consume / refund / peek)
 *
 * Limit İSTEMCİDEN (Python'dan) ALINMAZ: her zaman buradaki ayardan türetilir. Böylece sayaç ve
 * ayar tek kaynakta kalır; PDF servisi yalnızca "kim" (IP özeti) ve "ne yap" der.
 */

let lastContactAt: number | null = null;

/** PDF servisi köprüyü en son ne zaman kullandı? (panelde "köprü çalışıyor mu" göstergesi) */
export function getBridgeLastContact(): Date | null {
  return lastContactAt ? new Date(lastContactAt) : null;
}

function assertInternal(request: Request): void {
  if (!(process.env.INTERNAL_SERVICE_SECRET ?? "").trim()) {
    throw new HttpError(503, "Internal service secret not configured.");
  }
  if (!requestHasInternalServiceSecret(request)) {
    throw new HttpError(403, "Forbidden.");
  }
  lastContactAt = Date.now();
}

export async function guestCompressConfigController(request: Request, response: Response) {
  assertInternal(request);
  const cfg = await readGuestCompressConfig();
  response.status(200).json({ ...cfg, closed: isGuestCompressClosed(cfg) });
}

const usageSchema = z.object({
  action: z.enum(["consume", "refund", "peek"]),
  scope: z.enum(["person", "global"]),
  /** scope=person iken "g:<32 hex>" (IP özeti; düz IP ASLA gönderilmez). */
  key: z.string().max(80).optional(),
});

export async function guestCompressUsageController(request: Request, response: Response) {
  assertInternal(request);
  const body = usageSchema.parse(request.body);
  const cfg = await readGuestCompressConfig();

  let idKey: string;
  if (body.scope === "global") {
    idKey = GLOBAL_ID;
  } else {
    const k = personIdKey(body.key ?? "");
    if (!k) throw new HttpError(400, "Invalid key.");
    idKey = k;
  }
  // Ana anahtar kapalıysa limit 0 → hiçbir hak verilmez ("0 = sınırsız" anlamı YOK).
  const limit = cfg.enabled ? (body.scope === "global" ? cfg.globalDailyLimit : cfg.dailyLimit) : 0;

  if (body.action === "consume") {
    response.status(200).json(await consumeGuestCompress(idKey, limit));
    return;
  }
  if (body.action === "refund") {
    await refundGuestCompress(idKey);
    response.status(200).json({ ok: true });
    return;
  }
  response.status(200).json({
    used: await peekGuestCompress(idKey),
    limit,
    resetAt: nextMidnightIstanbulIso(),
  });
}
