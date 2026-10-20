/** Facebook içerik türleri: ipucu / sorun→çözüm / etkileşim (A mı B mi). Demo türü araç videolarıdır. */
export type FacebookKind = "tip" | "problem" | "engage";

/** 7'lik döngü: 4 ipucu, 2 sorun→çözüm, 1 etkileşim (araç videoları demo payını ayrıca doldurur). */
const FB_CYCLE: FacebookKind[] = ["tip", "problem", "tip", "engage", "tip", "problem", "tip"];

export function facebookKindFor(count: number): FacebookKind {
  return FB_CYCLE[((count % FB_CYCLE.length) + FB_CYCLE.length) % FB_CYCLE.length] ?? "tip";
}
