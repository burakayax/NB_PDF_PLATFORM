/**
 * PDF SIKIŞTIRMA — HEDEF BOYUT
 *
 * Kurumlar yükleme sınırını sayıyla yazar ("en fazla 1 MB"). Kullanıcı sınırı seçer,
 * sunucu o sınırın altına inen en yüksek kaliteyi arar. Burada arayüzün kullandığı
 * ön ayarlar ve sonucun DÜRÜST yorumu bulunur; sunucu mantığı `pdf_engine.py`'de.
 *
 * DÜRÜSTLÜK: Hedefe inilemezse bunu söyleriz (en küçük hâl verilir). Sayfalar
 * görüntüye çevrildiyse (yazı seçilemez) bunu da söyleriz. Sunucu bu durumu çıktı
 * adındaki "-görüntü" işaretiyle bildirir.
 */

/** Seçilebilir hedefler (KB). 0 = hedef yok, kalite menüsü kullanılır. */
export const COMPRESS_TARGET_PRESETS_KB = [0, 100, 200, 500, 1024, 2048, 5120, 10240] as const;

/** Sunucu sınırlarıyla aynı (20 KB … 200 MB). */
export const COMPRESS_TARGET_MIN_KB = 20;
export const COMPRESS_TARGET_MAX_KB = 200 * 1024;

/** Sunucunun, sayfaları görüntüye çevirdiğinde çıktı adına eklediği işaret. */
export const RASTERIZED_NAME_MARK = "-görüntü";

export function isRasterizedFilename(filename: string): boolean {
  const n = filename.toLocaleLowerCase("tr");
  // Bazı indirme yollarında Türkçe karakterler ASCII'ye düşürülebiliyor.
  return n.includes(RASTERIZED_NAME_MARK) || n.includes("-goruntu");
}

export function formatTargetKb(kb: number): string {
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${kb} KB`;
}

export type CompressTargetOutcome =
  | { kind: "reached"; rasterized: boolean }
  | { kind: "missed"; rasterized: boolean }
  /** Dosya zaten hedefin altındaydı; sunucu dokunmadı. */
  | { kind: "already" };

/**
 * Sonucu yorumlar. `resultBytes` ve `sourceBytes` gerçek dosya boyutlarıdır; sonuç
 * sunucunun iddiasına değil ölçülen boyuta bakar.
 */
export function compressTargetOutcome(args: {
  sourceBytes: number;
  resultBytes: number;
  targetKb: number;
  filename: string;
}): CompressTargetOutcome {
  const target = args.targetKb * 1024;
  const rasterized = isRasterizedFilename(args.filename);
  if (args.sourceBytes > 0 && args.sourceBytes <= target && args.resultBytes >= args.sourceBytes) {
    return { kind: "already" };
  }
  return args.resultBytes <= target ? { kind: "reached", rasterized } : { kind: "missed", rasterized };
}
