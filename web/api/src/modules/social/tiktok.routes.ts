/**
 * TikTok bağlantısı — geri dönüş adresi (`GET /api/auth/tiktok/callback`).
 *
 * NEDEN AYRI, GİRİŞSİZ ROUTER: TikTok kullanıcıyı tarayıcıda bu adrese yönlendirir; bu istek
 * yönetici oturum anahtarını (Authorization başlığı) taşımaz. Kimlik doğrulaması yerine
 * imzalı, 10 dakikalık `state` kullanılır (bkz. `createTiktokState`): yalnızca yönetici
 * panelinden "TikTok ile bağlan"a basıldığında üretilir, dışarıdan taklit edilemez.
 * Anahtarlar yanıtta ASLA gösterilmez; sayfa yalnızca sonucu söyler.
 *
 * Adres `/api/auth/*` altında: Google girişinin geri dönüşüyle aynı önek, dolayısıyla canlıda
 * ve yerelde aynı yönlendirme kuralıyla API'ye ulaşır.
 */

import { Router } from "express";
import type { Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { logger } from "../../lib/file-log.js";
import {
  exchangeTiktokCode,
  fetchTiktokDisplayName,
  verifyTiktokState,
} from "./platforms/tiktok.platform.js";
import { readAccountSecrets, saveAccount } from "./social.service.js";

export const tiktokCallbackRouter = Router();

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function page(response: Response, status: number, title: string, message: string): void {
  response
    .status(status)
    .set({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" })
    .send(
      `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}` +
        `main{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:440px;text-align:center}h1{font-size:20px;margin:0 0 12px}p{margin:0;color:#475569;line-height:1.5}</style></head>` +
        `<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`,
    );
}

tiktokCallbackRouter.get(
  "/callback",
  asyncHandler(async (request, response) => {
    const { code, state, error, error_description: errorDescription } = request.query;

    if (!verifyTiktokState(state)) {
      page(response, 400, "Bağlantı doğrulanamadı", "Bu adres yalnızca yönetim panelindeki “TikTok ile bağlan” düğmesiyle açılır. Paneli açıp tekrar deneyin.");
      return;
    }
    if (typeof error === "string" && error) {
      // Kullanıcı izni reddetti ya da TikTok bir sorun bildirdi.
      const detail = typeof errorDescription === "string" ? errorDescription : error;
      logger.warn("social", `TikTok bağlantısı reddedildi: ${error}`);
      page(response, 400, "TikTok bağlantısı kurulamadı", `TikTok şunu bildirdi: ${detail}`);
      return;
    }
    if (typeof code !== "string" || !code) {
      page(response, 400, "TikTok bağlantısı kurulamadı", "TikTok yetkilendirme kodu göndermedi.");
      return;
    }

    const secrets = await readAccountSecrets("TIKTOK");
    const clientKey = secrets?.clientKey?.trim();
    const clientSecret = secrets?.clientSecret?.trim();
    if (!clientKey || !clientSecret) {
      page(response, 400, "TikTok bağlantısı kurulamadı", "Panelde TikTok için Client Key ve Client Secret kayıtlı değil. Önce onları kaydedin.");
      return;
    }

    try {
      const tokens = await exchangeTiktokCode(clientKey, clientSecret, code);
      const name = await fetchTiktokDisplayName(tokens.accessToken).catch(() => "");
      await saveAccount({
        platform: "TIKTOK",
        displayName: name || undefined,
        secrets: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        tokenExpiresAt: tokens.refreshExpiresAt ? new Date(tokens.refreshExpiresAt) : undefined,
      });
      logger.info("social", `TikTok hesabı bağlandı${name ? `: ${name}` : ""}`);
      page(
        response,
        200,
        "TikTok bağlandı",
        `${name ? `${name} hesabı` : "Hesap"} bağlandı. Bu sekmeyi kapatıp yönetim paneline dönebilirsiniz.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("social", `TikTok bağlantısı kurulamadı: ${message}`);
      page(response, 502, "TikTok bağlantısı kurulamadı", message.slice(0, 300));
    }
  }),
);
