/**
 * BULGU KODU — rapor, boyalı PDF'in kenar işaretleri ve açıklama sayfaları AYNI kodu kullanır.
 *
 * Eskiden bulgular 1, 2, 3… diye numaralanıyordu; ama liste önem sırasına göre dizildiği için
 * belge sayfasında okuma sırasıyla 10, 5, 2 gibi karışık görünüyor ve ne anlama geldikleri
 * anlaşılmıyordu. Artık harf önem düzeyini, sayı o düzeydeki sırayı gösterir:
 *   K1, K2 = kritik · Y1, Y2 = yüksek · O1 = orta · D1 = düşük.
 * Renk de aynı önem düzeyini gösterir.
 */
export type Sev = "kritik" | "yuksek" | "orta" | "dusuk";

/** Önem düzeyi renkleri (boyalı PDF, rapor PDF'i ve ekran aynı renkleri kullanır). */
export const SEVERITY_COLORS: Record<Sev, { r: number; g: number; b: number }> = {
  kritik: { r: 0.93, g: 0.15, b: 0.15 },
  yuksek: { r: 0.97, g: 0.45, b: 0.09 },
  orta: { r: 0.98, g: 0.75, b: 0.14 },
  dusuk: { r: 0.25, g: 0.55, b: 0.95 },
};

const LETTER: Record<Sev, string> = { kritik: "K", yuksek: "Y", orta: "O", dusuk: "D" };

/** Verilen (önem sırasına dizili) bulgular için kodları üretir: ["K1","K2","Y1","O1",…]. */
export function findingCodes(findings: ReadonlyArray<{ severity: Sev }>): string[] {
  const counters: Record<string, number> = {};
  return findings.map((f) => {
    const l = LETTER[f.severity] ?? "?";
    counters[l] = (counters[l] ?? 0) + 1;
    return `${l}${counters[l]}`;
  });
}

/** Kodların açıklaması — raporda, açıklama sayfalarında ve yardım metinlerinde aynen gösterilir. */
export const FINDING_CODE_LEGEND =
  "Bulgu kodu: harf önem düzeyini (K = kritik, Y = yüksek, O = orta, D = düşük), sayı o düzeydeki sırayı gösterir. Renk de aynı önemi gösterir.";
