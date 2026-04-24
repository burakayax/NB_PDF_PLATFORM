/**
 * Copy deck for the SaaS UI-gating layer. Kept separate from `workspace.ts`
 * so the mapper / preview component can be reused outside of the tool-progress
 * bar (e.g. in history, batch results) without pulling in the full workspace
 * strings bundle.
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
  credit_available: {
    title: { tr: "İndirmeye hazır", en: "Ready to download" },
    body: {
      tr: "Kredin düşüldü, dosyanı indirebilirsin.",
      en: "A credit has been spent — your file is ready.",
    },
  },
  active_subscription: {
    title: { tr: "Ücretsiz indirme", en: "No charge for this download" },
    body: {
      tr: "Bu indirme için kredi düşülmedi.",
      en: "No credits were spent for this download.",
    },
  },
  admin_bypass: {
    title: { tr: "Yönetici erişimi", en: "Admin access" },
    body: {
      tr: "Bu hesap yönetici olduğu için kredi düşülmedi.",
      en: "Admin accounts bypass credit consumption.",
    },
  },
  insufficient_credits: {
    title: { tr: "Yeterli krediniz yok", en: "You don’t have enough credits" },
    body: {
      tr: "İndirmek için yeterli krediniz yok. Kredi satın alarak devam edebilirsiniz.",
      en: "You don’t have enough credits to download. Buy credits to continue.",
    },
  },
  tool_not_registered: {
    title: { tr: "Araç tanımlı değil", en: "Tool unavailable" },
    body: {
      tr: "Bu araç henüz yayında değil. Destek ile iletişime geçin.",
      en: "This tool isn’t live yet. Please contact support.",
    },
  },
  user_not_found: {
    title: { tr: "Oturum doğrulanamadı", en: "Session not recognised" },
    body: {
      tr: "Oturumun zaman aşımına uğradı. Lütfen yeniden giriş yap.",
      en: "Your session is no longer recognised. Please sign in again.",
    },
  },
  race_lost: {
    title: { tr: "Kısa bir aksaklık", en: "Brief conflict" },
    body: {
      tr: "Eşzamanlı bir işlem araya girdi. Yeniden deneyebilirsin.",
      en: "A concurrent request got in first. Please try again.",
    },
  },
};

const ACTION_LABELS: Record<SaaSGatingActionKind, Dict> = {
  download: { tr: "İndir", en: "Download" },
  upgrade: { tr: "Kredi satın al", en: "Buy credits" },
  retry: { tr: "Yeniden dene", en: "Try again" },
  contact: { tr: "Destek ile iletişime geç", en: "Contact support" },
};

const CREDIT_STRINGS = {
  headerPrefix: { tr: "Krediler", en: "Credits" } as Dict,
  changeArrow: { tr: "→", en: "→" } as Dict,
  unchangedSuffix: { tr: "değişmedi", en: "unchanged" } as Dict,
  costSpent: (cost: number): Dict => ({
    tr: `${cost} kredi kullanıldı`,
    en: `${cost} credit${cost === 1 ? "" : "s"} spent`,
  }),
  costFree: { tr: "Ücretsiz", en: "Free" } as Dict,
  balanceAfter: (n: number): Dict => ({
    tr: `${n} kredin kaldı`,
    en: `${n} credit${n === 1 ? "" : "s"} left`,
  }),
  lockedOverlay: {
    tr: "Önizleme kilitli",
    en: "Preview locked",
  } as Dict,
};

export type SaaSGatingCopy = {
  title: string;
  body: string;
  primaryActionLabel: string;
  creditPillHeader: string;
  creditPillBefore: number;
  creditPillAfter: number;
  creditDeltaLabel: string;
  creditsLeftLabel: string;
  lockedOverlayLabel: string;
};

export function saasGatingCopy(
  state: SaaSGatingState,
  language: Language,
): SaaSGatingCopy {
  const reason: SaaSGatingReason = state.reason ?? "credit_available";
  const reasonCopy = REASON_COPY[reason];
  const actionLabel = pick(ACTION_LABELS[state.action], language);

  const changed = state.creditsBefore !== state.creditsAfter;
  const delta = changed
    ? `${state.creditsBefore} ${pick(CREDIT_STRINGS.changeArrow, language)} ${state.creditsAfter}`
    : `${state.creditsAfter} ${pick(CREDIT_STRINGS.unchangedSuffix, language)}`;

  const spentLine =
    state.cost > 0 && state.mode === "unlocked"
      ? pick(CREDIT_STRINGS.costSpent(state.cost), language)
      : pick(CREDIT_STRINGS.costFree, language);

  return {
    title: pick(reasonCopy.title, language),
    body: pick(reasonCopy.body, language),
    primaryActionLabel: actionLabel,
    creditPillHeader: pick(CREDIT_STRINGS.headerPrefix, language),
    creditPillBefore: state.creditsBefore,
    creditPillAfter: state.creditsAfter,
    creditDeltaLabel: delta,
    creditsLeftLabel: spentLine,
    lockedOverlayLabel: pick(CREDIT_STRINGS.lockedOverlay, language),
  };
}
