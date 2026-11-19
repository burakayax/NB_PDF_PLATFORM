import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import { saasFetch } from "../../api/saasHttp";
import { BosDurum } from "../analytics/AdminAnalytics";
import { eventToStoryLine, TONE_CLASSES } from "./journeyNarrative";
import {
  CARD,
  DataTable,
  Pill,
  SearchFilter,
  Section,
  SelectFilter,
  Segmented,
  StatCard,
  type Column,
} from "./InsightsTable";
import {
  ABANDON_STEP_LABEL,
  CANCEL_ACTION_LABEL,
  CANCEL_REASON_LABEL,
  PAYER_STATUS_LABEL,
  SOURCE_KINDS,
  STAGE_LABEL,
  STAGE_ORDER,
  filterAudience,
  formatDay,
  formatMoney,
  formatWhen,
  parseExtra,
  planName,
  plainToolName,
  purchaseWhat,
  sourceInfo,
  sourceRows,
  stepRows,
  toolRows,
  visitStage,
  pageRows,
  pageLabel,
  type PageRow,
  type Audience,
  type InsightCancellation,
  type InsightPayer,
  type InsightVisit,
  type InsightsPayload,
  type SourceRow,
  type Stage,
  type ToolRow,
} from "./insightsModel";

/**
 * ZİYARETÇİLER VE SATIŞLAR — siteye gelenlerin nereden geldiğini, ne yaptığını, nerede vazgeçtiğini
 * ve kimlerin neden satın aldığını (ya da iptal ettiğini) tablolar halinde gösterir.
 *
 * Veri: `GET /api/admin/journeys/insights` (bkz. api/.../journey/insights.service.ts). Süzgeçler ve
 * sayılar tarayıcıda hesaplanır; sunucuya yalnız "kaç gün" bilgisi gider.
 */

const DAY_OPTIONS = [
  { value: "7", label: "Son 7 gün" },
  { value: "30", label: "Son 30 gün" },
  { value: "90", label: "Son 90 gün" },
];

function who(v: { isMember: boolean; who: string | null }): string {
  return v.isMember ? (v.who ?? "Üye") : "Misafir";
}

// ─── Adım adım ───────────────────────────────────────────────────────────────

function StepsSection({ visits }: { visits: InsightVisit[] }) {
  const rows = useMemo(() => stepRows(visits), [visits]);
  const total = rows[0]?.count ?? 0;
  const columns: Array<Column<(typeof rows)[number]>> = [
    { header: "Adım", cell: (r) => <span className="font-semibold text-white">{r.label}</span> },
    { header: "Kaç kişi", numeric: true, cell: (r) => r.count.toLocaleString("tr-TR") },
    {
      header: "Ziyaretçilerin yüzde kaçı",
      numeric: true,
      cell: (r) => (total > 0 ? `%${Math.round((r.count / total) * 100)}` : "—"),
    },
    { header: "Ne demek?", cell: (r) => <span className="text-slate-400">{r.hint}</span> },
  ];
  return (
    <Section
      id="adimlar"
      title="Ziyaretçiler nerede kalıyor?"
      help="Siteye gelenlerin her adıma kaç kişisinin ulaştığı. Bir kişi birden çok adıma girmiş olabilir; bu yüzden aşağı doğru her zaman azalmak zorunda değil."
    >
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="Henüz ziyaretçi kaydı yok." pageSize={20} />
    </Section>
  );
}

// ─── Nereden geliyorlar ──────────────────────────────────────────────────────

