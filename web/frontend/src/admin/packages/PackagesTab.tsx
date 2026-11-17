import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, RefreshCw, Search } from "lucide-react";
import {
  fetchAdminPlans,
  putAdminPackagesMarketing,
  putAdminPlanLimits,
  putAdminPlanPricing,
  putAdminPlansOverride,
} from "../../api/admin";
import { PLANS } from "../../lib/planConfig";
import { TOOLS as TOOL_CATALOG } from "../../lib/toolCatalog";
import { notifyRuntimeRefresh } from "../../lib/runtimeRefreshEvents";
import { pdfToolLabelTr } from "../lib/pdfToolLabels";
import { emitAdminToast } from "../lib/adminToast";
import { AdminField, ConfirmModal, adminInputClass } from "../mosaic/adminPrimitives";

/* ───────────────────────── Tipler ───────────────────────── */

type PlanKey = "FREE" | "STARTER" | "PLUS" | "PRO" | "BUSINESS";
const PLAN_KEYS: PlanKey[] = ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"];
type PaidKey = Exclude<PlanKey, "FREE">;

type PlanPrice = { tryGrossMonthly: string; tryGrossYearly: string; usdMonthly: string; usdYearly: string };
type PlanLimit = { dailyOperationLimit: number | null; monthlyOperationLimit: number; fileSizeLimitMB: number; batchLimit: number };
type LimitRowData = PlanLimit & { aiMonthlyCredits: number };

type Payload = {
  plans: Array<{ name: string; displayName: string; description: string; dailyLimit: number | null; allowedFeatures: string[]; multiUser: boolean }>;
  checkoutStats: Record<string, { completed: number; pending: number }>;
  marketing: unknown;
  plansOverride: unknown;
  paymentPrices?: { PRO: string; BUSINESS: string; PRO_ANNUAL: string };
  /** Şu an GEÇERLİ fiyat defteri (panelde kayıtlı değer ya da kod varsayılanı). */
  priceBook?: { plans: Record<PaidKey, PlanPrice>; extraSeat: { tryGrossMonthly: string; usdMonthly: string } };
  /** Şu an GEÇERLİ limitler (panelde kayıtlı değer ya da kod varsayılanı). */
  limitBook?: Record<PlanKey, LimitRowData>;
  featureCatalog?: string[];
  catalogue?: {
    prices: Record<PaidKey, PlanPrice>;
    limits: Record<PlanKey, PlanLimit>;
    aiMonthlyCredits: Record<PlanKey, number>;
    extraSeat: { tryGrossMonthly: string; usdMonthly: string };
    team: { includedSeats: number; maxTotalSeats: number; extraSeatMonthlyOps: number; signatureRequestsBase: number; extraSeatSignatureRequests: number };
    yearlyPlans: PaidKey[];
    vatRate: number;
  };
};

type PriceField = keyof PlanPrice;
type BookForm = { plans: Record<PaidKey, PlanPrice>; extraSeat: { tryGrossMonthly: string; usdMonthly: string } };
const PAID_KEYS: PaidKey[] = ["STARTER", "PLUS", "PRO", "BUSINESS"];

type PlanForm = { features: string[] };

/** Limit formu: sayılar metin olarak tutulur (yazarken boş kalabilsin), kaydederken sayıya çevrilir. */
type LimitForm = { dailyUnlimited: boolean; daily: string; monthly: string; fileMB: string; batch: string; ai: string };
const limitFormFrom = (r: LimitRowData): LimitForm => ({
  dailyUnlimited: r.dailyOperationLimit === null,
  daily: String(r.dailyOperationLimit ?? 25),
  monthly: String(r.monthlyOperationLimit),
  fileMB: String(r.fileSizeLimitMB),
  batch: String(r.batchLimit),
  ai: String(r.aiMonthlyCredits),
});
const limitRowFrom = (f: LimitForm): LimitRowData => ({
  dailyOperationLimit: f.dailyUnlimited ? null : Math.round(num(f.daily)),
  monthlyOperationLimit: Math.round(num(f.monthly)),
  fileSizeLimitMB: Math.round(num(f.fileMB)),
  batchLimit: Math.round(num(f.batch)),
  aiMonthlyCredits: Math.round(num(f.ai)),
});
/** Aralık dışındaysa hata metni döner. */
function limitError(r: LimitRowData, free: boolean): string | null {
  if (r.dailyOperationLimit !== null && !(r.dailyOperationLimit >= 0 && r.dailyOperationLimit <= 100000)) return "günlük işlem 0–100.000 olmalı";
  if (!(r.monthlyOperationLimit >= 1 && r.monthlyOperationLimit <= 999999)) return "aylık işlem 1–999.999 olmalı";
  if (!(r.fileSizeLimitMB >= 1 && r.fileSizeLimitMB <= 10000)) return "dosya boyutu 1–10.000 MB olmalı";
  if (!(r.batchLimit >= 0 && r.batchLimit <= 1000)) return "toplu işlem 0–1.000 olmalı";
  if (!free && !(r.aiMonthlyCredits >= 0 && r.aiMonthlyCredits <= 100000)) return "yapay zekâ hakkı 0–100.000 olmalı";
  return null;
}

type PlanCardEdit = { nameTr: string; nameEn: string; taglineTr: string; taglineEn: string; featuresTr: string; featuresEn: string };
const EDITABLE_PLAN_CARDS = ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"] as const;
const emptyPlanCard = (): PlanCardEdit => ({ nameTr: "", nameEn: "", taglineTr: "", taglineEn: "", featuresTr: "", featuresEn: "" });
const DEFAULT_TAGLINES: Record<string, { tr: string; en: string }> = {
  FREE: { tr: "Başla, kart gerekmez.", en: "Get started, no card required." },
  STARTER: { tr: "Ara sıra dönüştürme yapanlar için.", en: "For occasional converters." },
  PLUS: { tr: "Düzenli PDF işi olanlar için.", en: "For regular PDF work." },
  PRO: { tr: "Yapay zekâ ve API isteyenler için.", en: "For AI tools and API access." },
  BUSINESS: { tr: "Ekipler ve kurumlar için.", en: "For teams and organizations." },
};
function planCardDefault(id: string): PlanCardEdit {
  const p = PLANS.find((x) => x.id === id);
  const tg = DEFAULT_TAGLINES[id] ?? { tr: "", en: "" };
  return {
    nameTr: p?.nameTr ?? "",
    nameEn: p?.nameEn ?? "",
    taglineTr: tg.tr,
    taglineEn: tg.en,
    featuresTr: (p?.featuresTr ?? []).join("\n"),
    featuresEn: (p?.featuresEn ?? []).join("\n"),
  };
}

