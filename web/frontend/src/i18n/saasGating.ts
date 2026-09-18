/**
 * Copy deck for the SaaS UI-gating layer.
 */

import type { Language } from "./landing";
import type {
  SaaSGatingActionKind,
  SaaSGatingReason,
  SaaSGatingState,
} from "../lib/saasGating";

type Dict = { tr: string; en: string };

const pick = (d: Dict, lang: Language) => (lang === "tr" ? d.tr : d.en);

const REASON_COPY: Record<SaaSGatingReason, { title: Dict; body: Dict }> = {
  plan_allows: {
    title: { tr: "İndirmeye hazır", en: "Ready to download" },
    body: { tr: "Dosyanız hazır.", en: "Your file is ready." },
  },
  active_subscription: {
    title: { tr: "Planınız aktif", en: "Plan active" },
    body: { tr: "Bu işlem planınız kapsamında.", en: "This operation is covered by your plan." },
  },
  admin_bypass: {
    title: { tr: "Yönetici erişimi", en: "Admin access" },
    body: { tr: "Yönetici hesabı — kota uygulanmaz.", en: "Admin account — quota bypassed." },
  },
  /**
   * NOT: Bu metin bilerek "limitiniz doldu, yükseltin" demiyor.
   * Ölçülmüş bulgu: kısıtı öne çıkaran metinler en zayıf dönüşümü veriyor;
   * kullanıcının O ANA kadar aldığı değeri ve yükseltmenin ne KAZANDIRACAĞINI
   * söyleyen metinler en iyisini. Kullanıcı zaten engellendiğini görüyor —
   * ona bunu tekrar söylemek yerine karşılığını anlatmak gerekiyor.
   */
  plan_limit_reached: {
    title: { tr: "Bugünlük bu kadar", en: "That's today's quota" },
    body: {
      tr: "Bugün hakkını sonuna kadar kullandın. Pro'da günlük sınır yok: belgeleri arka arkaya işler, büyük dosyalar yükler ve toplu dönüştürme yaparsın.",
      en: "You've used everything today. Pro removes the daily cap: process documents back to back, upload larger files and convert in batches.",
    },
  },
  tool_not_registered: {
    title: { tr: "Araç tanımlı değil", en: "Tool unavailable" },
    body: {
      tr: "Bu araç henüz yayında değil. Destek ile iletişime geçin.",
      en: "This tool isn't live yet. Please contact support.",
    },
  },
  user_not_found: {
    title: { tr: "Oturum doğrulanamadı", en: "Session not recognised" },
    body: {
      tr: "Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.",
      en: "Your session is no longer recognised. Please sign in again.",
    },
  },
  race_lost: {
    title: { tr: "Kısa bir aksaklık", en: "Brief conflict" },
    body: {
      tr: "Eşzamanlı bir işlem araya girdi. Yeniden deneyebilirsiniz.",
      en: "A concurrent request got in first. Please try again.",
    },
  },
};

const ACTION_LABELS: Record<SaaSGatingActionKind, Dict> = {
  download: { tr: "İndir", en: "Download" },
  upgrade: { tr: "Planları Gör", en: "View plans" },
  retry: { tr: "Yeniden dene", en: "Try again" },
  contact: { tr: "Destek ile iletişime geç", en: "Contact support" },
};

export type SaaSGatingCopy = {
  title: string;
  body: string;
  primaryActionLabel: string;
  remainingOpsLabel: string;
  lockedOverlayLabel: string;
};

export function saasGatingCopy(
  state: SaaSGatingState,
  language: Language,
): SaaSGatingCopy {
  const reason: SaaSGatingReason = state.reason ?? "plan_allows";
  const reasonCopy = REASON_COPY[reason] ?? REASON_COPY["plan_allows"];
  const actionLabel = pick(ACTION_LABELS[state.action], language);

  const remainingOpsLabel =
    language === "tr"
      ? `Kalan işlem: ${state.remainingOps}`
      : `Remaining operations: ${state.remainingOps}`;

  return {
    title: pick(reasonCopy.title, language),
    body: pick(reasonCopy.body, language),
    primaryActionLabel: actionLabel,
    remainingOpsLabel,
    lockedOverlayLabel: language === "tr" ? "Önizleme kilitli" : "Preview locked",
  };
}