function SourcesSection({ visits, payers }: { visits: InsightVisit[]; payers: InsightPayer[] }) {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const all = useMemo(() => sourceRows(visits, payers), [visits, payers]);
  const rows = useMemo(
    () =>
      all.filter(
        (r) => (kind === "all" || r.kind === kind) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [all, kind, q],
  );
  const columns: Array<Column<SourceRow>> = [
    { header: "Nereden geldi", cell: (r) => <span className="font-semibold text-white">{r.name}</span> },
    { header: "Türü", cell: (r) => <Pill>{r.kind}</Pill> },
    { header: "Ziyaretçi", numeric: true, cell: (r) => r.visitors.toLocaleString("tr-TR") },
    { header: "Üye oldu", numeric: true, cell: (r) => r.signedUp.toLocaleString("tr-TR") },
    { header: "Fiyat/ödeme ekranına geldi", numeric: true, cell: (r) => r.sawPricing.toLocaleString("tr-TR") },
    {
      header: "Satın aldı",
      numeric: true,
      cell: (r) => (r.bought > 0 ? <span className="font-bold text-emerald-300">{r.bought}</span> : "0"),
    },
  ];
  return (
    <Section
      id="kaynaklar"
      title="Nereden geliyorlar?"
      help="Ziyaretçilerin siteye hangi yerden ulaştığı. Reklam ya da paylaşım bağlantısına isim verdiyseniz o isim de görünür. “Satın aldı” sütunu ödeme kayıtlarından gelir ve ödeme yapanın ilk geldiği yeri sayar."
      filters={
        <>
          <SearchFilter value={q} onChange={setQ} placeholder="Ara: Google, Instagram…" />
          <SelectFilter
            label="Türü"
            value={kind}
            onChange={setKind}
            options={[{ value: "all", label: "Hepsi" }, ...SOURCE_KINDS.map((k) => ({ value: k, label: k }))]}
          />
        </>
      }
    >
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} empty="Bu süzgece uyan bir kaynak yok." />
    </Section>
  );
}

// ─── Hangi araç ──────────────────────────────────────────────────────────────

function ToolsSection({ visits }: { visits: InsightVisit[] }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => toolRows(visits), [visits]);
  const rows = useMemo(() => all.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())), [all, q]);
  const columns: Array<Column<ToolRow>> = [
    { header: "Araç", cell: (r) => <span className="font-semibold text-white">{r.name}</span> },
    { header: "Kullandı (sonuç ekranı geldi)", numeric: true, cell: (r) => r.used },
    { header: "Bitirdi (üye ol ekranı çıktı)", numeric: true, cell: (r) => r.finished },
    { header: "Üye olmaya tıkladı", numeric: true, cell: (r) => r.clicked },
    { header: "Hakkı bitti", numeric: true, cell: (r) => r.wall },
    { header: "Fiyat ekranını bu araçtan açtı", numeric: true, cell: (r) => r.pricing },
  ];
  return (
    <Section
      id="araclar"
      title="Hangi araç ilgi çekiyor?"
      help="Ziyaretçilerin hangi aracı gerçekten kullandığı (sonuç ekranına ulaştığı; cihazda çalışan araçlar dahil), hangi araçta bir işi sonuna kadar götürdüğü, hangi araçta hakkının bittiği ve hangi araçtan fiyat ekranına gittiği. Satış fırsatı en çok “hakkı bitti” ve “fiyat ekranını açtı” sütunlarında çıkar."
      filters={<SearchFilter value={q} onChange={setQ} placeholder="Araç ara…" />}
    >
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} empty="Henüz araç kullanımı kaydı yok." />
    </Section>
  );
}

// ─── Hangi sayfalara bakıldı ─────────────────────────────────────────────────

function PagesSection({ visits }: { visits: InsightVisit[] }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => pageRows(visits), [visits]);
  const rows = useMemo(
    () => all.filter((r) => !q.trim() || `${r.name} ${r.path}`.toLowerCase().includes(q.trim().toLowerCase())),
    [all, q],
  );
  const columns: Array<Column<PageRow>> = [
    { header: "Sayfa", cell: (r) => <span className="font-semibold text-white">{r.name}</span> },
    { header: "Adres", cell: (r) => <span className="text-slate-400">{r.path}</span> },
    { header: "Kaç kişi baktı", numeric: true, cell: (r) => r.visitors },
    { header: "Toplam bakış", numeric: true, cell: (r) => r.views },
  ];
  return (
    <Section
      id="sayfalar"
      title="En çok bakılan sayfalar ve araçlar"
      help="Ziyaretçilerin hangi sayfalara ve araç sayfalarına baktığı. Reklam verirken hangi araca yönleneceğinizi buradan seçebilirsiniz. Üstteki “Kimler” süzgeci (misafir / üye) bu tabloyu da değiştirir. Not: bir kişi için en fazla 30 farklı sayfa tutulur."
      filters={<SearchFilter value={q} onChange={setQ} placeholder="Sayfa ara…" />}
    >
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.path} empty="Henüz sayfa kaydı yok." pageSize={25} />
    </Section>
  );
}

