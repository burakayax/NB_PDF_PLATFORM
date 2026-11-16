/**
 * "Ziyaretçiler ve satışlar" ekranının saf mantığı (ekrandan bağımsız, test edilebilir).
 * Ekranda teknik terim görünmesin diye tüm etiketler burada sade Türkçeye çevrilir.
 */

import { toolDisplayName } from "../../lib/teamActivity";
import { toolLabel } from "./journeyNarrative";

export type InsightEvent = { name: string; toolId: string | null; extra: string | null; createdAt: string };

export type InsightVisit = {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  userId: string | null;
  who: string | null;
  isMember: boolean;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  pageCount: number;
  events: InsightEvent[];
};

export type InsightSource = {
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  firstVisitAt: string | null;
};

export type InsightPayer = {
  checkoutId: string;
  userId: string;
  who: string;
  plan: string;
  kind: string;
  billingCycle: string;
  amount: string;
  currency: string;
  paidAt: string;
  signedUpAt: string;
  daysToPay: number;
  source: InsightSource | null;
  triggerTool: string | null;
  topTools: string[];
  status: string;
  cancelReason: string | null;
};

export type InsightCancellation = {
  id: string;
  createdAt: string;
  who: string;
  plan: string;
  reason: string;
  note: string | null;
  action: string;
};

export type InsightsPayload = {
  days: number;
  truncated: boolean;
  totals: { newUsers: number; paidCustomers: number; refunded: number };
  visits: InsightVisit[];
  payers: InsightPayer[];
  cancellations: InsightCancellation[];
};

export type Audience = "all" | "guest" | "member";

export function filterAudience<T extends { isMember: boolean }>(rows: T[], audience: Audience): T[] {
  if (audience === "guest") return rows.filter((r) => !r.isMember);
  if (audience === "member") return rows.filter((r) => r.isMember);
  return rows;
}

// ─── Nereden geldi ───────────────────────────────────────────────────────────

export type SourceKind = "Arama motoru" | "Sosyal medya" | "Yapay zekâ sohbeti" | "Reklam" | "E-posta" | "Doğrudan" | "Başka site";

export const SOURCE_KINDS: SourceKind[] = [
  "Arama motoru",
  "Sosyal medya",
  "Yapay zekâ sohbeti",
  "Reklam",
  "E-posta",
  "Başka site",
  "Doğrudan",
];

type SourceLike = Pick<InsightSource, "referrer" | "utmSource" | "utmMedium" | "utmCampaign">;

const NAMED: Array<{ re: RegExp; name: string; kind: SourceKind }> = [
  { re: /^(google|google\.[a-z.]+)$/i, name: "Google", kind: "Arama motoru" },
  { re: /^bing(\.com)?$/i, name: "Bing", kind: "Arama motoru" },
  { re: /^(yandex|yandex\.[a-z.]+)$/i, name: "Yandex", kind: "Arama motoru" },
  { re: /^duckduckgo(\.com)?$/i, name: "DuckDuckGo", kind: "Arama motoru" },
  { re: /^(instagram|ig)(\.com)?$/i, name: "Instagram", kind: "Sosyal medya" },
  { re: /^(facebook|fb|m\.facebook|l\.facebook)(\.com)?$/i, name: "Facebook", kind: "Sosyal medya" },
  { re: /^(x|twitter|t\.co)(\.com)?$/i, name: "X (Twitter)", kind: "Sosyal medya" },
  { re: /^tiktok(\.com)?$/i, name: "TikTok", kind: "Sosyal medya" },
  { re: /^(youtube|youtu\.be)(\.com)?$/i, name: "YouTube", kind: "Sosyal medya" },
  { re: /^linkedin(\.com)?$/i, name: "LinkedIn", kind: "Sosyal medya" },
  { re: /^(reddit|pinterest|whatsapp|telegram|t\.me)(\.com)?$/i, name: "", kind: "Sosyal medya" },
  { re: /^(chatgpt|openai)(\.com)?$/i, name: "ChatGPT", kind: "Yapay zekâ sohbeti" },
  { re: /^(claude|anthropic)(\.ai|\.com)?$/i, name: "Claude", kind: "Yapay zekâ sohbeti" },
  { re: /^(perplexity|gemini)(\.ai|\.com|\.google\.com)?$/i, name: "", kind: "Yapay zekâ sohbeti" },
];

