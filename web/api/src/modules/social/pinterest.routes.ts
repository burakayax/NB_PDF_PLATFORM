/**
 * Pinterest bağlantısı — geri dönüş adresi (`GET /api/auth/pinterest/callback`).
 *
 * Girişsiz çünkü Pinterest tarayıcıyı yönetici anahtarı olmadan buraya yönlendirir; koruma imzalı,
 * 10 dakikalık `state` ile yapılır. Anahtarlar yanıtta ASLA gösterilmez (bkz. tiktok.routes.ts).
 */

import { Router } from "express";
import type { Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { logger } from "../../lib/file-log.js";
import {
  exchangePinterestCode,
  fetchPinterestUsername,
  persistPinterestTokens,
  verifyPinterestState,
} from "./platforms/pinterest.platform.js";
import { resolveOAuthSpaRedirectBase } from "../../lib/oauth-frontend-origin.js";
import { readAccountSecrets, readSocialConfig, saveAccount } from "./social.service.js";

export const pinterestCallbackRouter = Router();

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Yönetim paneli adresi (Google girişinin dönüş kökü ile aynı güvenilir kök). */
function adminUrl(): string {
  return `${resolveOAuthSpaRedirectBase(null)}/admin`;
}

function page(response: Response, status: number, title: string, message: string): void {
  const back = adminUrl();
  response
    .status(status)
    .set({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" })
    .send(
      `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
        `<meta http-equiv="refresh" content="${status === 200 ? 4 : 12};url=${escapeHtml(back)}"><style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}` +
        `main{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:440px;text-align:center}h1{font-size:20px;margin:0 0 12px}p{margin:0;color:#475569;line-height:1.5}</style></head>` +
        `<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p style="margin-top:16px"><a href="${escapeHtml(back)}">Yönetim paneline dön</a></p></main></body></html>`,
    );
}

pinterestCallbackRouter.get(
  "/callback",
  asyncHandler(async (request, response) => {
    const { code, state, error, error_description: errorDescription } = request.query;

    // Teşhis kaydı: gizli değer YOK. Render günlüğünde "Pinterest geri dönüş" ara.
    logger.info(
      "social",
      `Pinterest geri dönüş alındı: code=${typeof code === "string" && code ? "var" : "yok"}, state=${verifyPinterestState(state) ? "geçerli" : "geçersiz/eksik"}, error=${typeof error === "string" ? error : "yok"}`,
    );

    if (!verifyPinterestState(state)) {
      page(response, 400, "Bağlantı doğrulanamadı", "Bu adres yalnızca yönetim panelindeki “Pinterest ile bağlan” düğmesiyle açılır. Paneli açıp tekrar deneyin.");
      return;
    }
    if (typeof error === "string" && error) {
      const detail = typeof errorDescription === "string" ? errorDescription : error;
      logger.warn("social", `Pinterest bağlantısı reddedildi: ${error}`);
      page(response, 400, "Pinterest bağlantısı kurulamadı", `Pinterest şunu bildirdi: ${detail}`);
      return;
    }
    if (typeof code !== "string" || !code) {
      page(response, 400, "Pinterest bağlantısı kurulamadı", "Pinterest yetkilendirme kodu göndermedi.");
      return;
    }

    const secrets = await readAccountSecrets("PINTEREST");
    const appId = secrets?.appId?.trim();
    const appSecret = secrets?.appSecret?.trim();
    if (!appId || !appSecret) {
      page(response, 400, "Pinterest bağlantısı kurulamadı", "Panelde Pinterest için App ID ve App Secret kayıtlı değil. Önce onları kaydedin.");
      return;
    }

    try {
      const { pinterestSandbox } = await readSocialConfig();
      const tokens = await exchangePinterestCode(pinterestSandbox, appId, appSecret, code);
      await persistPinterestTokens(tokens, pinterestSandbox);
      const fresh = await readAccountSecrets("PINTEREST");
      const name = fresh ? await fetchPinterestUsername(fresh).catch(() => "") : "";
      if (name) await saveAccount({ platform: "PINTEREST", displayName: `@${name}`, secrets: {} });
      logger.info("social", `Pinterest hesabı bağlandı${name ? `: @${name}` : ""} (anahtarlar şifreli kaydedildi)`);
      page(
        response,
        200,
        "Pinterest bağlandı",
        `${name ? `@${name} hesabı` : "Hesap"} bağlandı. Yönetim panelinde bir pano seçmeyi unutmayın.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("social", `Pinterest bağlantısı kurulamadı: ${message}`);
      page(response, 502, "Pinterest bağlantısı kurulamadı", message.slice(0, 300));
    }
  }),
);