/* ───────────────────────── Yardımcılar ───────────────────────── */

const PLAN_LABEL: Record<PlanKey, string> = {
  FREE: "Ücretsiz",
  STARTER: "Başlangıç",
  PLUS: "Plus",
  PRO: "Pro",
  BUSINESS: "Business",
};

/** Tailwind sınıfları tam yazılmalı (dinamik birleştirme derlenmez). */
const ACCENT: Record<PlanKey, { ring: string; chip: string; dot: string; text: string }> = {
  FREE: { ring: "border-slate-500/25", chip: "bg-slate-500/15 text-slate-200", dot: "bg-slate-400", text: "text-slate-200" },
  STARTER: { ring: "border-sky-400/25", chip: "bg-sky-500/15 text-sky-200", dot: "bg-sky-400", text: "text-sky-200" },
  PLUS: { ring: "border-violet-400/25", chip: "bg-violet-500/15 text-violet-200", dot: "bg-violet-400", text: "text-violet-200" },
  PRO: { ring: "border-cyan-400/35", chip: "bg-cyan-500/15 text-cyan-200", dot: "bg-cyan-400", text: "text-cyan-200" },
  BUSINESS: { ring: "border-amber-400/30", chip: "bg-amber-500/15 text-amber-200", dot: "bg-amber-400", text: "text-amber-200" },
};

