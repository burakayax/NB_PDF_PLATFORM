import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, RefreshCw, Search } from "lucide-react";
import {
  fetchAdminPlans,
  putAdminPackagesMarketing,
  putAdminPlanPricing,
  putAdminPlansOverride,
} from "../../api/admin";
import { PLANS, STARTER_TOOL_IDS } from "../../lib/planConfig";
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

type Payload = {
  plans: Array<{ name: string; displayName: string; description: string; dailyLimit: number | null; allowedFeatures: string[]; multiUser: boolean }>;
  checkoutStats: Record<string, { completed: number; pending: number }>;
  marketing: unknown;
  plansOverride: unknown;
  paymentPrices?: { PRO: string; BUSINESS: string; PRO_ANNUAL: string };
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

type PlanForm = {
  displayName: string;
  description: string;
  dailyUnlimited: boolean;
  dailyLimit: number;
  features: string[];
  multiUser: boolean;
};

type PlanCardEdit = { nameTr: string; nameEn: string; taglineTr: string; taglineEn: string; featuresTr: string; featuresEn: string };
const EDITABLE_PLAN_CARDS = ["STARTER", "PLUS", "PRO", "BUSINESS"] as const;
const emptyPlanCard = (): PlanCardEdit => ({ nameTr: "", nameEn: "", taglineTr: "", taglineEn: "", featuresTr: "", featuresEn: "" });
const DEFAULT_TAGLINES: Record<string, { tr: string; en: string }> = {
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
  const [tab, setTab] = useState<"prices" | "access" | "vitrin">("prices");

  // Fiyatlar
  const [proPrice, setProPrice] = useState("");
  const [proAnnual, setProAnnual] = useState("");
  const [businessPrice, setBusinessPrice] = useState("");
  const savedPrices = useRef({ PRO: "", PRO_ANNUAL: "", BUSINESS: "" });
  const [pricesBusy, setPricesBusy] = useState(false);
  const [confirmPrices, setConfirmPrices] = useState(false);

  // Erişim
  const [planForms, setPlanForms] = useState<Record<PlanKey, PlanForm> | null>(null);
  const savedForms = useRef<string>("");
  const [formPlan, setFormPlan] = useState<PlanKey>("FREE");
  const [accessBusy, setAccessBusy] = useState(false);
  const [toolQuery, setToolQuery] = useState("");

  // Vitrin
  const [planCards, setPlanCards] = useState<Record<string, PlanCardEdit>>({});
  const [cardStarterTools, setCardStarterTools] = useState<string[]>([...STARTER_TOOL_IDS]);
  const savedVitrin = useRef<string>("");
  const [vitrinPlan, setVitrinPlan] = useState<(typeof EDITABLE_PLAN_CARDS)[number]>("STARTER");
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

        const pp = d.paymentPrices;
        const cat = d.catalogue?.prices;
        const pro = pp?.PRO ?? cat?.PRO.tryGrossMonthly ?? "";
        const proA = pp?.PRO_ANNUAL ?? cat?.PRO.tryGrossYearly ?? "";
        const biz = pp?.BUSINESS ?? cat?.BUSINESS.tryGrossMonthly ?? "";
        setProPrice(pro);
        setProAnnual(proA);
        setBusinessPrice(biz);
        savedPrices.current = { PRO: pro, PRO_ANNUAL: proA, BUSINESS: biz };

        // Vitrin
        const m = d.marketing;
        const mObj = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
        const cardsObj = mObj.cards && typeof mObj.cards === "object" && !Array.isArray(mObj.cards) ? (mObj.cards as Record<string, unknown>) : null;
        const savedStarter = cardsObj?.starterTools;
        const starter = Array.isArray(savedStarter) && savedStarter.length ? savedStarter.filter((x): x is string => typeof x === "string") : [...STARTER_TOOL_IDS];
        setCardStarterTools(starter);
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
        savedVitrin.current = JSON.stringify({ nextPc, starter });
        marketingExtraRef.current = { ...mObj };

        // Erişim formları — 5 planın tamamı
        const ov = d.plansOverride;
        const ovRec = ov && typeof ov === "object" && !Array.isArray(ov) ? (ov as Record<string, unknown>) : {};
        const next = {} as Record<PlanKey, PlanForm>;
        for (const name of PLAN_KEYS) {
          const p = d.plans?.find((x) => x.name === name);
          const o = ovRec[name] as Record<string, unknown> | undefined;
          const rawDl = o && "dailyLimit" in o ? o.dailyLimit : (p?.dailyLimit ?? null);
          next[name] = {
            displayName: String(o?.displayName ?? p?.displayName ?? name),
            description: String(o?.description ?? p?.description ?? ""),
            dailyUnlimited: rawDl === null,
            dailyLimit: typeof rawDl === "number" ? rawDl : typeof p?.dailyLimit === "number" ? p.dailyLimit : 5,
            features: Array.isArray(o?.allowedFeatures) ? [...(o.allowedFeatures as string[])] : [...(p?.allowedFeatures ?? [])],
            multiUser: Boolean(o?.multiUser ?? p?.multiUser),
          };
        }
        setPlanForms(next);
        savedForms.current = JSON.stringify(next);
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
  const pricesDirty =
    proPrice.trim() !== savedPrices.current.PRO ||
    proAnnual.trim() !== savedPrices.current.PRO_ANNUAL ||
    businessPrice.trim() !== savedPrices.current.BUSINESS;
  const accessDirty = planForms ? JSON.stringify(planForms) !== savedForms.current : false;
  const vitrinDirty = JSON.stringify({ nextPc: planCards, starter: cardStarterTools }) !== savedVitrin.current;

  /* Sapma: panelde kayıtlı fiyat ≠ koddaki fiyat */
  const drift = useMemo(() => {
    if (!cat) return [] as Array<{ label: string; saved: string; code: string }>;
    const rows: Array<{ label: string; saved: string; code: string }> = [];
    const chk = (label: string, saved: string, code: string) => {
      if (saved && Math.abs(num(saved) - num(code)) > 0.004) rows.push({ label, saved: fmtTry(num(saved)), code: fmtTry(num(code)) });
    };
    chk("Pro aylık", savedPrices.current.PRO, cat.prices.PRO.tryGrossMonthly);
    chk("Pro yıllık", savedPrices.current.PRO_ANNUAL, cat.prices.PRO.tryGrossYearly);
    chk("Business aylık", savedPrices.current.BUSINESS, cat.prices.BUSINESS.tryGrossMonthly);
    return rows;
    // savedPrices bir ref; yükleme sonrası payload değişince yeniden hesaplanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, payload]);

  /* ───────── Kaydetme işlemleri ───────── */

  const savePrices = async () => {
    const vals = { PRO: num(proPrice), PRO_ANNUAL: num(proAnnual), BUSINESS: num(businessPrice) };
    if (vals.PRO <= 0 || vals.PRO_ANNUAL <= 0 || vals.BUSINESS <= 0) {
      emitAdminToast({ type: "error", message: "Fiyatlar sıfırdan büyük bir sayı olmalı (örn. 449.00)." });
      setConfirmPrices(false);
      return;
    }
    setPricesBusy(true);
    try {
      await putAdminPlanPricing(accessToken, { PRO: proPrice.trim(), BUSINESS: businessPrice.trim(), PRO_ANNUAL: proAnnual.trim() });
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
    setProPrice(savedPrices.current.PRO);
    setProAnnual(savedPrices.current.PRO_ANNUAL);
    setBusinessPrice(savedPrices.current.BUSINESS);
  };

  const loadCodePrices = () => {
    if (!cat) return;
    setProPrice(cat.prices.PRO.tryGrossMonthly);
    setProAnnual(cat.prices.PRO.tryGrossYearly);
    setBusinessPrice(cat.prices.BUSINESS.tryGrossMonthly);
  };

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
        const entry: Record<string, unknown> = {
          displayName: pf.displayName,
          description: pf.description,
          allowedFeatures: pf.features,
          multiUser: pf.multiUser,
        };
        if (name === "FREE") entry.dailyLimit = pf.dailyUnlimited ? null : pf.dailyLimit;
        else if (prev && "dailyLimit" in prev) entry.dailyLimit = prev.dailyLimit;
        existing[name] = entry;
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
      const merged = { ...marketingExtraRef.current, cards: { ...prevCards, starterTools: cardStarterTools, planCards: pcOut } };
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

  const patchForm = (plan: PlanKey, patch: Partial<PlanForm>) =>
    setPlanForms((prev) => (prev ? { ...prev, [plan]: { ...prev[plan], ...patch } } : prev));

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
  if (!payload || !planForms || !cat) {
    return <p className="px-2 py-10 text-center text-sm text-slate-400">Paket ve fiyat bilgileri yükleniyor…</p>;
  }

  const proM = num(proPrice);
  const proA = num(proAnnual);
  const bizM = num(businessPrice);
  const bizA = yearlyFromMonthly(bizM);

  /** Plan kartında gösterilen güncel (panelde yazan) TL tutarlar. */
  const tryOf = (k: PaidKey): { m: number; y: number | null; editable: boolean } => {
    const yearly = cat.yearlyPlans.includes(k);
    if (k === "PRO") return { m: proM, y: proA, editable: true };
    if (k === "BUSINESS") return { m: bizM, y: bizA, editable: true };
    return { m: num(cat.prices[k].tryGrossMonthly), y: yearly ? num(cat.prices[k].tryGrossYearly) : null, editable: false };
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Satış ayarları</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Paket ve fiyat</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">
            Müşterinin ne ödediğini, hangi pakette hangi araçların açık olduğunu ve ana sayfadaki fiyat kartlarında ne yazdığını buradan yönetirsiniz.
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
          { id: "prices", label: "Fiyatlar", badge: pricesDirty ? "!" : drift.length ? String(drift.length) : null },
          { id: "access", label: "Erişim ve limitler", badge: accessDirty ? "!" : null },
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
                  <p className="font-bold text-amber-200">Panelde kayıtlı fiyat, koddaki güncel fiyattan farklı.</p>
                  <p className="mt-1">
                    Müşteri <strong>panelde yazanı</strong> öder. Bu eski bir kayıt olabilir:{" "}
                    {drift.map((d, i) => (
                      <span key={d.label}>
                        {i > 0 ? " · " : ""}
                        {d.label}: panelde <strong>{d.saved}</strong>, kodda <strong>{d.code}</strong>
                      </span>
                    ))}
                    .
                  </p>
                </div>
              </div>
              <GhostButton onClick={loadCodePrices}>Kod fiyatlarını yükle</GhostButton>
            </div>
          ) : null}

          {/* Plan kartları */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {PLAN_KEYS.map((k) => {
              const a = ACCENT[k];
              const st = payload.checkoutStats?.[k] ?? { completed: 0, pending: 0 };
              const lim = cat.limits[k];
              const isPaid = k !== "FREE";
              const t = isPaid ? tryOf(k as PaidKey) : null;
              const net = t ? t.m / (1 + vat) : 0;
              const disc = t && t.y != null && t.m > 0 ? Math.round((1 - t.y / (t.m * 12)) * 100) : 0;
              return (
                <div key={k} className={`${SURFACE} ${a.ring} flex flex-col p-4`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${a.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
                      {PLAN_LABEL[k]}
                    </span>
                    {isPaid ? (
                      <span className="text-[10.5px] font-semibold text-slate-500">{t?.editable ? "Panelden değişir" : "Kodda tanımlı"}</span>
                    ) : null}
                  </div>

                  {isPaid && t ? (
                    <>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Aylık (KDV dahil)</p>
                      {k === "PRO" ? (
                        <PriceInput value={proPrice} onChange={setProPrice} />
                      ) : k === "BUSINESS" ? (
                        <PriceInput value={businessPrice} onChange={setBusinessPrice} />
                      ) : (
                        <p className="mt-1 text-[26px] font-black leading-none tabular-nums text-white">{fmtTry(t.m)}</p>
                      )}

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Yıllık (KDV dahil)</p>
                      {t.y == null ? (
                        <p className="mt-1 text-[13px] text-slate-500">Satılmıyor (yalnız aylık)</p>
                      ) : k === "PRO" ? (
                        <>
                          <PriceInput value={proAnnual} onChange={setProAnnual} />
                          <button
                            type="button"
                            onClick={() => setProAnnual(yearlyFromMonthly(proM).toFixed(2))}
                            className="mt-1.5 text-left text-[11.5px] font-semibold text-cyan-300 hover:underline"
                          >
                            Aylık × 10 uygula ({fmtTry(yearlyFromMonthly(proM))})
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-[22px] font-black leading-none tabular-nums text-white">{fmtTry(t.y)}</p>
                          {k === "BUSINESS" ? <p className="mt-1 text-[11.5px] text-slate-500">Otomatik: aylık × 10</p> : null}
                        </>
                      )}

                      <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-[12px]">
                        <Row label="Yıllık indirim" value={t.y != null ? `%${disc}` : "—"} />
                        <Row label="Ayda yaklaşık (yıllık)" value={t.y != null ? fmtTry(Math.round(t.y / 12)) : "—"} />
                        <Row label="KDV hariç aylık" value={fmtTry(Math.round(net * 100) / 100)} />
                        <Row label="Dolar (aylık / yıllık)" value={`${fmtUsd(cat.prices[k as PaidKey].usdMonthly)} / ${t.y != null ? fmtUsd(cat.prices[k as PaidKey].usdYearly) : "—"}`} />
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
                    <Row label="Yapay zekâ hakkı" value={`${cat.aiMonthlyCredits[k]} / ay`} />
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
            help="Business planı bir ekip havuzudur: tüm üyeler aynı aylık sayaçtan düşer. Aşağıdaki değerler kodda tanımlıdır; değişiklik gerekirse birlikte güncellenmesi gerekir (ekranlar, e-postalar, ödeme)."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Dahil koltuk" value={`${cat.team.includedSeats} kişi`} sub={`En çok ${cat.team.maxTotalSeats} kişi`} />
              <Stat label="Ek koltuk fiyatı" value={`${fmtTry(num(cat.extraSeat.tryGrossMonthly))} / ay`} sub={`${fmtUsd(cat.extraSeat.usdMonthly)} / ay`} />
              <Stat label="Havuz: sunucu işlemi" value={`${fmtNum(cat.limits.BUSINESS.monthlyOperationLimit)} / ay`} sub={`Ek koltuk başına +${fmtNum(cat.team.extraSeatMonthlyOps)}`} />
              <Stat label="Havuz: imza isteği" value={`${fmtNum(cat.team.signatureRequestsBase)} / ay`} sub={`Ek koltuk başına +${cat.team.extraSeatSignatureRequests}`} />
            </div>
          </Panel>

          <p className="text-[12px] leading-relaxed text-slate-500">
            Başlangıç ve Plus fiyatları ile tüm dolar fiyatları kodda sabittir (ekranda güvenle görünsün, kimse yanlışlıkla değiştirmesin diye). Pro ve Business TL fiyatları bu ekrandan
            değişir. Yıllık Business fiyatı her zaman aylığın 10 katıdır.
          </p>

          <SaveBar dirty={pricesDirty} busy={pricesBusy} onSave={() => setConfirmPrices(true)} onDiscard={discardPrices} label="Fiyatları kaydet" />

          <ConfirmModal
            open={confirmPrices}
            title="Fiyatlar canlıya geçsin mi?"
            message={`Pro aylık ${fmtTry(proM)}, Pro yıllık ${fmtTry(proA)}, Business aylık ${fmtTry(bizM)} (yıllık ${fmtTry(bizA)}). Kaydettiğiniz anda ödeme ekranı ve fiyat kartları bu tutarları kullanır.`}
            confirmLabel="Evet, kaydet"
            busy={pricesBusy}
            onConfirm={savePrices}
            onClose={() => setConfirmPrices(false)}
          />
        </div>
      ) : null}

      {/* ═════════════ ERİŞİM VE LİMİTLER ═════════════ */}
      {tab === "access" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] px-4 py-3 text-[13px] leading-relaxed text-cyan-100/85">
            <strong className="text-cyan-200">Bu bölüm gerçek erişimi belirler.</strong> Kaydettiğinizde kullanıcılar hangi aracı kullanabildiğini hemen bu kurala göre görür.
            Ana sayfadaki kart yazıları ayrıdır ve bir sonraki sekmeden elle güncellenir.
          </div>

          <Panel title="Paket bilgileri" help="Bir paket seçin; adını, açıklamasını ve ücretsiz plandaki günlük işlem sınırını düzenleyin.">
            <div className="mb-4 flex flex-wrap gap-2">
              {PLAN_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFormPlan(k)}
                  className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${
                    formPlan === k ? `${ACCENT[k].chip} ring-1 ring-white/20` : "border border-white/[0.1] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {PLAN_LABEL[k]}
                </button>
              ))}
            </div>
            {(() => {
              const f = planForms[formPlan];
              return (
                <div className="grid gap-5 sm:grid-cols-2">
                  <AdminField label="Paket adı (ekranda)" description="Kullanıcının hesabında gördüğü kısa ad.">
                    <input className={adminInputClass} value={f.displayName} onChange={(e) => patchForm(formPlan, { displayName: e.target.value })} />
                  </AdminField>
                  <AdminField label="Ekip yapısı" description="Yalnızca çok kişili paketlerde (Business) açık olmalı.">
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={f.multiUser}
                        onChange={(e) => patchForm(formPlan, { multiUser: e.target.checked })}
                        className="h-4 w-4 rounded border-white/25 bg-black/50"
                      />
                      Bu pakette birden çok kullanıcı olabilir
                    </label>
                  </AdminField>
                  <AdminField label="Açıklama" description="Plan seçim ekranında görünen kısa metin.">
                    <textarea rows={3} className={adminInputClass} value={f.description} onChange={(e) => patchForm(formPlan, { description: e.target.value })} />
                  </AdminField>
                  <AdminField
                    label="Günlük işlem sınırı"
                    description={formPlan === "FREE" ? "Ücretsiz üyenin günde kaç sunucu işlemi yapabileceği." : "Ücretli paketlerin günlük/aylık sınırı kodda tanımlıdır; burada değişmez."}
                  >
                    {formPlan === "FREE" ? (
                      <>
                        <label className="mb-3 flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={f.dailyUnlimited}
                            onChange={(e) => patchForm(formPlan, { dailyUnlimited: e.target.checked })}
                            className="h-4 w-4 rounded border-white/25 bg-black/50"
                          />
                          Günlük sınır yok
                        </label>
                        {!f.dailyUnlimited ? (
                          <input
                            type="number"
                            min={1}
                            className={adminInputClass}
                            value={f.dailyLimit}
                            onChange={(e) => patchForm(formPlan, { dailyLimit: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-slate-300">
                        {cat.limits[formPlan].dailyOperationLimit == null ? "Günlük sınır yok" : `${cat.limits[formPlan].dailyOperationLimit} işlem / gün`} ·{" "}
                        {cat.limits[formPlan].monthlyOperationLimit >= 999999 ? "aylık sınırsız" : `${fmtNum(cat.limits[formPlan].monthlyOperationLimit)} işlem / ay`}
                      </p>
                    )}
                  </AdminField>
                </div>
              );
            })()}
          </Panel>

          <Panel
            title="Hangi araç hangi pakette açık?"
            help="Satırlar araç, sütunlar paket. İşaretli kutu, o pakette aracın açık olduğu anlamına gelir. Kapalı araç uygulamada kilitli görünür."
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
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="border-b border-white/[0.08] bg-black/30">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-slate-400">Araç</th>
                    {PLAN_KEYS.map((k) => {
                      const on = planForms[k].features.filter((f) => featureKeys.includes(f)).length;
                      return (
                        <th key={k} className="px-2 py-2 text-center">
                          <span className={`block text-[11px] font-black uppercase tracking-wide ${ACCENT[k].text}`}>{PLAN_LABEL[k]}</span>
                          <span className="block text-[11px] font-medium text-slate-500">
                            {on}/{featureKeys.length}
                          </span>
                          <span className="mt-1 flex justify-center gap-1.5">
                            <button type="button" onClick={() => setAllFeatures(k, featureKeys, true)} className="text-[10.5px] font-semibold text-cyan-300 hover:underline">
                              hepsi
                            </button>
                            <span className="text-slate-600">·</span>
                            <button type="button" onClick={() => setAllFeatures(k, featureKeys, false)} className="text-[10.5px] font-semibold text-slate-400 hover:underline">
                              hiçbiri
                            </button>
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groupByCategory(featureKeys.filter((fk) => !toolQuery.trim() || pdfToolLabelTr(fk).toLocaleLowerCase("tr").includes(toolQuery.trim().toLocaleLowerCase("tr")))).map((g) => (
                    <Fragment key={g.cat}>
                      <tr className="bg-white/[0.03]">
                        <td colSpan={PLAN_KEYS.length + 1} className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-cyan-300/80">
                          {g.label}
                        </td>
                      </tr>
                      {g.keys.map((fk) => (
                        <tr key={fk} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                          <td className="px-3 py-2 text-slate-200">{pdfToolLabelTr(fk)}</td>
                          {PLAN_KEYS.map((k) => (
                            <td key={k} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={planForms[k].features.includes(fk)}
                                onChange={() => toggleFeature(k, fk)}
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
            değiştirmez. Bir aracı “Erişim ve limitler”den kapatırsanız kart yazısını burada elle güncellemeniz gerekir.
          </div>

          <Panel title="Fiyat kartı yazıları (Türkçe + İngilizce)" help="Boş bırakılan alan sitedeki güncel varsayılan metni kullanır.">
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

                  {id === "STARTER" ? (
                    <div className="mt-6 border-t border-white/[0.06] pt-5">
                      <p className="text-sm font-bold text-slate-200">Başlangıç kartında listelenen araçlar</p>
                      <p className="mt-1 text-[12px] text-slate-500">Yalnızca karttaki liste değişir; gerçek erişim “Erişim ve limitler”den yönetilir.</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">Seçili: {cardStarterTools.length} araç</span>
                        <GhostButton onClick={() => setCardStarterTools([...STARTER_TOOL_IDS])}>Varsayılana dön</GhostButton>
                        <GhostButton onClick={() => setCardStarterTools([...featureKeys])}>Tümünü seç</GhostButton>
                        <GhostButton onClick={() => setCardStarterTools([])}>Temizle</GhostButton>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {featureKeys.map((fk) => (
                          <label key={`card-${fk}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-slate-200">
                            <input
                              type="checkbox"
                              checked={cardStarterTools.includes(fk)}
                              onChange={() =>
                                setCardStarterTools((prev) => {
                                  const set = new Set(prev);
                                  if (set.has(fk)) set.delete(fk);
                                  else set.add(fk);
                                  return [...set];
                                })
                              }
                              className="h-3.5 w-3.5 rounded border-white/25 accent-cyan-500"
                            />
                            {pdfToolLabelTr(fk)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
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

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-black/30 px-3 py-1.5 focus-within:border-cyan-400/70">
      <span className="text-lg font-black text-slate-400">₺</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label="Fiyat"
        className="w-full min-w-0 bg-transparent text-xl font-black tabular-nums text-white outline-none"
      />
    </div>
  );
}
