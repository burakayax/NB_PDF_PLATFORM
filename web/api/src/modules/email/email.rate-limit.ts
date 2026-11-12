import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Abonelikten çıkış uçları SINIR koruması (giriş gerektirmez, token ile çalışır).
 *
 * İki katman:
 *  1) Aynı bağlantı (token) saatte en fazla 12 istek — aynı linke art arda
 *     tıklayan bot ya da yanlış yapılandırılmış tarayıcı durdurulur.
 *  2) Aynı IP 10 dakikada en fazla 40 istek — rastgele token deneyen ya da
 *     formları dolduran saldırgan için. Gmail/Yahoo'nun RFC 8058 tek-tık POST'u
 *     bu IP sınırından MUAF: aynı Google adreslerinden çok kişinin çıkışı gelir,
 *     sınır meşru kullanıcıları engellerdi. O uç zaten yalnız imza doğrular.
 */
function tokenOf(req: Request): string {
  return String(req.query.token ?? (req.body as { token?: string } | undefined)?.token ?? "");
}

function tooMany(req: Request, res: Response): void {
  if (req.method === "POST" && req.path === "/unsubscribe") {
    res.status(429).json({ ok: false });
    return;
  }
  res
    .status(429)
    .type("html")
    .send(
      `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Çok fazla deneme</title></head>
<body style="margin:0;background:#eef2f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:520px;margin:60px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 30px;">
<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Çok fazla deneme</h1>
<p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Kısa sürede çok fazla istek geldi. Çıkış işleminiz bu yüzden etkilenmez; lütfen bir süre sonra tekrar deneyin.</p>
</div></body></html>`,
    );
}

export const unsubscribeTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const t = tokenOf(req as Request);
    return t ? `t:${t.slice(0, 200)}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  handler: (req, res) => tooMany(req as Request, res as Response),
});

export const unsubscribeIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  // Gmail/Yahoo tek-tık POST'u (RFC 8058) IP sınırından muaf.
  skip: (req) => req.method === "POST" && req.path === "/unsubscribe",
  handler: (req, res) => tooMany(req as Request, res as Response),
});