function titleCase(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

function hostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Ziyaretçinin geldiği yerin okunur adı ve türü. Reklam/paylaşım etiketi varsa o, yoksa geldiği site esas alınır. */
export function sourceInfo(src: SourceLike | null | undefined): { name: string; kind: SourceKind; campaign: string | null } {
  if (!src) return { name: "Doğrudan / bilinmiyor", kind: "Doğrudan", campaign: null };
  const campaign = src.utmCampaign?.trim() || null;
  const medium = (src.utmMedium ?? "").toLowerCase();
  const tagged = src.utmSource?.trim();
  const host = hostOf(src.referrer);
  const raw = tagged || host;
  if (!raw) return { name: "Doğrudan / bilinmiyor", kind: "Doğrudan", campaign };
  if (/pdfplatform\./i.test(raw)) return { name: "Doğrudan / bilinmiyor", kind: "Doğrudan", campaign };

  const hit = NAMED.find((n) => n.re.test(raw));
  const baseName = hit ? hit.name || titleCase(raw.replace(/\.(com|ai|me)$/i, "")) : titleCase(raw);
  let kind: SourceKind = hit?.kind ?? "Başka site";
  if (/^(cpc|paid|ppc|paidsocial|paid_social|display)$/.test(medium)) {
    kind = "Reklam";
    return { name: `${baseName} reklamı`, kind, campaign };
  }
  if (/mail|newsletter|eposta/.test(medium) || /^(email|e-?posta|newsletter|mail)$/i.test(raw)) {
    return { name: "E-posta", kind: "E-posta", campaign };
  }
  return { name: baseName, kind, campaign };
}

/** Tabloda tek satır olarak gruplamak için anahtar: ad + (varsa) paylaşım/reklam adı. */
export function sourceKey(src: SourceLike | null | undefined): string {
  const s = sourceInfo(src);
  return s.campaign ? `${s.name} · ${s.campaign}` : s.name;
}

// ─── Ziyaretçinin ulaştığı adım ──────────────────────────────────────────────

export type Stage =
  | "browsed"
  | "finished_tool"
  | "clicked_signup"
  | "signed_up"
  | "saw_pricing"
  | "started_payment"
  | "abandoned"
  | "purchased";

export const STAGE_ORDER: Stage[] = [
  "browsed",
  "finished_tool",
  "clicked_signup",
  "signed_up",
  "saw_pricing",
  "started_payment",
  "abandoned",
  "purchased",
];

export const STAGE_LABEL: Record<Stage, string> = {
  browsed: "Sadece gezdi",
  finished_tool: "Bir aracı bitirdi",
  clicked_signup: "Üye olmaya tıkladı",
  signed_up: "Üye oldu",
  saw_pricing: "Fiyatlara baktı",
  started_payment: "Ödemeye başladı",
  abandoned: "Ödemeden vazgeçti",
  purchased: "Satın aldı",
};

const has = (v: InsightVisit, ...names: string[]) => v.events.some((e) => names.includes(e.name));

export function visitStage(v: InsightVisit): Stage {
  if (has(v, "purchase")) return "purchased";
  if (has(v, "checkout_abandoned")) return "abandoned";
  if (has(v, "select_plan", "add_payment_info", "payment_started")) return "started_payment";
  if (has(v, "view_pricing", "upgrade_cta_clicked", "quota_wall_hit")) return "saw_pricing";
  if (has(v, "sign_up_completed")) return "signed_up";
  if (has(v, "sign_up_cta_click")) return "clicked_signup";
  if (has(v, "sign_up_cta_shown")) return "finished_tool";
  return "browsed";
}

/** "Adım adım" tablosu: her adımda kaç ziyaretçi var (bir kişi birden çok adıma girebilir). */
export type StepRow = { id: string; label: string; hint: string; count: number };

export function stepRows(visits: InsightVisit[]): StepRow[] {
  const n = (...names: string[]) => visits.filter((v) => has(v, ...names)).length;
  return [
    { id: "visit", label: "Siteyi ziyaret etti", hint: "Siteye giren herkes.", count: visits.length },
    { id: "tool", label: "Bir aracı bitirdi", hint: "Misafir bir aracı sonuna kadar kullandı ve üye ol ekranı gösterildi.", count: n("sign_up_cta_shown") },
    { id: "click", label: "Üye olmaya tıkladı", hint: "Üye ol ekranını kapatmak yerine kayda yöneldi.", count: n("sign_up_cta_click") },
    { id: "signup", label: "Üye oldu", hint: "Kaydı tamamladı.", count: n("sign_up_completed") },
    { id: "pricing", label: "Fiyatlara baktı", hint: "Hakkı bitti ya da yükselt dedi; fiyat ekranını gördü.", count: n("view_pricing", "upgrade_cta_clicked", "quota_wall_hit") },
    { id: "pay", label: "Ödemeye başladı", hint: "Bir plan seçti ve ödeme adımlarına girdi.", count: n("select_plan", "add_payment_info", "payment_started") },
    { id: "aband", label: "Ödemeden vazgeçti", hint: "Ödeme adımlarından birinde bıraktı.", count: n("checkout_abandoned") },
    { id: "buy", label: "Satın aldı", hint: "Ödemeyi tamamladı.", count: n("purchase") },
  ];
}

// ─── Araç adları ─────────────────────────────────────────────────────────────

/** Araç kimliklerini ("merge_success", "compress_guest", "pdf-merge") okunur Türkçe ada çevirir. */
export function plainToolName(id: string | null | undefined): string {
  if (!id) return "—";
  const trimmed = id.replace(/_guest$/, "").replace(/_success$/, "");
  // Önce sitenin kendi araç listesi (kenar çubuğu adları), sonra bilinen başarı adları.
  const fromSidebar = toolDisplayName(trimmed, "tr");
  if (fromSidebar && fromSidebar !== trimmed) return fromSidebar;
  const fromJourney = toolLabel(`${trimmed}_success`);
  return fromJourney === "bir araç" ? trimmed : fromJourney;
}

// ─── Sade etiketler ──────────────────────────────────────────────────────────

const PLAN_NAMES: Record<string, string> = {
  FREE: "Ücretsiz",
  STARTER: "Başlangıç",
  PLUS: "Plus",
  PRO: "Pro",
  BUSINESS: "Business",
  "cv-pass": "CV Geçişi",
};

export function planName(v: unknown): string {
  return typeof v === "string" ? (PLAN_NAMES[v] ?? v) : "—";
}

export function purchaseWhat(p: Pick<InsightPayer, "plan" | "kind" | "billingCycle">): string {
  if (p.kind === "ai_credit") return "Yapay zekâ kredisi";
  if (p.kind === "cv_pass") return "CV Geçişi";
  if (p.kind === "seats") return "Ek koltuk";
  return `${planName(p.plan)} (${p.billingCycle === "YEARLY" ? "yıllık" : "aylık"})`;
}

export const PAYER_STATUS_LABEL: Record<string, string> = {
  active: "Devam ediyor",
  cancelled: "İptal etti (dönem sonunda biter)",
  refunded: "Parası iade edildi",
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  too_expensive: "Fiyatı yüksek buldu",
  not_using: "Yeterince kullanmıyor",
  missing_feature: "İhtiyacı olan özellik yok",
  found_alternative: "Başka bir araç buldu",
  quality: "Sonuçlardan memnun kalmadı",
  temporary: "Kısa süreliğine lazımdı",
  other: "Diğer",
  skipped: "Neden belirtmedi",
};

export const CANCEL_ACTION_LABEL: Record<string, string> = {
  refunded: "7 gün içinde iade aldı",
  cancel_pending: "Dönem sonunda biter",
};

export const ABANDON_STEP_LABEL: Record<string, string> = {
  billing_info: "Fatura bilgisi adımında",
  payment_summary: "Ödeme özeti adımında",
  payment_failed: "Ödeme adımında (başarısız/iptal)",
};

export function parseExtra(raw: string | null): Record<string, string | number | boolean> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, string | number | boolean>) : {};
  } catch {
    return {};
  }
}

