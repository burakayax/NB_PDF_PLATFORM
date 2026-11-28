/**
 * Misafir araç tanıtım sayfasının "ücretsiz mi, hangi planda?" bilgisi.
 *
 * Araç listesi burada SABİT TUTULMAZ: cevap sunucunun plan listesinden türer
 * (`/api/subscription/plans`, panelden yapılan erişim değişiklikleri dâhil).
 */
import type { PlanDefinition } from "../api/subscription";
import { localizedPlanDisplayName } from "../i18n/plans";
import type { Language } from "../i18n/landing";

const PLAN_ORDER = ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"] as const;
type PlanKey = (typeof PLAN_ORDER)[number];

/** Aracı açan en düşük plan. Liste yoksa ya da araç hiçbir planda geçmiyorsa null (bilinmiyor). */
export function lowestPlanFor(plans: PlanDefinition[] | null, featureId: string): PlanKey | null {
  if (!plans) return null;
  for (const key of PLAN_ORDER) {
    const plan = plans.find((p) => String(p.name) === key);
    if (plan?.allowedFeatures?.some((f) => f === featureId)) return key;
  }
  return null;
}

export type ToolLandingCopy = { badge: string; cta: string; note: string; bottom: string };

/**
 * `plan === null` (henüz yüklenmedi / alınamadı) iken her araç için DOĞRU olan tarafsız metin
 * döner: ücretli bir araca bir an bile "ücretsiz" denmez.
 */
export function toolLandingCopy(plan: PlanKey | null, language: Language): ToolLandingCopy {
  const tr = language === "tr";
  if (plan === "FREE") {
    return {
      badge: tr ? "Ücretsiz PDF aracı" : "Free PDF tool",
      cta: tr ? "Ücretsiz Kullan →" : "Use it free →",
      note: tr ? "Kurulum yok · kart gerekmez" : "No install · no card required",
      bottom: tr ? "Ücretsiz hesabınla saniyeler içinde başla." : "Get started in seconds with your free account.",
    };
  }
  const neutral: ToolLandingCopy = {
    badge: tr ? "PDF aracı" : "PDF tool",
    cta: tr ? "Üye ol ve devam et →" : "Sign up to continue →",
    note: tr ? "Kurulum yok" : "No install",
    bottom: tr ? "Hesap açmak ücretsiz." : "Creating an account is free.",
  };
  if (plan === null) return neutral;
  const name = localizedPlanDisplayName(plan, language);
  const top = plan === "BUSINESS";
  const scope = tr
    ? top ? `${name} planında` : `${name} ve üstü planlarda`
    : top ? `Available on ${name}` : `Available on ${name} and above`;
  const opensOn = tr
    ? top ? `${name} planında` : `${name} ve üstünde`
    : top ? `on ${name}` : `on ${name} and above`;
  return {
    ...neutral,
    note: scope,
    bottom: tr
      ? `Hesap açmak ücretsiz; bu araç ${opensOn} açılır.`
      : `Creating an account is free; this tool is available ${opensOn}.`,
  };
}