const num = (s: string): number => {
  const n = Number.parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtTry = (n: number): string =>
  `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const fmtUsd = (s: string): string => `$${s}`;
const fmtNum = (n: number): string => n.toLocaleString("tr-TR");
/** Aylık KDV dahil TL'den yıllık KDV dahil TL: tam 10 ay (sunucudaki `yearlyGrossFromMonthly` ile aynı kural). */
const yearlyFromMonthly = (m: number): number => Math.round(m * 10 * 100) / 100;

const CATEGORY_LABEL: Record<string, string> = {
  ai: "Yapay Zekâ",
  edit: "Düzenle",
  scan: "Tara & Metin Tanıma",
  convert: "Dönüştür",
  legal: "Hukuk / UYAP",
  security: "Güvenlik",
  other: "Diğer",
};
const CATEGORY_ORDER = ["ai", "edit", "scan", "convert", "legal", "security", "other"];
const CATEGORY_BY_TOOL = new Map(TOOL_CATALOG.map((t) => [t.id, t.cat] as const));

function groupByCategory(keys: string[]): Array<{ cat: string; label: string; keys: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const k of keys) {
    const cat = CATEGORY_BY_TOOL.get(k) ?? "other";
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(k);
  }
  return CATEGORY_ORDER.filter((c) => buckets.has(c)).map((c) => ({ cat: c, label: CATEGORY_LABEL[c] ?? "Diğer", keys: buckets.get(c)! }));
}

/* ───────────────────────── Küçük yapı taşları ───────────────────────── */

const SURFACE = "rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01]";

function Panel({ title, help, right, children }: { title: string; help?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={SURFACE}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black tracking-tight text-white">{title}</h3>
          {help ? <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-slate-400">{help}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PrimaryButton({ busy, disabled, onClick, children }: { busy?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(6,182,212,0.6)] transition hover:from-cyan-400 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {busy ? "Kaydediliyor…" : children}
    </button>
  );
}

function GhostButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-white/[0.12] px-3.5 py-2 text-[12.5px] font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Kaydedilmemiş değişiklik varken altta yapışık duran kayıt çubuğu. */
function SaveBar({ dirty, busy, onSave, onDiscard, label }: { dirty: boolean; busy: boolean; onSave: () => void; onDiscard: () => void; label: string }) {
  return (
    <div
      className={`sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3 backdrop-blur-md transition ${
        dirty ? "border-amber-400/30 bg-slate-950/90 shadow-2xl" : "border-white/[0.06] bg-slate-950/60"
      }`}
    >
      <p className={`text-[13px] ${dirty ? "font-semibold text-amber-200" : "text-slate-500"}`}>
        {dirty ? "Kaydedilmemiş değişiklikleriniz var." : "Tüm değişiklikler kayıtlı."}
      </p>
      <div className="flex items-center gap-2">
        <GhostButton onClick={onDiscard} disabled={!dirty || busy}>
          Değişiklikleri at
        </GhostButton>
        <PrimaryButton busy={busy} disabled={!dirty} onClick={onSave}>
          {label}
        </PrimaryButton>
      </div>
    </div>
  );
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; label: string; badge?: string | null }> }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-black/25 p-1">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition ${
            value === t.id ? "bg-cyan-500/20 text-cyan-100 shadow-inner" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {t.label}
          {t.badge ? <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black leading-none text-black">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Ana bileşen ───────────────────────── */

export function PackagesTab({ accessToken }: { accessToken: string; uiMode?: unknown }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [tab, setTab] = useState<"prices" | "limits" | "access" | "vitrin">("prices");

  // Fiyatlar
  const [book, setBook] = useState<BookForm | null>(null);
  const savedBook = useRef<string>("");
  const [pricesBusy, setPricesBusy] = useState(false);
  const [confirmPrices, setConfirmPrices] = useState(false);

  // Erişim
  const [planForms, setPlanForms] = useState<Record<PlanKey, PlanForm> | null>(null);
  const savedForms = useRef<string>("");
  const [accessBusy, setAccessBusy] = useState(false);

  // Limitler
  const [limitForms, setLimitForms] = useState<Record<PlanKey, LimitForm> | null>(null);
  const savedLimitForms = useRef<string>("");
  const [limitsBusy, setLimitsBusy] = useState(false);
  const [confirmLimits, setConfirmLimits] = useState(false);
  const [toolQuery, setToolQuery] = useState("");

  // Vitrin
  const [planCards, setPlanCards] = useState<Record<string, PlanCardEdit>>({});
  const savedVitrin = useRef<string>("");
  const [vitrinPlan, setVitrinPlan] = useState<(typeof EDITABLE_PLAN_CARDS)[number]>("FREE");
  const [vitrinBusy, setVitrinBusy] = useState(false);
  const marketingExtraRef = useRef<Record<string, unknown>>({});

  const featureKeys = useMemo(() => {
    const fromServer = payload?.featureCatalog ?? [];
    if (fromServer.length) return fromServer;
    return Array.from(new Set((payload?.plans ?? []).flatMap((p) => p.allowedFeatures))).sort();
  }, [payload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = (await fetchAdminPlans(accessToken)) as Payload;
        if (cancelled) return;
        setPayload(d);
        setLoadErr(null);

        const cat0 = d.catalogue?.prices;
        const src = d.priceBook ?? (cat0 && d.catalogue ? { plans: cat0, extraSeat: d.catalogue.extraSeat } : null);
        if (src) {
          const b: BookForm = JSON.parse(JSON.stringify(src)) as BookForm;
          setBook(b);
          savedBook.current = JSON.stringify(b);
        }

        // Vitrin
        const m = d.marketing;
        const mObj = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
        const cardsObj = mObj.cards && typeof mObj.cards === "object" && !Array.isArray(mObj.cards) ? (mObj.cards as Record<string, unknown>) : null;
        const savedPc = cardsObj?.planCards;
        const pcRec = savedPc && typeof savedPc === "object" && !Array.isArray(savedPc) ? (savedPc as Record<string, Record<string, unknown>>) : {};
        const nextPc: Record<string, PlanCardEdit> = {};
        for (const id of EDITABLE_PLAN_CARDS) {
          const c = pcRec[id] ?? {};
          const def = planCardDefault(id);
          const joined = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").join("\n") : "");
          const s = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
          const a = (v: unknown, fb: string) => (joined(v).trim() ? joined(v) : fb);
          nextPc[id] = {
            nameTr: s(c.nameTr, def.nameTr),
            nameEn: s(c.nameEn, def.nameEn),
            taglineTr: s(c.taglineTr, def.taglineTr),
            taglineEn: s(c.taglineEn, def.taglineEn),
            featuresTr: a(c.featuresTr, def.featuresTr),
            featuresEn: a(c.featuresEn, def.featuresEn),
          };
        }
        setPlanCards(nextPc);
        savedVitrin.current = JSON.stringify({ nextPc });
        marketingExtraRef.current = { ...mObj };

        // Erişim formları — 5 planın tamamı
        const ov = d.plansOverride;
        const ovRec = ov && typeof ov === "object" && !Array.isArray(ov) ? (ov as Record<string, unknown>) : {};
        const next = {} as Record<PlanKey, PlanForm>;
        for (const name of PLAN_KEYS) {
          const p = d.plans?.find((x) => x.name === name);
          const o = ovRec[name] as Record<string, unknown> | undefined;
          next[name] = {
            features: Array.isArray(o?.allowedFeatures) ? [...(o.allowedFeatures as string[])] : [...(p?.allowedFeatures ?? [])],
          };
        }
        setPlanForms(next);
        savedForms.current = JSON.stringify(next);

        // Limitler — şu an geçerli defter (yoksa kod varsayılanı)
        const lb = d.limitBook;
        const lc = d.catalogue;
        if (lb || lc) {
          const lf = {} as Record<PlanKey, LimitForm>;
          for (const name of PLAN_KEYS) {
            const row = lb?.[name] ?? (lc ? { ...lc.limits[name], aiMonthlyCredits: lc.aiMonthlyCredits[name] } : null);
            if (row) lf[name] = limitFormFrom(row);
          }
          setLimitForms(lf);
          savedLimitForms.current = JSON.stringify(lf);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Planlar yüklenemedi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, loadTick]);

  const reload = useCallback(() => setLoadTick((t) => t + 1), []);

  const cat = payload?.catalogue;
  const vat = cat?.vatRate ?? 0.2;

  /* Değişiklik durumları */
  const pricesDirty = book ? JSON.stringify(book) !== savedBook.current : false;
  const accessDirty = planForms ? JSON.stringify(planForms) !== savedForms.current : false;
  const limitsDirty = limitForms ? JSON.stringify(limitForms) !== savedLimitForms.current : false;
  const vitrinDirty = JSON.stringify({ nextPc: planCards }) !== savedVitrin.current;

  /* Panelde kayıtlı fiyat, kod varsayılanından farklı mı? (bilgi amaçlı) */
  const drift = useMemo(() => {
    if (!cat || !payload?.priceBook) return [] as string[];
    const rows: string[] = [];
    const lbl: Record<PriceField, string> = { tryGrossMonthly: "TL aylık", tryGrossYearly: "TL yıllık", usdMonthly: "$ aylık", usdYearly: "$ yıllık" };
    for (const k of PAID_KEYS) {
      for (const f of Object.keys(lbl) as PriceField[]) {
        if (Math.abs(num(payload.priceBook.plans[k][f]) - num(cat.prices[k][f])) > 0.004) rows.push(`${PLAN_LABEL[k]} ${lbl[f]}`);
      }
    }
    if (Math.abs(num(payload.priceBook.extraSeat.tryGrossMonthly) - num(cat.extraSeat.tryGrossMonthly)) > 0.004) rows.push("Ek koltuk TL");
    if (Math.abs(num(payload.priceBook.extraSeat.usdMonthly) - num(cat.extraSeat.usdMonthly)) > 0.004) rows.push("Ek koltuk $");
    return rows;
  }, [cat, payload]);

  /* ───────── Kaydetme işlemleri ───────── */

  const savePrices = async () => {
    if (!book) return;
    const bad = PAID_KEYS.some((k) => (Object.keys(book.plans[k]) as PriceField[]).some((f) => num(book.plans[k][f]) <= 0)) ||
      num(book.extraSeat.tryGrossMonthly) <= 0 || num(book.extraSeat.usdMonthly) <= 0;
    if (bad) {
      emitAdminToast({ type: "error", message: "Tüm fiyatlar sıfırdan büyük bir sayı olmalı (örn. 449.00)." });
      setConfirmPrices(false);
      return;
    }
    setPricesBusy(true);
    try {
      await putAdminPlanPricing(accessToken, { plans: book.plans, extraSeat: book.extraSeat });
      emitAdminToast({ type: "success", message: "Fiyatlar kaydedildi. Ödeme ve fiyat kartları birkaç saniye içinde yeni tutarı kullanır." });
      notifyRuntimeRefresh();
      setConfirmPrices(false);
      reload();
    } catch (e) {
      emitAdminToast({ type: "error", message: e instanceof Error ? e.message : "Fiyatlar kaydedilemedi" });
    } finally {
      setPricesBusy(false);
    }
  };

  const discardPrices = () => {
    if (savedBook.current) setBook(JSON.parse(savedBook.current) as BookForm);
  };

  /** Koddaki güncel (resmî) fiyatları forma yükler; kaydedilene kadar canlıya geçmez. */
  const loadCodePrices = () => {
    if (!cat) return;
    setBook({ plans: JSON.parse(JSON.stringify(cat.prices)) as Record<PaidKey, PlanPrice>, extraSeat: { ...cat.extraSeat } });
  };

  const setPrice = (k: PaidKey, f: PriceField, v: string) =>
    setBook((prev) => (prev ? { ...prev, plans: { ...prev.plans, [k]: { ...prev.plans[k], [f]: v } } } : prev));

  const saveAccess = async () => {
    if (!planForms || !payload) return;
    setAccessBusy(true);
    try {
      const existing: Record<string, unknown> =
        payload.plansOverride && typeof payload.plansOverride === "object" && !Array.isArray(payload.plansOverride)
          ? { ...(payload.plansOverride as Record<string, unknown>) }
          : {};
      const before = savedForms.current ? (JSON.parse(savedForms.current) as Record<PlanKey, PlanForm>) : null;
      for (const name of PLAN_KEYS) {
        const pf = planForms[name];
        const prev = existing[name] as Record<string, unknown> | undefined;
        const changed = !before || JSON.stringify(before[name]) !== JSON.stringify(pf);
        // Dokunulmamış planın koddaki varsayılanı dondurulmasın.
        if (!changed && !prev) continue;
        // Yalnız araç listesi değişir; daha önce kayıtlı diğer alanlar olduğu gibi korunur.
        existing[name] = { ...(prev ?? {}), allowedFeatures: pf.features };
      }
      await putAdminPlansOverride(accessToken, existing);
      emitAdminToast({ type: "success", message: "Erişim kuralları kaydedildi. Siteye birkaç saniye içinde yansır." });
      notifyRuntimeRefresh();
      reload();
    } catch (e) {
      emitAdminToast({ type: "error", message: e instanceof Error ? e.message : "Kaydedilemedi" });
    } finally {
      setAccessBusy(false);
    }
  };

  const saveLimits = async () => {
    if (!limitForms) return;
    const before = savedLimitForms.current ? (JSON.parse(savedLimitForms.current) as Record<PlanKey, LimitForm>) : null;
    const body: Partial<Record<PlanKey, LimitRowData>> = {};
    for (const name of PLAN_KEYS) {
      if (before && JSON.stringify(before[name]) === JSON.stringify(limitForms[name])) continue; // dokunulmayan plan kodu izlemeye devam eder
      const row = limitRowFrom(limitForms[name]);
      const err = limitError(row, name === "FREE");
      if (err) {
        emitAdminToast({ type: "error", message: `${PLAN_LABEL[name]}: ${err}.` });
        setConfirmLimits(false);
        return;
      }
      body[name] = row;
    }
    setLimitsBusy(true);
    try {
      await putAdminPlanLimits(accessToken, body);
      emitAdminToast({ type: "success", message: "Limitler kaydedildi. Yeni işlemlerden itibaren geçerli olur." });
      notifyRuntimeRefresh();
      setConfirmLimits(false);
      reload();
    } catch (e) {
      emitAdminToast({ type: "error", message: e instanceof Error ? e.message : "Limitler kaydedilemedi" });
    } finally {
      setLimitsBusy(false);
    }
  };

  const discardLimits = () => {
    if (savedLimitForms.current) setLimitForms(JSON.parse(savedLimitForms.current) as Record<PlanKey, LimitForm>);
  };

  /** Koddaki güncel limitleri forma yükler; kaydedilene kadar canlıya geçmez. */
  const loadCodeLimits = () => {
    if (!cat) return;
    const lf = {} as Record<PlanKey, LimitForm>;
    for (const name of PLAN_KEYS) lf[name] = limitFormFrom({ ...cat.limits[name], aiMonthlyCredits: cat.aiMonthlyCredits[name] });
    setLimitForms(lf);
  };

  const patchLimit = (plan: PlanKey, patch: Partial<LimitForm>) =>
    setLimitForms((prev) => (prev ? { ...prev, [plan]: { ...prev[plan], ...patch } } : prev));

  const discardAccess = () => {
    if (savedForms.current) setPlanForms(JSON.parse(savedForms.current) as Record<PlanKey, PlanForm>);
  };

  const saveVitrin = async () => {
    setVitrinBusy(true);
    try {
      const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
      const pcOut: Record<string, unknown> = {};
      for (const id of EDITABLE_PLAN_CARDS) {
        const e = planCards[id] ?? emptyPlanCard();
        pcOut[id] = {
          nameTr: e.nameTr.trim(),
          nameEn: e.nameEn.trim(),
          taglineTr: e.taglineTr.trim(),
          taglineEn: e.taglineEn.trim(),
          featuresTr: lines(e.featuresTr),
          featuresEn: lines(e.featuresEn),
        };
      }
      const prevCards =
        marketingExtraRef.current.cards && typeof marketingExtraRef.current.cards === "object" && !Array.isArray(marketingExtraRef.current.cards)
          ? (marketingExtraRef.current.cards as Record<string, unknown>)
          : {};
      const merged = { ...marketingExtraRef.current, cards: { ...prevCards, planCards: pcOut } };
      await putAdminPackagesMarketing(accessToken, merged);
      emitAdminToast({ type: "success", message: "Fiyat kartı yazıları kaydedildi. Ana sayfa birkaç saniye içinde güncellenir." });
      notifyRuntimeRefresh();
      reload();
    } catch (e) {
      emitAdminToast({ type: "error", message: e instanceof Error ? e.message : "Kaydedilemedi" });
    } finally {
      setVitrinBusy(false);
    }
  };

  const discardVitrin = () => reload();

  /* ───────── Görünüm ───────── */

  const toggleFeature = (plan: PlanKey, fk: string) =>
    setPlanForms((prev) => {
      if (!prev) return prev;
      const set = new Set(prev[plan].features);
      if (set.has(fk)) set.delete(fk);
      else set.add(fk);
      return { ...prev, [plan]: { ...prev[plan], features: [...set] } };
    });

  const setAllFeatures = (plan: PlanKey, keys: string[], on: boolean) =>
    setPlanForms((prev) => {
      if (!prev) return prev;
      const set = new Set(prev[plan].features);
      for (const k of keys) {
        if (on) set.add(k);
        else set.delete(k);
      }
      return { ...prev, [plan]: { ...prev[plan], features: [...set] } };
    });

  if (loadErr) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] p-6 text-sm text-rose-100">
        <p className="font-bold">Paket ve fiyat bilgileri yüklenemedi.</p>
        <p className="mt-1 text-rose-200/80">{loadErr}</p>
        <div className="mt-4">
          <GhostButton onClick={reload}>Tekrar dene</GhostButton>
        </div>
      </div>
    );
  }
  if (!payload || !planForms || !cat || !limitForms) {
    return <p className="px-2 py-10 text-center text-sm text-slate-400">Paket ve fiyat bilgileri yükleniyor…</p>;
  }

  if (!book) {
    return <p className="px-2 py-10 text-center text-sm text-slate-400">Fiyatlar yükleniyor…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Satış ayarları</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Paket ve fiyat</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">
            Müşterinin ne ödediğini, her paketin işlem limitlerini, hangi pakette hangi araçların açık olduğunu ve ana sayfadaki fiyat kartlarında ne yazdığını buradan yönetirsiniz.
          </p>
        </div>
        <GhostButton onClick={reload}>
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </span>
        </GhostButton>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "prices", label: "Fiyatlar", badge: pricesDirty ? "!" : null },
          { id: "limits", label: "Limitler", badge: limitsDirty ? "!" : null },
          { id: "access", label: "Araç erişimi", badge: accessDirty ? "!" : null },
          { id: "vitrin", label: "Ana sayfa kartları", badge: vitrinDirty ? "!" : null },
        ]}
      />

      {/* ═════════════ FİYATLAR ═════════════ */}
      {tab === "prices" ? (
        <div className="space-y-6">
          {drift.length > 0 && !pricesDirty ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div className="text-[13px] leading-relaxed text-amber-100/90">
                  <p className="font-bold text-amber-200">Bazı fiyatlar, kodda tanımlı güncel fiyattan farklı.</p>
                  <p className="mt-1">
                    Müşteri <strong>burada yazanı</strong> öder. Farklı olanlar: {drift.join(", ")}. Bilerek değiştirdiyseniz sorun yok; eski bir kayıtsa
                    “Güncel fiyatları yükle” ile düzeltip kaydedin.
                  </p>
                </div>
              </div>
              <GhostButton onClick={loadCodePrices}>Güncel fiyatları yükle</GhostButton>
            </div>
          ) : null}

          {/* Plan kartları */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {PLAN_KEYS.map((k) => {
              const a = ACCENT[k];
              const st = payload.checkoutStats?.[k] ?? { completed: 0, pending: 0 };
              const lf = limitForms[k];
              const lim = limitRowFrom(lf);
              const paid = k !== "FREE" ? (k as PaidKey) : null;
              const row = paid ? book.plans[paid] : null;
              const yearlySold = paid ? cat.yearlyPlans.includes(paid) : false;
              const m = row ? num(row.tryGrossMonthly) : 0;
              const y = row ? num(row.tryGrossYearly) : 0;
              const disc = row && yearlySold && m > 0 ? Math.round((1 - y / (m * 12)) * 100) : 0;
              return (
                <div key={k} className={`${SURFACE} ${a.ring} flex flex-col p-4`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${a.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
                      {PLAN_LABEL[k]}
                    </span>
                  </div>

                  {paid && row ? (
                    <>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Türkiye · aylık (KDV dahil)</p>
                      <PriceInput symbol="₺" value={row.tryGrossMonthly} onChange={(v) => setPrice(paid, "tryGrossMonthly", v)} />

                      {yearlySold ? (
                        <>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Türkiye · yıllık (KDV dahil)</p>
                          <PriceInput symbol="₺" value={row.tryGrossYearly} onChange={(v) => setPrice(paid, "tryGrossYearly", v)} />
                          <button
                            type="button"
                            onClick={() => setPrice(paid, "tryGrossYearly", yearlyFromMonthly(m).toFixed(2))}
                            className="mt-1 text-left text-[11.5px] font-semibold text-cyan-300 hover:underline"
                          >
                            Aylık × 10 uygula ({fmtTry(yearlyFromMonthly(m))})
                          </button>
                        </>
                      ) : (
                        <p className="mt-3 text-[12px] text-slate-500">Yıllık satılmıyor (yalnız aylık)</p>
                      )}

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Yurt dışı · aylık (USD)</p>
                      <PriceInput symbol="$" value={row.usdMonthly} onChange={(v) => setPrice(paid, "usdMonthly", v)} />
                      {yearlySold ? (
                        <>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Yurt dışı · yıllık (USD)</p>
                          <PriceInput symbol="$" value={row.usdYearly} onChange={(v) => setPrice(paid, "usdYearly", v)} />
                        </>
                      ) : null}

                      <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-[12px]">
                        <Row label="Yıllık indirim" value={yearlySold ? `%${disc}` : "—"} />
                        <Row label="Ayda yaklaşık (yıllık)" value={yearlySold ? fmtTry(Math.round((y / 12) * 100) / 100) : "—"} />
                        <Row label="KDV hariç aylık" value={fmtTry(Math.round((m / (1 + vat)) * 100) / 100)} />
                      </dl>
                    </>
                  ) : (
                    <p className="mt-4 text-[26px] font-black leading-none text-white">₺0</p>
                  )}

                  <dl className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-[12px]">
                    <Row label="Aylık sunucu işlemi" value={lim.monthlyOperationLimit >= 999999 ? "Sınırsız" : fmtNum(lim.monthlyOperationLimit)} />
                    <Row label="Günlük işlem" value={lim.dailyOperationLimit == null ? "Sınır yok" : fmtNum(lim.dailyOperationLimit)} />
                    <Row label="Dosya boyutu" value={`${fmtNum(lim.fileSizeLimitMB)} MB`} />
                    <Row label="Toplu işlem" value={lim.batchLimit > 0 ? `${lim.batchLimit} dosya` : "Yok"} />
                    <Row label="Yapay zekâ hakkı" value={`${lim.aiMonthlyCredits} / ay`} />
                  </dl>

                  <div className="mt-auto pt-3">
                    <p className="text-[11.5px] text-slate-500">
                      <span className="font-bold text-emerald-300">{st.completed}</span> ödeme tamamlandı
                      {st.pending > 0 ? <span className="text-amber-300/90"> · {st.pending} beklemede</span> : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ek koltuk + ekip havuzu */}
          <Panel
            title="Business ekip havuzu ve ek koltuk"
            help="Ek koltuk fiyatı buradan değişir. Havuz sayıları (5 dahil koltuk, işlem ve imza havuzu) kodda tanımlıdır; ekranlar, e-postalar ve ödeme aynı sayıları taşıdığı için birlikte güncellenmeleri gerekir."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[11.5px] font-semibold text-slate-500">Ek koltuk · TL / ay (KDV dahil)</p>
                <PriceInput symbol="₺" value={book.extraSeat.tryGrossMonthly} onChange={(v) => setBook((p) => (p ? { ...p, extraSeat: { ...p.extraSeat, tryGrossMonthly: v } } : p))} />
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[11.5px] font-semibold text-slate-500">Ek koltuk · USD / ay</p>
                <PriceInput symbol="$" value={book.extraSeat.usdMonthly} onChange={(v) => setBook((p) => (p ? { ...p, extraSeat: { ...p.extraSeat, usdMonthly: v } } : p))} />
              </div>
              <Stat label="Dahil koltuk" value={`${cat.team.includedSeats} kişi`} sub={`En çok ${cat.team.maxTotalSeats} kişi`} />
              <Stat label="Havuz" value={`${fmtNum(limitRowFrom(limitForms.BUSINESS).monthlyOperationLimit)} işlem / ay`} sub={`Ek koltuk başına +${fmtNum(cat.team.extraSeatMonthlyOps)} · imza ${cat.team.signatureRequestsBase}/ay (+${cat.team.extraSeatSignatureRequests})`} />
            </div>
          </Panel>

          <p className="text-[12px] leading-relaxed text-slate-500">
            Tüm fiyatlar buradan değişir ve ödeme ekranı, ana sayfa kartları ile fatura aynı tutarı kullanır. Varsayılan değerler koddaki güncel fiyatlardır; hiç kayıt yapmasanız da
            müşteri bunları görür. Türkiye fiyatları KDV dahildir; yurt dışı (USD) fiyatlara KDV, ihracat istisnası kapalıyken ödeme ekranında eklenir.
          </p>

          <SaveBar dirty={pricesDirty} busy={pricesBusy} onSave={() => setConfirmPrices(true)} onDiscard={discardPrices} label="Fiyatları kaydet" />

          <ConfirmModal
            open={confirmPrices}
            title="Fiyatlar canlıya geçsin mi?"
            message={`Başlangıç ${fmtTry(num(book.plans.STARTER.tryGrossMonthly))}, Plus ${fmtTry(num(book.plans.PLUS.tryGrossMonthly))}, Pro ${fmtTry(num(book.plans.PRO.tryGrossMonthly))}, Business ${fmtTry(num(book.plans.BUSINESS.tryGrossMonthly))} (aylık, KDV dahil). Dolar: $${book.plans.STARTER.usdMonthly} / $${book.plans.PLUS.usdMonthly} / $${book.plans.PRO.usdMonthly} / $${book.plans.BUSINESS.usdMonthly}. Kaydettiğiniz anda ödeme ekranı ve fiyat kartları bu tutarları kullanır.`}
            confirmLabel="Evet, kaydet"
            busy={pricesBusy}
            onConfirm={savePrices}
            onClose={() => setConfirmPrices(false)}
          />
        </div>
      ) : null}

      {/* ═════════════ LİMİTLER ═════════════ */}
      {tab === "limits" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] px-4 py-3 text-[13px] leading-relaxed text-cyan-100/85">
            <strong className="text-cyan-200">Bu bölüm gerçek limitleri belirler.</strong> Sunucuda işlenen araçlar (sıkıştırma, Word ↔ PDF, OCR, yapay zekâ…) bu sayılara göre çalışır;
            cihazda çalışan araçlar (birleştir, böl, döndür…) sunucuya gitmediği için sınırsızdır. Kaydettiğiniz değer yeni işlemlerden itibaren geçerlidir; yalnız değiştirdiğiniz
            paketler sabitlenir, dokunmadıklarınız kodu izlemeye devam eder.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-slate-400">Altındaki “Kod: …” notu, kodda tanımlı varsayılandan farklı olduğunu gösterir.</p>
            <GhostButton onClick={loadCodeLimits}>Kod değerlerini yükle</GhostButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {PLAN_KEYS.map((k) => {
              const f = limitForms[k];
              const code = cat.limits[k];
              const codeAi = cat.aiMonthlyCredits[k];
              const err = limitError(limitRowFrom(f), k === "FREE");
              return (
                <div key={k} className={`${SURFACE} ${ACCENT[k].ring} flex flex-col gap-4 p-4`}>
                  <span className={`inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${ACCENT[k].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ACCENT[k].dot}`} />
                    {PLAN_LABEL[k]}
                  </span>

                  <LimitField
                    label="Günlük sunucu işlemi"
                    value={f.daily}
                    disabled={f.dailyUnlimited}
                    suffix="işlem / gün"
                    onChange={(v) => patchLimit(k, { daily: v })}
                    codeNote={(code.dailyOperationLimit === null) !== f.dailyUnlimited || (!f.dailyUnlimited && code.dailyOperationLimit !== Math.round(num(f.daily))) ? `Kod: ${code.dailyOperationLimit === null ? "sınır yok" : fmtNum(code.dailyOperationLimit)}` : null}
                    extra={
                      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[12px] text-slate-300">
                        <input type="checkbox" checked={f.dailyUnlimited} onChange={(e) => patchLimit(k, { dailyUnlimited: e.target.checked })} className="h-3.5 w-3.5 rounded border-white/25 accent-cyan-500" />
                        Günlük sınır yok
                      </label>
                    }
                  />
                  <LimitField
                    label={k === "BUSINESS" ? "Aylık sunucu işlemi (5 koltuk havuzu)" : "Aylık sunucu işlemi"}
                    value={f.monthly}
                    suffix="işlem / ay"
                    hint={k === "BUSINESS" ? `Ek koltuk başına +${fmtNum(cat.team.extraSeatMonthlyOps)} (kodda sabit). 999999 = sınırsız.` : "999999 yazarsanız sınırsız olur."}
                    onChange={(v) => patchLimit(k, { monthly: v })}
                    codeNote={code.monthlyOperationLimit !== Math.round(num(f.monthly)) ? `Kod: ${fmtNum(code.monthlyOperationLimit)}` : null}
                  />
                  <LimitField
                    label="Dosya boyutu sınırı"
                    value={f.fileMB}
                    suffix="MB"
                    onChange={(v) => patchLimit(k, { fileMB: v })}
                    codeNote={code.fileSizeLimitMB !== Math.round(num(f.fileMB)) ? `Kod: ${fmtNum(code.fileSizeLimitMB)} MB` : null}
                  />
                  <LimitField
                    label="Toplu işlem (tek seferde dosya sayısı)"
                    value={f.batch}
                    suffix="dosya"
                    hint="0 = toplu işlem kapalı (tek dosya)."
                    onChange={(v) => patchLimit(k, { batch: v })}
                    codeNote={code.batchLimit !== Math.round(num(f.batch)) ? `Kod: ${code.batchLimit}` : null}
                  />
                  <LimitField
                    label="Yapay zekâ hakkı"
                    value={k === "FREE" ? "0" : f.ai}
                    suffix="hak / ay"
                    disabled={k === "FREE"}
                    hint={k === "FREE" ? "Ücretsiz üyeye hediye krediyle verilir; aylık hak yoktur." : undefined}
                    onChange={(v) => patchLimit(k, { ai: v })}
                    codeNote={k !== "FREE" && codeAi !== Math.round(num(f.ai)) ? `Kod: ${codeAi}` : null}
                  />
                  {err ? <p className="text-[12px] font-semibold text-rose-300">Düzeltin: {err}.</p> : null}
                </div>
              );
            })}
          </div>

          <p className="text-[12px] leading-relaxed text-slate-500">
            Ana sayfadaki kart yazıları, e-postalar ve SEO sayfalarındaki metinlerde geçen sayılar bu ekrandan değişmez; limiti değiştirirseniz “Ana sayfa kartları” sekmesindeki ilgili madde metnini de
            güncelleyin. Kullanıcıya özel günlük hak, kullanıcı detayından verilmeye devam eder ve plan limitinin yerine geçer.
          </p>

          <SaveBar dirty={limitsDirty} busy={limitsBusy} onSave={() => setConfirmLimits(true)} onDiscard={discardLimits} label="Limitleri kaydet" />

          <ConfirmModal
            open={confirmLimits}
            title="Limitler canlıya geçsin mi?"
            message={`Aylık sunucu işlemi — Ücretsiz ${fmtNum(Math.round(num(limitForms.FREE.monthly)))}, Başlangıç ${fmtNum(Math.round(num(limitForms.STARTER.monthly)))}, Plus ${fmtNum(Math.round(num(limitForms.PLUS.monthly)))}, Pro ${fmtNum(Math.round(num(limitForms.PRO.monthly)))}, Business ${fmtNum(Math.round(num(limitForms.BUSINESS.monthly)))}. Kaydettiğiniz anda yeni işlemler bu sınırlara göre kontrol edilir; kullanıcı ekranındaki kalan hak sayıları da değişir.`}
            confirmLabel="Evet, kaydet"
            busy={limitsBusy}
            onConfirm={saveLimits}
            onClose={() => setConfirmLimits(false)}
          />
        </div>
      ) : null}

      {/* ═════════════ ERİŞİM VE LİMİTLER ═════════════ */}
      {tab === "access" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] px-4 py-3 text-[13px] leading-relaxed text-cyan-100/85">
            <strong className="text-cyan-200">Bu bölüm gerçek erişimi belirler.</strong> Kaydettiğinizde kullanıcılar hangi aracı kullanabildiğini hemen bu kurala göre görür.
            Başlangıç kartındaki “Hangileri?” listesi de buradan otomatik oluşur. Kart yazıları ayrıdır ve “Ana sayfa kartları” sekmesinden yönetilir.
          </div>

          <Panel
            title="Hangi araç hangi pakette açık?"
            help="Satırlar araç, sütunlar paket. İşaretli kutu, o pakette aracın açık olduğu anlamına gelir; kapalı araç uygulamada kilitli görünür. Kategori satırındaki düğmeler o kategorinin tamamını açar/kapatır."
            right={
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                  placeholder="Araç ara…"
                  className="w-48 rounded-xl border border-white/[0.1] bg-white/[0.04] py-2 pl-9 pr-3 text-[12.5px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />
              </div>
            }
          >
            {/* Özet: her pakette kaç araç açık */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PLAN_KEYS.map((k) => {
                const on = planForms[k].features.filter((f) => featureKeys.includes(f)).length;
                return (
                  <div key={k} className={`rounded-xl border bg-black/20 px-3 py-2.5 ${ACCENT[k].ring}`}>
                    <p className={`text-[11px] font-black uppercase tracking-wide ${ACCENT[k].text}`}>{PLAN_LABEL[k]}</p>
                    <p className="mt-0.5 text-lg font-black tabular-nums text-white">
                      {on}
                      <span className="text-[12px] font-semibold text-slate-500"> / {featureKeys.length} araç</span>
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      <button type="button" onClick={() => setAllFeatures(k, featureKeys, true)} className="text-[10.5px] font-semibold text-cyan-300 hover:underline">
                        hepsini aç
                      </button>
                      <button type="button" onClick={() => setAllFeatures(k, featureKeys, false)} className="text-[10.5px] font-semibold text-slate-400 hover:underline">
                        hepsini kapat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[680px] text-left text-[12.5px]">
                <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-slate-950/95 backdrop-blur">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-slate-400">Araç</th>
                    {PLAN_KEYS.map((k) => (
                      <th key={k} className="w-24 px-2 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${ACCENT[k].text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ACCENT[k].dot}`} />
                          {PLAN_LABEL[k]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupByCategory(featureKeys.filter((fk) => !toolQuery.trim() || pdfToolLabelTr(fk).toLocaleLowerCase("tr").includes(toolQuery.trim().toLocaleLowerCase("tr")))).map((g) => (
                    <Fragment key={g.cat}>
                      <tr className="bg-cyan-500/[0.06]">
                        <td className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-cyan-200">
                          {g.label} <span className="font-semibold normal-case tracking-normal text-slate-500">· {g.keys.length} araç</span>
                        </td>
                        {PLAN_KEYS.map((k) => {
                          const on = g.keys.filter((fk) => planForms[k].features.includes(fk)).length;
                          const all = on === g.keys.length;
                          return (
                            <td key={k} className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setAllFeatures(k, g.keys, !all)}
                                title={all ? "Bu kategoriyi bu pakette kapat" : "Bu kategoriyi bu pakette aç"}
                                className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums transition ${
                                  all ? "bg-emerald-500/15 text-emerald-300" : on === 0 ? "bg-white/[0.05] text-slate-500" : "bg-amber-500/15 text-amber-200"
                                } hover:ring-1 hover:ring-white/25`}
                              >
                                {on}/{g.keys.length}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      {g.keys.map((fk) => (
                        <tr key={fk} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                          <td className="px-3 py-2 text-slate-200">{pdfToolLabelTr(fk)}</td>
                          {PLAN_KEYS.map((k) => (
                            <td key={k} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={planForms[k].features.includes(fk)}
                                onChange={() => toggleFeature(k, fk)}
                                aria-label={`${pdfToolLabelTr(fk)} — ${PLAN_LABEL[k]}`}
                                className="h-4 w-4 cursor-pointer rounded border-white/25 accent-cyan-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <SaveBar dirty={accessDirty} busy={accessBusy} onSave={() => void saveAccess()} onDiscard={discardAccess} label="Erişim kurallarını kaydet" />
        </div>
      ) : null}

      {/* ═════════════ ANA SAYFA KARTLARI ═════════════ */}
      {tab === "vitrin" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-[13px] leading-relaxed text-amber-100/90">
            <strong className="text-amber-200">Bu sekme yalnızca yazıdır.</strong> Fiyat kartlarındaki ad, kısa açıklama ve madde listesini değiştirir; kullanıcının gerçek erişimini ve ödediği tutarı
            değiştirmez. Limit veya araç erişimini değiştirirseniz ilgili kart maddesini burada elle güncelleyin. Başlangıç kartındaki “Hangileri?” araç listesi ise “Araç erişimi” sekmesinden otomatik oluşur.
          </div>

          <Panel title="Fiyat kartı yazıları (Türkçe + İngilizce)" help="Her paketin ana sayfadaki kartında görünen ad, kısa açıklama ve madde listesi. Boş bırakılan alan sitedeki güncel varsayılan metni kullanır.">
            <div className="mb-4 flex flex-wrap gap-2">
              {EDITABLE_PLAN_CARDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVitrinPlan(id)}
                  className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${
                    vitrinPlan === id ? `${ACCENT[id].chip} ring-1 ring-white/20` : "border border-white/[0.1] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {PLAN_LABEL[id]}
                </button>
              ))}
            </div>
            {(() => {
              const id = vitrinPlan;
              const e = planCards[id] ?? emptyPlanCard();
              const setPc = (patch: Partial<PlanCardEdit>) => setPlanCards((prev) => ({ ...prev, [id]: { ...emptyPlanCard(), ...prev[id], ...patch } }));
              return (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AdminField label="İsim (TR)">
                      <input className={adminInputClass} value={e.nameTr} onChange={(ev) => setPc({ nameTr: ev.target.value })} />
                    </AdminField>
                    <AdminField label="Name (EN)">
                      <input className={adminInputClass} value={e.nameEn} onChange={(ev) => setPc({ nameEn: ev.target.value })} />
                    </AdminField>
                    <AdminField label="Kısa açıklama (TR)">
                      <input className={adminInputClass} value={e.taglineTr} onChange={(ev) => setPc({ taglineTr: ev.target.value })} />
                    </AdminField>
                    <AdminField label="Tagline (EN)">
                      <input className={adminInputClass} value={e.taglineEn} onChange={(ev) => setPc({ taglineEn: ev.target.value })} />
                    </AdminField>
                    <AdminField label="Özellikler (TR)" description="Her satır bir madde.">
                      <textarea className={`${adminInputClass} min-h-[150px]`} value={e.featuresTr} onChange={(ev) => setPc({ featuresTr: ev.target.value })} />
                    </AdminField>
                    <AdminField label="Features (EN)" description="One per line.">
                      <textarea className={`${adminInputClass} min-h-[150px]`} value={e.featuresEn} onChange={(ev) => setPc({ featuresEn: ev.target.value })} />
                    </AdminField>
                  </div>

                </>
              );
            })()}
          </Panel>

          <SaveBar dirty={vitrinDirty} busy={vitrinBusy} onSave={() => void saveVitrin()} onDiscard={discardVitrin} label="Kart yazılarını kaydet" />
        </div>
      ) : null}
    </div>
  );
}

function LimitField({
  label,
  value,
  onChange,
  suffix,
  hint,
  disabled,
  codeNote,
  extra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  hint?: string;
  disabled?: boolean;
  codeNote?: string | null;
  extra?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-[15px] font-bold tabular-nums text-white outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="shrink-0 text-[11.5px] text-slate-500">{suffix}</span>
      </div>
      {extra}
      {hint ? <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{hint}</p> : null}
      {codeNote ? <p className="mt-1 text-[11.5px] font-semibold text-amber-300/90">{codeNote}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-slate-200">{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <p className="text-[11.5px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[11.5px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function PriceInput({ value, onChange, symbol }: { value: string; onChange: (v: string) => void; symbol: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-1.5 focus-within:border-cyan-400/70">
      <span className="text-base font-black text-slate-400">{symbol}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label={`Fiyat (${symbol})`}
        className="w-full min-w-0 bg-transparent text-lg font-black tabular-nums text-white outline-none"
      />
    </div>
  );
}
