import type { CvData, CvSettings } from "./cvModel";
import type { CvStyleOpts } from "./cvTemplates";

/**
 * "Tek sayfaya sığdır" kademeleri: içerik 1 sayfayı aşarsa sırayla yazı ve boşluk küçülür.
 * Kademe 0 = kullanıcının seçtiği boyut. Önizleme ve PDF AYNI tabloyu kullanır → aynı sonuç.
 * Yazıyı çok küçültmemek için alt sınır sabittir (okunaklılık): son kademede yazı %82.
 */
export const FIT_STEPS: { scale: number; spacing: number }[] = [
  { scale: 1, spacing: 1 },
  { scale: 1, spacing: 0.85 },
  { scale: 0.97, spacing: 0.72 },
  { scale: 0.94, spacing: 0.62 },
  { scale: 0.91, spacing: 0.52 },
  { scale: 0.88, spacing: 0.44 },
  { scale: 0.85, spacing: 0.38 },
  { scale: 0.82, spacing: 0.32 },
];

export function styleFromSettings(st: CvSettings, fitStep = 0): CvStyleOpts {
  return {
    font: st.font,
    density: st.density,
    headingStyle: st.headingStyle,
    photoShape: st.photoShape,
    fit: st.fitOnePage ? FIT_STEPS[Math.min(fitStep, FIT_STEPS.length - 1)] : undefined,
  };
}

export const MAX_FIT_STEP = FIT_STEPS.length - 1;

/**
 * Yazı küçültmek yetmezse son çare: "Tek sayfaya sığdır" yalnızca PDF'teki gösterimi kısaltır; kullanıcının yazdığı metin silinmez.
 * En yeni `recent` iş tam kalır (keepRecent satıra kadar), daha eski işlerin yalnızca ilk keepOld satırı gösterilir.
 */
export const TRIM_LEVELS: { recent: number; keepRecent: number; keepOld: number }[] = [
  { recent: 2, keepRecent: 99, keepOld: 99 },
  { recent: 2, keepRecent: 6, keepOld: 4 },
  { recent: 2, keepRecent: 5, keepOld: 3 },
  { recent: 2, keepRecent: 4, keepOld: 2 },
  { recent: 1, keepRecent: 3, keepOld: 1 },
];
export const MAX_TRIM = TRIM_LEVELS.length - 1;

/** İş deneyimi satırlarını kademeye göre kısaltılmış bir kopya ve gizlenen satır sayısını verir. */
export function trimForFit(d: CvData, level: number): { data: CvData; hidden: number } {
  const t = TRIM_LEVELS[Math.min(Math.max(level, 0), MAX_TRIM)];
  let hidden = 0;
  const experience = d.experience.map((e, i) => {
    const lines = e.desc.split(/\r?\n/).filter((x) => x.trim());
    const keep = i < t.recent ? t.keepRecent : t.keepOld;
    if (lines.length <= keep) return e;
    hidden += lines.length - keep;
    return { ...e, desc: lines.slice(0, keep).join("\n") };
  });
  return { data: hidden ? { ...d, experience } : d, hidden };
}
