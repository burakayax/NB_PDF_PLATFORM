/**
 * ARAÇ ERİŞİM ROZETİ — ana sayfadaki araç kartlarının "kim kullanabilir" etiketi için TEK KAYNAK.
 *
 * Rozet elle yazılmaz; şu kaynaklardan türetilir:
 *  • toolCatalog.ts   → `free` (üyeliksiz, cihazda), `account` (ücretsiz üyelik), `ai`
 *  • planConfig.ts    → FREE_PLAN_TOOL_IDS / STARTER_TOOL_IDS (sunucudaki planlarla aynı liste)
 *  • aşağıdaki SPECIAL → listelerin anlatamadığı, araca özel kurallar (günlük hak, kontenjan, kredi…)
 *
 * Bir kural değiştiğinde (ör. araç Başlangıç'a açıldı) yalnız ilgili liste/satır güncellenir; kart
 * rozeti kendiliğinden değişir. `__tests__/toolAccess.test.ts` her araç için rozetin üretildiğini ve
 * listelerin sunucu ile ayrışmadığını denetler.
 *
 * NOT: Canlı yönetim panelindeki "Paket & fiyat" ayarı sunucudaki varsayılanları ezebilir; buradaki
 * rozetler KOD varsayılanlarını yansıtır.
 */
import { FREE_PLAN_TOOL_IDS, STARTER_TOOL_IDS } from "./planConfig";

/** Rozetin rengini belirler: guest=yeşil, account=mavi, starter=sarı, plus=mor, ai=fuşya. */
export type AccessTone = "guest" | "account" | "starter" | "plus" | "ai";

export type AccessBadge = {
  tone: AccessTone;
  label: string;
  /** Kartın üzerine gelince gösterilen açıklama (varsa). */
  detail?: string;
};

type Bi = { tr: string; en: string };

type Special = {
  tone: AccessTone;
  /** Ana etiketin yanına eklenen kısa not. Boşsa yalnız ana etiket görünür. */
  suffix?: Bi;
  /** Ana etiketin yerine geçen tam etiket (suffix yerine). */
  label?: Bi;
  detail: Bi;
};

const BASE_LABEL: Record<AccessTone, Bi> = {
  guest: { tr: "Üyeliksiz", en: "No sign-up" },
  account: { tr: "Ücretsiz üyelik", en: "Free account" },
  starter: { tr: "Başlangıç+", en: "Starter+" },
  plus: { tr: "Plus+", en: "Plus+" },
  ai: { tr: "Başlangıç+", en: "Starter+" },
};

const AI_GIFT: Bi = { tr: "3 hediye işlem", en: "3 free tries" };

const AI_DETAIL: Bi = {
  tr: "Başlangıç ve üzeri planlar ya da satın alınmış kredi gerekir. Ücretsiz üyeye kayıtta bir kez 3 hediye işlem verilir.",
  en: "Needs a Starter-or-higher plan or purchased credits. Free members get 3 free tries once, at sign-up.",
};

/**
 * Araca özel kurallar. Her satır koddaki gerçek davranışı anlatır; kaynak parantez içinde.
 */