// ─── Satın alanlar ───────────────────────────────────────────────────────────

function PayersSection({ payers, audience }: { payers: InsightPayer[]; audience: Audience }) {
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      payers.filter(
        (p) =>
          (plan === "all" || p.plan === plan) &&
          (status === "all" || p.status === status) &&
          (kind === "all" || p.kind === kind) &&
          (!q.trim() || p.who.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [payers, plan, status, kind, q],
  );
  const columns: Array<Column<InsightPayer>> = [
    { header: "Kim", cell: (p) => <span className="font-semibold text-white">{p.who}</span> },
    { header: "Ne aldı", cell: (p) => purchaseWhat(p) },
    { header: "Tutar", numeric: true, cell: (p) => formatMoney(p.amount, p.currency) },
    { header: "Ödeme günü", cell: (p) => formatDay(p.paidAt) },
    { header: "Nereden geldi", cell: (p) => (p.source ? sourceInfo(p.source).name : "Bilinmiyor") },
    {
      header: "Üye olduktan kaç gün sonra",
      numeric: true,
      cell: (p) => (p.daysToPay === 0 ? "Aynı gün" : `${p.daysToPay} gün`),
    },
    {
      header: "Ödemeyi ne tetikledi",
      cell: (p) =>
        p.triggerTool ? (
          <span>{plainToolName(p.triggerTool)} <span className="text-slate-500">(hakkı bitti / fiyata baktı)</span></span>
        ) : (
          <span className="text-slate-500">Kayıt yok</span>
        ),
    },
    {
      header: "En çok kullandığı araçlar",
      cell: (p) => (p.topTools.length ? p.topTools.map((t) => plainToolName(t)).join(", ") : <span className="text-slate-500">Henüz yok</span>),
    },
    {
      header: "Durum",
      cell: (p) => (
        <div className="space-y-1">
          <Pill tone={p.status === "active" ? "good" : p.status === "refunded" ? "bad" : "warn"}>
            {PAYER_STATUS_LABEL[p.status] ?? p.status}
          </Pill>
          {p.cancelReason ? <p className="text-[11.5px] text-slate-400">{CANCEL_REASON_LABEL[p.cancelReason] ?? p.cancelReason}</p> : null}
        </div>
      ),
    },
  ];
  return (
    <Section
      id="satin-alanlar"
      title="Satın alanlar"
      help="Gerçekten ödeme yapan kişiler (ödeme kayıtlarından). Yönetici hesapları sayılmaz. “Ödemeyi ne tetikledi”, kişinin ödemeden önce hakkının bittiği ya da fiyat ekranını açtığı en son araçtır."
      filters={
        <>
          <SearchFilter value={q} onChange={setQ} placeholder="Ad veya e-posta ara…" />
          <SelectFilter
            label="Ne aldı"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Hepsi" },
              { value: "plan", label: "Üyelik planı" },
              { value: "seats", label: "Ek koltuk" },
              { value: "ai_credit", label: "Yapay zekâ kredisi" },
              { value: "cv_pass", label: "CV Geçişi" },
            ]}
          />
          <SelectFilter
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "all", label: "Hepsi" },
              ...["STARTER", "PLUS", "PRO", "BUSINESS"].map((p) => ({ value: p, label: planName(p) })),
            ]}
          />
          <SelectFilter
            label="Durum"
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "Hepsi" }, ...Object.entries(PAYER_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
          />
        </>
      }
    >
      {audience === "guest" ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-400">Misafirler satın alamaz; satın alanlar yalnızca üyelerdir. Yukarıdan “Hepsi” ya da “Üye” seçin.</p>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(p) => p.checkoutId} empty="Bu dönemde satın alan yok ya da süzgece uyan kayıt yok." />
      )}
    </Section>
  );
}

// ─── Vazgeçenler ─────────────────────────────────────────────────────────────

type AbandonRow = {
  id: string;
  at: string;
  who: string;
  plan: string;
  step: string;
  source: string;
};

