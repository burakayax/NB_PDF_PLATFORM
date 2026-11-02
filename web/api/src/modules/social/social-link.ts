/**
 * Sosyal ağlara giden bağlantıların TEK üretim yeri (UTM etiketi dahil).
 *
 * Her ağ kendi `utm_source` değerini taşır; adreste başka bir ağın etiketi kalmış olsa bile
 * (ör. LinkedIn'den kopyalanan adres) düzeltilir. Kampanya adı: araç videosu ya da blog.
 * Pinterest "arac" / "blog" kullanır; eski ağların kampanya adları (arac-videosu) analitik
 * sürekliliği için değiştirilmedi.
 */

import { socialUtm, withUtm } from "../../lib/utm.js";
import { toolIdFromGuid } from "./platforms/reel-cover.js";

export type LinkKind = "blog" | "arac";

/** Gönderi kimliğinden içerik türü: araç videosu ya da blog. */
export function linkKindOf(guid: string): LinkKind {
  return toolIdFromGuid(guid) ? "arac" : "blog";
}

export function socialLink(platform: string, url: string, kind: LinkKind): string {
  // Pinterest dışındaki ağlar eski kampanya adını korur.
  const campaign = platform === "PINTEREST" ? kind : kind === "arac" ? "arac-videosu" : "blog";
  return withUtm(url, socialUtm(platform, campaign), { strict: true });
}
