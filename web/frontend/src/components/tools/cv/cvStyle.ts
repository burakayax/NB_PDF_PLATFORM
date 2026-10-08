import type { CvSettings } from "./cvModel";
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