function AbandonedSection({ visits }: { visits: InsightVisit[] }) {
  const [step, setStep] = useState("all");
  const [plan, setPlan] = useState("all");
  const all = useMemo<AbandonRow[]>(() => {
    const out: AbandonRow[] = [];
    for (const v of visits) {
      for (const [i, e] of v.events.entries()) {
        if (e.name !== "checkout_abandoned") continue;
        const x = parseExtra(e.extra);
        out.push({
          id: `${v.id}-${i}`,
          at: e.createdAt,
          who: who(v),
          plan: typeof x.plan === "string" ? x.plan : "",
          step: typeof x.step === "string" ? x.step : "",
          source: sourceInfo(v).name,
        });
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [visits]);
  const rows = useMemo(
    () => all.filter((r) => (step === "all" || r.step === step) && (plan === "all" || r.plan === plan)),
    [all, step, plan],
  );
  const columns: Array<Column<AbandonRow>> = [
    { header: "Ne zaman", cell: (r) => formatWhen(r.at) },
    { header: "Kim", cell: (r) => r.who },
    { header: "Hangi plana bakıyordu", cell: (r) => (r.plan ? planName(r.plan) : "—") },
    { header: "Hangi adımda bıraktı", cell: (r) => ABANDON_STEP_LABEL[r.step] ?? "Ödeme adımında" },
    { header: "Nereden geldi", cell: (r) => r.source },
  ];
  return (
    <Section
      id="vazgecenler"
      title="Ödemeden vazgeçenler"
      help="Ödeme adımlarına girip satın almadan çıkanlar. Hangi adımda çok kişi bırakıyorsa orayı sadeleştirmek gerekir."
      filters={
        <>
          <SelectFilter
            label="Adım"
            value={step}
            onChange={setStep}
            options={[{ value: "all", label: "Hepsi" }, ...Object.entries(ABANDON_STEP_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
          />
          <SelectFilter
            label="Plan"
            value={plan}
            onChange={setPlan}
            options={[
              { value: "all", label: "Hepsi" },
              ...["STARTER", "PLUS", "PRO", "BUSINESS"].map((p) => ({ value: p, label: planName(p) })),
            ]}
          />
        </>
      }
    >
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="Bu dönemde ödemeden vazgeçen yok." />
    </Section>
  );
}

// ─── İptaller ────────────────────────────────────────────────────────────────

function CancellationsSection({ items, audience }: { items: InsightCancellation[]; audience: Audience }) {
  const [reason, setReason] = useState("all");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of items) m.set(c.reason, (m.get(c.reason) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const rows = useMemo(() => items.filter((c) => reason === "all" || c.reason === reason), [items, reason]);
  const columns: Array<Column<InsightCancellation>> = [
    { header: "Ne zaman", cell: (c) => formatWhen(c.createdAt) },
    { header: "Kim", cell: (c) => <span className="font-semibold text-white">{c.who}</span> },
    { header: "Planı", cell: (c) => planName(c.plan) },
    { header: "Neden ayrıldı", cell: (c) => CANCEL_REASON_LABEL[c.reason] ?? c.reason },
    { header: "Yazdığı not", cell: (c) => c.note ?? <span className="text-slate-500">—</span> },
    {
      header: "Sonuç",
      cell: (c) => <Pill tone={c.action === "refunded" ? "bad" : "warn"}>{CANCEL_ACTION_LABEL[c.action] ?? c.action}</Pill>,
    },
  ];
  return (
    <Section
      id="iptaller"
      title="Abonelik iptalleri ve nedenleri"
      help="Üyelerini iptal edenlerin seçtiği neden. Neden seçmek isteğe bağlı olduğu için “Neden belirtmedi” görmeniz normal."
      filters={
        <>
          <SelectFilter
            label="Neden"
            value={reason}
            onChange={setReason}
            options={[{ value: "all", label: "Hepsi" }, ...Object.entries(CANCEL_REASON_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
          />
          {counts.map(([r, n]) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(reason === r ? "all" : r)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                reason === r ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/[0.1] text-slate-300 hover:bg-white/[0.05]"
              }`}
            >
              {CANCEL_REASON_LABEL[r] ?? r}: {n}
            </button>
          ))}
        </>
      }
    >
      {audience === "guest" ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-400">Misafirlerin aboneliği olmaz; iptaller yalnızca üyelere aittir.</p>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} empty="Bu dönemde iptal eden yok." />
      )}
    </Section>
  );
}

// ─── Tek tek ziyaretçiler ────────────────────────────────────────────────────

function VisitorsSection({ visits }: { visits: InsightVisit[] }) {
  const [stage, setStage] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      visits.filter((v) => {
        if (stage !== "all" && visitStage(v) !== stage) return false;
        if (kind !== "all" && sourceInfo(v).kind !== kind) return false;
        if (q.trim()) {
          const hay = `${who(v)} ${sourceInfo(v).name} ${v.landingPath ?? ""}`.toLowerCase();
          if (!hay.includes(q.trim().toLowerCase())) return false;
        }
        return true;
      }),
    [visits, stage, kind, q],
  );
  const columns: Array<Column<InsightVisit>> = [
    { header: "Ne zaman", cell: (v) => formatWhen(v.firstSeenAt) },
    { header: "Kim", cell: (v) => <span className={v.isMember ? "font-semibold text-white" : "text-slate-300"}>{who(v)}</span> },
    { header: "Nereden geldi", cell: (v) => sourceInfo(v).name },
    { header: "İlk baktığı sayfa", cell: (v) => <span className="text-slate-400">{v.landingPath ?? "—"}</span> },
    { header: "Baktığı sayfa", numeric: true, cell: (v) => v.pageCount },
    {
      header: "En son ulaştığı yer",
      cell: (v) => {
        const s = visitStage(v);
        const tone = s === "purchased" ? "good" : s === "abandoned" ? "bad" : s === "browsed" ? "neutral" : "info";
        return <Pill tone={tone}>{STAGE_LABEL[s]}</Pill>;
      },
    },
    { header: "", cell: (v) => (v.events.length ? <span className="text-cyan-300">{open === v.id ? "Gizle" : "Ayrıntı"}</span> : null) },
  ];
  return (
    <Section
      id="ziyaretciler"
      title="Tek tek ziyaretçiler"
      help="Her satır bir ziyaret. Bir satıra tıklayınca o kişinin site içinde yaptıklarını sırayla görürsünüz. En yeni en üstte."
      filters={
        <>
          <SearchFilter value={q} onChange={setQ} placeholder="Kim, nereden, sayfa ara…" />
          <SelectFilter
            label="En son ulaştığı yer"
            value={stage}
            onChange={setStage}
            options={[{ value: "all", label: "Hepsi" }, ...STAGE_ORDER.map((s: Stage) => ({ value: s, label: STAGE_LABEL[s] }))]}
          />
          <SelectFilter
            label="Nereden"
            value={kind}
            onChange={setKind}
            options={[{ value: "all", label: "Hepsi" }, ...SOURCE_KINDS.map((k) => ({ value: k, label: k }))]}
          />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(v) => v.id}
        empty="Bu süzgece uyan ziyaretçi yok."
        pageSize={25}
        onRowClick={(v) => setOpen((cur) => (cur === v.id ? null : v.id))}
        expanded={open}
        renderExpanded={(v) => (
          <>
            <div className="mb-3">
              <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">Baktığı sayfalar</p>
              {(v.pages ?? []).length === 0 ? (
                <p className="text-[12.5px] text-slate-500">Sayfa kaydı yok.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {(v.pages ?? []).map((pg) => (
                    <li key={pg.path} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[12px] text-slate-300" title={pg.path}>
                      {pageLabel(pg.path)}
                      {pg.views > 1 ? <span className="ml-1 text-slate-500">×{pg.views}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          {v.events.length === 0 ? (
            <p className="text-[12.5px] text-slate-400">Üye ol, fiyat ya da ödeme ekranıyla ilgili bir olay yok.</p>
          ) : (
            <ol className="space-y-1.5 border-l border-white/[0.08] pl-3.5">
              {v.events.map((ev, i) => {
                const line = eventToStoryLine(ev);
                return (
                  <li key={i} className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] ${TONE_CLASSES[line.tone]}`}>
                    {line.text}
                    <span className="ml-2 text-[10.5px] text-slate-400">{formatWhen(ev.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}
          </>
        )}
      />
    </Section>
  );
}

// ─── Ana ekran ───────────────────────────────────────────────────────────────

export function UserJourneyTab({ accessToken }: { accessToken: string }) {
  const [days, setDays] = useState("30");
  const [audience, setAudience] = useState<Audience>("all");
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasFetch(`/api/admin/journeys/insights?days=${days}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as InsightsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const visits = useMemo(() => (data ? filterAudience(data.visits, audience) : []), [data, audience]);

  if (loading && !data && !error) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${CARD} mx-6 my-6 p-6 text-center`}>
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm text-cyan-300 underline">
          Yeniden dene
        </button>
      </div>
    );
  }

  const memberView = audience !== "guest";
  const abandoned = visits.filter((v) => v.events.some((e) => e.name === "checkout_abandoned")).length;
  const periodLabel = DAY_OPTIONS.find((o) => o.value === days)?.label ?? `Son ${days} gün`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Ziyaretçiler ve Satışlar</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-300">
            Siteye kimlerin geldiği, nereden geldiği, nerede vazgeçtiği ve kimlerin satın aldığı. Aşağıdaki her bölümün kendi
            süzgeçleri var. <strong className="text-slate-100">Misafir</strong> giriş yapmamış ziyaretçi,{" "}
            <strong className="text-slate-100">Üye</strong> o ziyarette giriş yapmış ya da üye olmuş kişidir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectFilter label="Dönem" value={days} onChange={setDays} options={DAY_OPTIONS} />
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.05]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={audience}
          onChange={setAudience}
          options={[
            { value: "all", label: "Hepsi" },
            { value: "guest", label: "Misafir" },
            { value: "member", label: "Üye" },
          ]}
        />
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-400">
          {[
            ["adimlar", "Adım adım"],
            ["kaynaklar", "Nereden geliyorlar"],
            ["araclar", "Hangi araç"],
            ["satin-alanlar", "Satın alanlar"],
            ["vazgecenler", "Vazgeçenler"],
            ["iptaller", "İptaller"],
            ["ziyaretciler", "Tek tek ziyaretçiler"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-cyan-300">
              {label}
            </a>
          ))}
        </nav>
      </div>

      {data?.truncated ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-2.5 text-[12.5px] text-amber-200">
          Bu dönemde çok fazla kayıt var; hız için yalnızca en yeni ziyaretler gösteriliyor. Daha kısa bir dönem seçerseniz hepsi görünür.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Ziyaretçi" value={visits.length.toLocaleString("tr-TR")} hint={`${periodLabel}: siteye gelen kişi (aynı kişi aynı tarayıcıdan bir kez sayılır).`} />
        <StatCard
          label="Yeni üye"
          value={memberView ? (data?.totals.newUsers ?? 0).toLocaleString("tr-TR") : "—"}
          hint={memberView ? "Bu dönemde hesap açanlar (veritabanından, kesin sayı)." : "Misafir seçiliyken üye sayısı gösterilmez."}
          tone="good"
        />
        <StatCard
          label="Satın alan"
          value={memberView ? (data?.totals.paidCustomers ?? 0).toLocaleString("tr-TR") : "—"}
          hint={memberView ? "Ödeme yapıp parası iade edilmeyen kişi sayısı." : "Misafirler satın alamaz."}
          tone="good"
        />
        <StatCard label="Ödemeden vazgeçen" value={abandoned.toLocaleString("tr-TR")} hint="Ödeme adımlarına girip satın almadan çıkan ziyaret sayısı." tone={abandoned > 0 ? "bad" : "neutral"} />
        <StatCard label="İade edilen" value={memberView ? (data?.totals.refunded ?? 0).toLocaleString("tr-TR") : "—"} hint={memberView ? "Bu dönemde parası iade edilen ödeme sayısı." : "Misafirde iade olmaz."} tone={memberView && (data?.totals.refunded ?? 0) > 0 ? "bad" : "neutral"} />
      </div>

      {data && data.visits.length === 0 && data.payers.length === 0 ? (
        <BosDurum metin="Bu dönemde kayıtlı ziyaret yok. Ziyaretçiler çerez/ölçüm iznini verdikçe burada birikir." />
      ) : null}

      <StepsSection visits={visits} />
      <SourcesSection visits={visits} payers={data?.payers ?? []} />
      <ToolsSection visits={visits} />
      <PagesSection visits={visits} />
      <PayersSection payers={data?.payers ?? []} audience={audience} />
      <AbandonedSection visits={visits} />
      <CancellationsSection items={data?.cancellations ?? []} audience={audience} />
      <VisitorsSection visits={visits} />
    </div>
  );
}