const SPECIAL: Record<string, Special> = {
  // Misafir günde 1 (varsayılan; yönetim panelinden değişir), ücretsiz üye ortak günlük havuzdan.
  // Kaynak: backend/app/api/guest_compress_routes.py, subscription.config.ts → FREE_TOOLS.
  compress: {
    tone: "guest",
    suffix: { tr: "sınırlı hak", en: "limited" },
    detail: {
      tr: "Üyeliksiz günlük sınırlı hak (varsayılan 1). Ücretsiz üyelikte günlük ortak havuz (3 işlem). Paketlerde planın kendi hakkı.",
      en: "Limited daily allowance without an account (default 1). Free account: shared daily pool (3 operations). Paid plans use their own allowance.",
    },
  },
  // Kaynak: backend/app/core/editor_daily_limit.py (misafir 1, ücretsiz üye 2; Plus/Pro/Business sınırsız).
  "pdf-duzenle": {
    tone: "guest",
    suffix: { tr: "sınırlı hak", en: "limited" },
    detail: {
      tr: "Kaydetme/indirme: üyeliksiz günde 1, ücretsiz üye günde 2, Başlangıç günde 2. Plus ve üzeri sınırsız.",
      en: "Saving/downloading: 1/day without an account, 2/day for free and Starter members. Unlimited on Plus and above.",
    },
  },
  // Kaynak: api/src/modules/signature/signature.service.ts → AYLIK_KONTENJAN.
  "imza-iste": {
    tone: "account",
    suffix: { tr: "ayda 1 istek", en: "1 request/mo" },
    detail: {
      tr: "Aylık imza isteği kontenjanı: ücretsiz üye 1, Başlangıç 3, Plus 10, Pro 20, Business sınırsız.",
      en: "Monthly signature-request quota: Free 1, Starter 3, Plus 10, Pro 20, Business unlimited.",
    },
  },
  // Kaynak: backend/app/api/tool_routes_extra.py → /redact-pdf (giriş istemez), ai.middleware.ts (YZ tespiti).
  "hassas-veri-gizle": {
    tone: "guest",
    suffix: { tr: "YZ tespiti ücretli", en: "AI detection paid" },
    detail: {
      tr: "Bulunan verileri gizleme üyeliksiz çalışır (dosya sunucuya yüklenir). Yapay zekâ ile tespit Başlangıç ve üzeri plan ya da kredi gerektirir.",
      en: "Redacting the items works without an account (the file is uploaded). AI detection needs a Starter-or-higher plan or credits.",
    },
  },
  // Kaynak: components/tools/cv/cvTemplates.tsx (30 şablonun 4'ü ücretsiz), CvMakerTool (isPaidPlan).
  "cv-olustur": {
    tone: "account",
    suffix: { tr: "4 şablon ücretsiz", en: "4 free templates" },
    detail: {
      tr: "Giriş gerekir. 30 şablondan 4'ü ücretsiz; kalan 26'sı herhangi bir ücretli plan ya da CV Geçişi ile açılır.",
      en: "Sign-in required. 4 of 30 templates are free; the other 26 unlock with any paid plan or a CV pass.",
    },
  },
  // Kaynak: PhotoStudioTool.tsx → gate (giriş + isPaidPlan). Hediye işlem bu araçta geçmez.
  "ai-fotograf-studyosu": {
    tone: "ai",
    detail: {
      tr: "Giriş ve ücretli plan (Başlangıç ve üzeri) gerekir. Hediye işlem bu araçta geçmez. Fotoğraf cihazdan çıkmaz.",
      en: "Needs sign-in and a paid plan (Starter or higher). Free tries do not apply. The photo never leaves your device.",
    },
  },
  // Kaynak: ai-tool-switch.ts (varsayılan kapalı), plan-catalogue.ts → sözleşme kredileri.
  "sozlesme-denetci": {
    tone: "ai",
    suffix: { tr: "ek kredili", en: "extra credits" },
    detail: {
      tr: "Hızlı tarama aylık haktan ya da krediden; detaylı denetim yalnız satın alınmış krediden düşer. Hediye işlemler yetmez.",
      en: "Quick scan uses the monthly allowance or credits; the detailed audit uses purchased credits only. Free tries are not enough.",
    },
  },
};

/** Yapay zekâ kategorisindeki, özel satırı olmayan araçlar. */
function isPlainAiTool(id: string, ai: boolean | undefined): boolean {
  return !!ai && !(id in SPECIAL);
}

type ToolFlags = { id: string; free?: boolean; account?: boolean; ai?: boolean };

/** Bir aracın erişim rozetini (etiket + renk + açıklama) üretir. */
export function toolAccessBadge(t: ToolFlags, tr: boolean): AccessBadge {
  const pick = (b: Bi) => (tr ? b.tr : b.en);
  const sp = SPECIAL[t.id];
  if (sp) {
    const base = pick(BASE_LABEL[sp.tone]);
    const label = sp.label ? pick(sp.label) : sp.suffix ? `${base} · ${pick(sp.suffix)}` : base;
    return { tone: sp.tone, label, detail: pick(sp.detail) };
  }
  if (isPlainAiTool(t.id, t.ai)) {
    return { tone: "ai", label: `${pick(BASE_LABEL.ai)} · ${pick(AI_GIFT)}`, detail: pick(AI_DETAIL) };
  }
  if (t.free) return { tone: "guest", label: pick(BASE_LABEL.guest) };
  if (t.account || (FREE_PLAN_TOOL_IDS as string[]).includes(t.id)) {
    return { tone: "account", label: pick(BASE_LABEL.account) };
  }
  if ((STARTER_TOOL_IDS as string[]).includes(t.id)) return { tone: "starter", label: pick(BASE_LABEL.starter) };
  return { tone: "plus", label: pick(BASE_LABEL.plus) };
}

/** Ücretsiz üyelikle (mavi rozet) açılan araç sayısı — ana sayfadaki "Mavi işaretli N araç" metni için. */
export function accountToneCount(tools: ToolFlags[]): number {
  return tools.filter((t) => toolAccessBadge(t, true).tone === "account").length;
}