export function formatMoney(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return amount;
  return currency === "USD"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

// ─── "Nereden geliyorlar?" ve "Hangi araç?" tabloları ───────────────────────

export type SourceRow = {
  key: string;
  name: string;
  kind: SourceKind;
  visitors: number;
  signedUp: number;
  sawPricing: number;
  bought: number;
};

export function sourceRows(visits: InsightVisit[], payers: InsightPayer[]): SourceRow[] {
  const map = new Map<string, SourceRow>();
  const row = (src: SourceLike | null | undefined): SourceRow => {
    const key = sourceKey(src);
    let r = map.get(key);
    if (!r) {
      r = { key, name: key, kind: sourceInfo(src).kind, visitors: 0, signedUp: 0, sawPricing: 0, bought: 0 };
      map.set(key, r);
    }
    return r;
  };
  for (const v of visits) {
    const r = row(v);
    r.visitors += 1;
    if (has(v, "sign_up_completed")) r.signedUp += 1;
    if (has(v, "view_pricing", "upgrade_cta_clicked", "quota_wall_hit", "select_plan", "add_payment_info", "payment_started")) {
      r.sawPricing += 1;
    }
  }
  for (const p of payers) {
    if (p.kind !== "plan") continue;
    row(p.source).bought += 1;
  }
  return [...map.values()].sort((a, b) => b.visitors - a.visitors || b.bought - a.bought);
}

export type ToolRow = { id: string; name: string; finished: number; clicked: number; wall: number; pricing: number };

export function toolRows(visits: InsightVisit[]): ToolRow[] {
  const map = new Map<string, ToolRow>();
  const get = (raw: string | null | undefined): ToolRow | null => {
    if (!raw) return null;
    const name = plainToolName(raw);
    let r = map.get(name);
    if (!r) {
      r = { id: raw, name, finished: 0, clicked: 0, wall: 0, pricing: 0 };
      map.set(name, r);
    }
    return r;
  };
  for (const v of visits) {
    for (const e of v.events) {
      if (e.name === "sign_up_cta_shown") {
        const r = get(e.toolId);
        if (r) r.finished += 1;
      } else if (e.name === "sign_up_cta_click") {
        const r = get(e.toolId);
        if (r) r.clicked += 1;
      } else if (e.name === "quota_wall_hit") {
        const r = get(e.toolId);
        if (r) r.wall += 1;
      } else if (e.name === "view_pricing") {
        const reason = parseExtra(e.extra).reason_tool;
        const r = get(typeof reason === "string" ? reason : null);
        if (r) r.pricing += 1;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.finished + b.wall + b.pricing - (a.finished + a.wall + a.pricing));
}
