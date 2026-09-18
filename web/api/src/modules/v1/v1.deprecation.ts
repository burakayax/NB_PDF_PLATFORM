/**
 * Uç emekliliği duyurusu — RFC 9745.
 *
 * NEDEN VAR: Dokümantasyonda "bir uç kaldırılmadan önce en az 6 ay
 * `Deprecation` ve `Sunset` başlıklarıyla haber verilir" diye söz veriyoruz.
 * Bu sözü tutmanın yolu, emeklilik zamanı gelince başlıkları elle eklemeye
 * çalışmak değil, hazır ve doğru bir araç bulundurmaktır — biçim hatası
 * yapmak, hiç duyurmamak kadar işe yaramaz.
 *
 * BİÇİM (RFC 9745 / RFC 9651):
 *   Deprecation → yapılandırılmış TARİH: "@" + Unix saniye damgası.
 *   Sunset      → HTTP-tarih (RFC 9110). Deprecation'dan ÖNCE OLAMAZ.
 *   Link        → rel="deprecation", açıklama sayfasına.
 *
 * KULLANIM: emekliye ayrılan rotaya, işleyicisinden önce eklenir:
 *
 *   v1Router.post(
 *     "/eski-uc",
 *     deprecate({ since: "2026-09-18", sunset: "2027-03-20" }),
 *     asyncHandler(eskiUcController),
 *   );
 *
 * Şu an emekliye ayrılmış bir uç YOK; bu yüzden hiçbir rotaya bağlı değil.
 */

import type { NextFunction, Request, Response } from "express";

const DOCS_URL = "https://www.pdfplatform.app/pdf-api/docs#changelog";

export type DeprecationOptions = {
  /** Emekliliğin duyurulduğu tarih (YYYY-AA-GG ya da tam ISO). */
  since: string;
  /** Ucun yanıt vermeyi bırakacağı tarih. `since`'ten önce olamaz. */
  sunset: string;
  /** Açıklama sayfası; varsayılan değişiklik günlüğü. */
  docs?: string;
};

function parseDate(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`v1.deprecation: ${field} geçersiz tarih: ${value}`);
  return d;
}

/**
 * Verilen rotaya emeklilik başlıklarını ekler.
 *
 * Tarih sırası BURADA doğrulanır: yanlış sıralı bir duyuru, istemci
 * kütüphanelerinde sessizce yok sayılır ve geliştirici uyarıyı hiç görmez.
 */
export function deprecate(options: DeprecationOptions) {
  const since = parseDate(options.since, "since");
  const sunset = parseDate(options.sunset, "sunset");
  if (sunset.getTime() < since.getTime()) {
    throw new Error("v1.deprecation: sunset, since'ten önce olamaz (RFC 9745).");
  }
  const docs = options.docs ?? DOCS_URL;

  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Deprecation", `@${Math.floor(since.getTime() / 1000)}`);
    res.setHeader("Sunset", sunset.toUTCString());
    res.setHeader("Link", `<${docs}>; rel="deprecation"; type="text/html"`);
    next();
  };
}
