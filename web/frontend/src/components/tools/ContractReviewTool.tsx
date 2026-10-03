import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  HelpCircle,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ocrPdfToText } from "../../lib/ocr";
import { fetchAiQuota, type AiError, type AiQuota } from "../../api/ai";
import {
  deleteContractReview,
  estimateContractCredits,
  estimateQuickScanCredits,
  getContractReview,
  prescanContract,
  reportDownload,
  startContractReview,
  type ContractJobView,
  type ContractMode,
  type ContractProof,
  type PrescanView,
  type ContractReport,
  type ContractRole,
  type Finding,
  type Severity,
} from "../../api/contractReview";
import {
  annotateContractPdf,
  CONTRACT_MAX_CHARS,
  contractReportToMarkdown,
  embedProofInPdf,
  extractPdfTextPaged,
  proofFooter,
} from "../../lib/contractPdf";
import { contractReportToPdf } from "../../lib/contractReportPdf";
import { contractDownloadNames } from "../../lib/contractFileNames";
import { findingCodes, FINDING_CODE_LEGEND } from "../../lib/findingCode";
import { ToolRating } from "../common/ToolRating";
import { CONTRACT_CONSENT_VERSION } from "../../lib/aiCredits";
import { AiCreditBadge, creditBalance, monthlyLeft } from "./AiCreditBadge";
import { TopUpModal } from "./TopUpModal";

type Props = {
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  comingSoon?: boolean;
};

const ROLES_PRIVATE: Array<{ id: ContractRole; label: string }> = [
  { id: "alici", label: "Alıcıyım (mal alıyorum)" },
  { id: "satici", label: "Satıcı / tedarikçiyim" },
  { id: "hizmet_alan", label: "Hizmet alanım" },
  { id: "hizmet_veren", label: "Hizmet veren / yüklenicim" },
  { id: "kiraci", label: "Kiracıyım" },
  { id: "kiraya_veren", label: "Kiraya verenim" },
  { id: "isveren", label: "İşverenim" },
  { id: "isci", label: "İşçi / çalışanım" },
  { id: "diger", label: "Diğer (aşağıda yazacağım)" },
];
const ROLES_PUBLIC: Array<{ id: ContractRole; label: string }> = [
  { id: "istekli", label: "İsteklim / yükleniciyim (teklif veren)" },
  { id: "idare", label: "İdareyim (ihaleyi açan kurum)" },
  { id: "diger", label: "Diğer (aşağıda yazacağım)" },
];

const SEV: Record<Severity, { label: string; chip: string; ring: string; bg: string; dot: string }> = {
  kritik: { label: "Kritik", chip: "bg-red-500/20 text-red-200 border-red-400/40", ring: "border-red-400/30", bg: "bg-red-500/[0.06]", dot: "bg-red-500" },
  yuksek: { label: "Yüksek", chip: "bg-orange-500/20 text-orange-200 border-orange-400/40", ring: "border-orange-400/30", bg: "bg-orange-500/[0.06]", dot: "bg-orange-500" },
  orta: { label: "Orta", chip: "bg-amber-500/20 text-amber-200 border-amber-400/40", ring: "border-amber-400/25", bg: "bg-amber-500/[0.05]", dot: "bg-amber-400" },
  dusuk: { label: "Düşük", chip: "bg-sky-500/20 text-sky-200 border-sky-400/40", ring: "border-sky-400/25", bg: "bg-sky-500/[0.05]", dot: "bg-sky-400" },
};

const LEGAL_CHIP: Record<string, { label: string; cls: string }> = {
  mevzuata_aykiri: { label: "Mevzuata aykırı olabilir", cls: "border-red-400/40 bg-red-500/15 text-red-200" },
  dayanak_var: { label: "Mevzuatta dayanağı var", cls: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" },
  dogrulanamadi: { label: "Mevzuat doğrulanamadı", cls: "border-white/15 bg-white/[0.04] text-slate-300" },
};

const FULL_LABELS = [
  "Belge okunuyor, maddeler haritalanıyor",
  "Derin analiz: çelişkiler, rakamlar, eksik maddeler",
  "Güncel mevzuat resmî kaynaklardan kontrol ediliyor",
  "Bulgular denetleniyor, alıntılar doğrulanıyor",
];
const QUICK_LABELS = ["Belge taranıyor, en önemli riskler aranıyor", "Alıntılar belge metninde doğrulanıyor"];

/** Dosya baytlarının SHA-256 özeti (indirme bildirimi: hangi dosyanın indirildiğini kanıtlar). */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function download(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * SÖZLEŞME DENETÇİSİ — belgeyi çok adımlı okuyan, çelişki/hesap/eksik madde yakalayan,
 * güncel mevzuatı resmî kaynaklardan kontrol eden ve riskli yerleri belge üzerinde boyayan asistan.
 * Metin CİHAZDA çıkarılır; PDF dosyası cihazda kalır. Sunucuda saklanmaz.
 */
export function ContractReviewTool({ language, accessToken, onLogin, onUpgrade, comingSoon: comingSoonProp }: Props) {
  const tr = language === "tr";
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  const [quota, setQuota] = useState<AiQuota | null>(null);
  // Araç henüz satışa açılmadı: sunucu kapalıysa (admin hariç) "Çok Yakında" gösterilir.
  const comingSoon = comingSoonProp || quota?.contractReviewOpen === false;
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [reading, setReading] = useState<string | null>(null);
  const [scan, setScan] = useState<PrescanView | null>(null);
  const [scanning, setScanning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [sector, setSector] = useState<"ozel" | "kamu">("ozel");
  // Taraf SESSİZCE varsayılmaz: kullanıcı açıkça seçmeden analiz başlamaz.
  const [role, setRole] = useState<ContractRole | "">("");
  const [sectorAuto, setSectorAuto] = useState(false);
  const [valueFromDoc, setValueFromDoc] = useState(false);
  // Onay penceresi: kullanıcı bedeli/koşulları açıkça onaylamadan hiçbir işlem başlamaz.
  const [consentFor, setConsentFor] = useState<ContractMode | null>(null);
  const [priceFix, setPriceFix] = useState<Partial<Record<ContractMode, number>>>({});
  const [proof, setProof] = useState<ContractProof | null>(null);
  const [roleNote, setRoleNote] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [playbook, setPlaybook] = useState("");
  const [concerns, setConcerns] = useState("");

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ContractJobView | null>(null);
  const [report, setReport] = useState<ContractReport | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busyExport, setBusyExport] = useState<null | "annotated" | "report">(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

const credits = useMemo(() => (scan?.units ?? (text ? estimateContractCredits(text.length) : 0)), [scan, text]);
  const quickCredits = useMemo(() => (scan?.quickUnits ?? (text ? estimateQuickScanCredits(text.length) : 0)), [scan, text]);
  const running = job?.status === "running";
  /** Detaylı denetim (ağır araç) yalnız satın alınan krediyle çalışır (yönetici muaf). */
  const insufficientCredits = !!quota && !quota.unlimited && creditBalance(quota) < credits;
  /** Hızlı tarama basit araçlar gibi önce aylık haktan, bitince krediden düşer (yönetici muaf). */
  const insufficientQuick = !!quota && !quota.unlimited && monthlyLeft(quota) + creditBalance(quota) < quickCredits;
  const activeMode: ContractMode = job?.mode ?? report?.meta.mode ?? "full";
  /** Onaylanacak bedel: sunucu farklı bir bedel bildirdiyse o, yoksa ekrandaki tahmin. */
  const unitsFor = (m: ContractMode) => priceFix[m] ?? (m === "quick" ? quickCredits : credits);

  function askConsent(m: ContractMode) {
    if (!role) { setError("Önce hangi tarafta olduğunuzu seçin: riskler sizin açınızdan değerlendirilir."); return; }
    setError(null);
    setConsentFor(m);
  }

  // Sonuç yalnızca bu sayfada durur: analiz sürerken ya da rapor indirilmemişken sekme kapanırsa uyar.
  useEffect(() => {
    if (!running && !report) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running, report]);

  useEffect(() => {
    if (comingSoon) return;
    void fetchAiQuota(accessToken).then((q) => q && setQuota(q));
  }, [accessToken, comingSoon]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const roles = sector === "kamu" ? ROLES_PUBLIC : ROLES_PRIVATE;
  function chooseSector(k: "ozel" | "kamu") {
    setSector(k);
    setSectorAuto(false);
    const next = k === "kamu" ? ROLES_PUBLIC : ROLES_PRIVATE;
    if (!next.some((r) => r.id === role)) setRole("");
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setReport(null);
    setJob(null);
    setJobId(null);
    setExportNote(null);
    setScan(null);
    setAnswers({});
    setRole("");
    setSectorAuto(false);
    setValueFromDoc(false);
    if (f.type !== "application/pdf") { setError("Lütfen bir PDF seçin."); return; }
    setFile(f);
    setText("");
    setReading("Belge okunuyor…");
    try {
      const r = await extractPdfTextPaged(f);
      let t = r.text;
      let pages = r.pageCount;
      if (r.likelyScanned) {
        setReading("Taranmış belge: cihazınızda metne çevriliyor (birkaç dakika sürebilir)…");
        t = await ocrPdfToText(f, (p) => setReading(`Metne çevriliyor: sayfa ${p.page}/${p.totalPages}`), true);
        if (pages > 30) setError(`Taranmış belgelerde ilk 30 sayfa okunabilir (belgenizde ${pages} sayfa var). Kalan sayfalar analize girmez.`);
        pages = Math.min(pages, 30);
      }
      if (t.replace(/<<<SAYFA \d+>>>/g, "").trim().length < 400) {
        setFile(null);
        setError("Bu belgeden yeterli metin okunamadı.");
        return;
      }
      if (t.length > CONTRACT_MAX_CHARS) {
        setFile(null);
        setError(`Belge tek seferde analiz edilemeyecek kadar uzun (${Math.round(t.length / 1000)} bin karakter; üst sınır ${Math.round(CONTRACT_MAX_CHARS / 1000)} bin). Bölümlere ayırıp deneyin.`);
        return;
      }
      setText(t);
      setPageCount(pages);
      void runPrescan(t);
    } catch {
      setFile(null);
      setError("PDF okunamadı (şifreli ya da bozuk olabilir).");
    } finally {
      setReading(null);
    }
  }

  /** Belgeyi tanır ve analizden ÖNCE sorulacak soruları getirir. Başarısız olursa soru olmadan devam edilir. */
  async function runPrescan(t: string) {
    setScanning(true);
    try {
      const v = await prescanContract(t, accessToken);
      setScan(v);
      setSector(v.sectorGuess);
      setSectorAuto(true);
      if (v.valueInDoc) { setContractValue((cur) => cur || v.valueInDoc); setValueFromDoc(true); }
    } catch (e) {
      const err = e as AiError;
      if (err?.status === 401) setGate("login");
      else if (err?.status === 403) setGate("upgrade");
      else if (err?.status === 429 || err?.status === 503) setError(err.message || "Şu an belge taranamıyor.");
      /* diğer hatalar: soru adımı atlanır, analiz yine başlatılabilir */
    } finally {
      setScanning(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function run(mode: ContractMode) {
    if (!text || running) return;
    if (!role) { setError("Önce hangi tarafta olduğunuzu seçin: riskler sizin açınızdan değerlendirilir."); return; }
    setError(null); setGate(null); setReport(null); setExportNote(null);
    try {
      const { jobId: id, quota: q } = await startContractReview(
        { mode, text, role, consent: { accepted: true, version: scan?.consentVersion ?? CONTRACT_CONSENT_VERSION, units: unitsFor(mode) }, roleNote: roleNote.trim() || undefined, sector, contractValue: contractValue.trim() || undefined, playbook: playbook.trim() || undefined, concerns: concerns.trim() || undefined, prescanId: scan?.prescanId, answers: scan ? scan.questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? "" })) : undefined },
        accessToken,
      );
      if (q) setQuota(q);
      setJobId(id);
      const labels = mode === "quick" ? QUICK_LABELS : FULL_LABELS;
      setJob({ id, status: "running", mode, stageIndex: 0, stageCount: labels.length, stageLabels: labels, stageLabel: "Başlatılıyor…", progressNote: "" });
      let misses = 0;
      pollRef.current = window.setInterval(async () => {
        try {
          const v = await getContractReview(id, accessToken);
          misses = 0;
          setJob(v);
          if (v.status === "done" && v.report) {
            stopPolling();
            setReport(v.report);
            setProof(v.proof ?? null);
            void fetchAiQuota(accessToken).then((qq) => qq && setQuota(qq));
          } else if (v.status === "error") {
            stopPolling();
            setError(v.error || "Analiz tamamlanamadı.");
            void fetchAiQuota(accessToken).then((qq) => qq && setQuota(qq));
          }
        } catch (e) {
          const err = e as AiError;
          if (err?.status === 404) {
            stopPolling();
            setJob(null);
            setError("Analiz kaydı bulunamadı (sunucu yenilenmiş olabilir). Harcanan hak/kredi otomatik iade edilmemiş olabilir; kontrol edin, görünmüyorsa destek ile iletişime geçin. Ardından analizi yeniden başlatabilirsiniz.");
          } else if (++misses >= 5) {
            stopPolling();
            setJob(null);
            setError("Sunucuyla bağlantı koptu. Lütfen yeniden deneyin.");
          }
        }
      }, 3000);
    } catch (e) {
      const err = e as AiError;
      if (err?.status === 401) setGate("login");
      else if (err?.status === 403) setGate("upgrade");
      else if (err?.status === 409 && err.code === "price_changed") {
        const u = (err as AiError & { units?: number }).units;
        if (typeof u === "number") setPriceFix((p) => ({ ...p, [mode]: u }));
        setError(err.message);
        setConsentFor(mode); // yeni bedeli yeniden onaylatır
      }
      else if (err?.status === 429) { if (err.quota) setQuota(err.quota); setError(err.message); setTopUpOpen(true); }
      else if (err?.status === 503) setError("Yapay zekâ şu an kullanılamıyor.");
      else setError(err?.message || "Bir hata oluştu.");
    }
  }

  async function exportAnnotated() {
    if (!file || !report) return;
    setBusyExport("annotated"); setExportNote(null);
    try {
      const r = await annotateContractPdf(file, report, proof ?? undefined);
      download(r.bytes, contractDownloadNames(file.name, report.meta.mode).annotated);
      if (jobId) void sha256Hex(r.bytes).then((h) => reportDownload(jobId, "annotated", h, accessToken));
      setExportNote(`${r.marked} bulgu belge üzerinde boyandı${r.skipped ? `, ${r.skipped} bulgu için konum bulunamadı (raporda yer alıyor)` : ""}. Sayfa kenarındaki numaraların tam açıklamaları dosyanın sonundaki “Denetim notları” sayfalarındadır (not simgelerinin açılır penceresi bazı PDF görüntüleyicilerde Türkçe karakterleri göstermeyebilir).`);
    } catch {
      setExportNote("İşaretli PDF üretilemedi (belge şifreli olabilir). Raporu PDF olarak indirebilirsiniz.");
    } finally { setBusyExport(null); }
  }

  async function exportReport() {
    if (!report || !file) return;
    setBusyExport("report");
    try {
      const raw = await contractReportToPdf(report, file.name, proof ?? undefined);
      const bytes = proof ? await embedProofInPdf(raw, report, proof) : raw;
      if (jobId) void sha256Hex(bytes).then((h) => reportDownload(jobId, "report", h, accessToken));
      download(bytes, contractDownloadNames(file.name, report.meta.mode).report);
    } finally { setBusyExport(null); }
  }

  function copy(key: string, value: string) {
    void navigator.clipboard?.writeText(value).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  }

  async function clearAll() {
    stopPolling();
    if (jobId) await deleteContractReview(jobId, accessToken);
    setReport(null); setJob(null); setJobId(null); setFile(null); setText(""); setExportNote(null); setError(null); setScan(null); setAnswers({}); setProof(null);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none";

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]">
          <Gavel className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "Sözleşme Denetçisi" : "Contract Auditor"}</h1>
            <span title={tr ? "Hızlı tarama aylık hakkınızdan (bitince krediden), detaylı denetim yalnızca satın alınan krediden düşer" : "Quick scan uses your monthly allowance (then credits); the detailed audit uses purchased credits only"} className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">{tr ? "Hak · Kredi" : "Allowance · Credits"}</span>
            {quota && !comingSoon ? <AiCreditBadge quota={quota} language={language} onTopUp={() => setTopUpOpen(true)} /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {tr
              ? "Sözleşmenizi yükleyin; sizin tarafınızı tutan bir avukat titizliğiyle okur: çelişkileri, ceza hesaplarını, eksik maddeleri yakalar ve riskli yerleri belge üzerinde boyar. İki seçenek sunar: ucuz ve hızlı bir tarama ya da güncel mevzuatı resmî kaynaklardan da kontrol eden detaylı denetim. Hukuki danışmanlık değildir; ön değerlendirmedir."
              : "Upload your contract; it is read like a lawyer on your side: contradictions, penalty math and missing clauses, checked against current law from official sources, and risky spots highlighted in your PDF."}
          </p>
        </div>
      </div>

      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />Çok Yakında</span>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10"><Gavel className="h-9 w-9" /></div>
          <p className="mt-5 text-xl font-black text-white">Sözleşme Denetçisi</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-300">Sözleşmenizdeki riskleri güncel mevzuata göre bulan ve belge üzerinde işaretleyen yapay zekâ asistanı çok yakında açılıyor.</p>
        </div>
      ) : gate ? (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{gate === "login" ? "Giriş gerekli" : "Bu araç için hak ya da kredi gerekir"}</p>
          {gate === "upgrade" && <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-300">Bu araç için paketinizden gelen aylık AI hakkı ya da satın alınmış kredi gerekir. Hızlı tarama aylık haktan (bitince krediden), detaylı denetim yalnızca krediden düşer. Başlamak için bir kredi paketi alabilir ya da bir plana geçebilirsiniz.</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={gate === "login" ? onLogin : () => setTopUpOpen(true)} className="rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white">{gate === "login" ? "Giriş yap" : "Kredi paketlerini gör"}</button>
            {gate === "upgrade" && <button type="button" onClick={onUpgrade} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]">Planları gör</button>}
          </div>
        </div>
      ) : (
        <>
          {!report && !running && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${text ? "border-fuchsia-400/40 bg-fuchsia-500/[0.05]" : "border-white/15 bg-white/[0.02] hover:border-fuchsia-400/40"}`}>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-200">
                  {reading ? <Loader2 className="h-5 w-5 animate-spin" /> : text ? <FileText className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                </div>
                {reading ? (
                  <p className="mt-2 text-[13px] text-slate-300">{reading}</p>
                ) : text && file ? (
                  <>
                    <p className="mt-2 truncate text-[14px] font-semibold text-white">{file.name}</p>
                    <p className="mt-0.5 text-[12px] text-slate-400">{pageCount} sayfa okundu · başka belge seçmek için tıklayın</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[14px] font-semibold text-white">Sözleşme veya şartname PDF’ini sürükleyin ya da seçin</p>
                    <p className="mt-0.5 text-[12px] text-slate-400">Metin cihazınızda çıkarılır. PDF dosyanız cihazınızdan çıkmaz; analiz için yalnızca belgenin METNİ sunucuya gönderilir.</p>
                  </>
                )}
              </div>

              {text && scanning && (
                <div className="mt-4 flex items-center gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-fuchsia-300" />
                  <div>
                    <p className="text-[14px] font-semibold text-white">Belgeniz tanınıyor…</p>
                    <p className="text-[12px] text-slate-400">Taraflar ve maddeler çıkarılıyor; analizden önce size birkaç soru hazırlıyorum (yaklaşık 1 dakika).</p>
                  </div>
                </div>
              )}
              {text && !scanning && (
                <div className="mt-4 space-y-4 rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-5 sm:p-6">
                  {scan && (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3.5 text-[13px] leading-relaxed text-slate-200">
                      <p><b className="text-white">Belgeyi şöyle tanıdım:</b> {scan.docType}{scan.parties.length > 0 && <> — {scan.parties.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(" · ")}</>}</p>
                    </div>
                  )}
                  {scan && scan.questions.length > 0 && (
                    <div>
                      <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-slate-400">Analizden önce birkaç soru <span className="font-normal normal-case text-slate-500">(cevaplarınız analize kesin bilgi olarak girer; bilmiyorsanız “Bilmiyorum” deyin)</span></p>
                      <div className="mt-2 space-y-3">
                        {scan.questions.map((q) => {
                          const cur = answers[q.id] ?? "";
                          const set = (v: string) => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === v ? "" : v }));
                          return (
                            <div key={q.id} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
                              <p className="text-[13.5px] font-semibold text-white">{q.question}</p>
                              {q.why && <p className="mt-0.5 text-[11.5px] text-slate-500">{q.why}</p>}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {[...q.options, "Bilmiyorum"].map((o) => (
                                  <button key={o} type="button" onClick={() => set(o)} className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition ${cur === o ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"}`}>{o}</button>
                                ))}
                              </div>
                              {q.options.length === 0 && cur !== "Bilmiyorum" && (
                                <input value={cur} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Cevabınızı yazın" maxLength={600} className={`${inputCls} mt-2`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.05] p-3.5">
                    <p className="text-[13px] font-bold text-fuchsia-200">Sizin notlarınız <span className="font-normal text-slate-400">(isteğe bağlı ama çok değerli)</span></p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400">Şirketiniz için önemli olan, özellikle dikkat edilmesini istediğiniz her şeyi yazın. Notlarınız her iki seçenekte de analizde öncelikle dikkate alınır. Raporda her nota tek tek yanıt yazılması yalnızca DETAYLI denetimde yapılır.</p>
                    <textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={4} maxLength={3000} className={`${inputCls} mt-2`}
                      placeholder={"Her satıra bir not yazın. Örn.\nFesih koşulları ve cezai şartlar bizim için en önemli konu.\nTeslim süresine yetişemeyebiliriz, buna dikkat et.\nBu müşteriyle uzun vadeli çalışmak istiyoruz, ilişkiyi bozmayacak öneriler ver."} />
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Bu belge ne tür? {sectorAuto && <span className="font-normal normal-case text-emerald-300/90">(belgeden otomatik tanındı — yanlışsa değiştirin)</span>}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([["ozel", "Özel sözleşme"], ["kamu", "Kamu ihalesi / şartname"]] as const).map(([k, l]) => (
                        <button key={k} type="button" onClick={() => chooseSector(k)} className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${sector === k ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Hangi taraftasınız? <span className="font-normal normal-case text-amber-300">(zorunlu — riskler sizin açınızdan değerlendirilir)</span></p>
                    {scan && scan.parties.length > 0 && (
                      <p className="mb-2 text-[12px] text-slate-400">Belgede geçen taraflar: {scan.parties.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(" · ")}</p>
                    )}
                    <select value={role} onChange={(e) => { setRole(e.target.value as ContractRole | ""); if (error?.startsWith("Önce hangi tarafta")) setError(null); }} className={`${inputCls} ${!role ? "border-amber-400/40" : ""}`}>
                      <option value="" className="bg-slate-900">Lütfen seçin…</option>
                      {roles.map((r) => <option key={r.id} value={r.id} className="bg-slate-900">{r.label}</option>)}
                    </select>
                    {role === "diger" && <input value={roleNote} onChange={(e) => setRoleNote(e.target.value)} placeholder="Örn. alt yüklenici, franchise alan, bayi…" className={`${inputCls} mt-2`} maxLength={300} />}
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Yaklaşık sözleşme bedeli <span className="font-normal normal-case text-slate-500">(isteğe bağlı — cezaları TL olarak hesaplamamı sağlar)</span> {valueFromDoc && <span className="font-normal normal-case text-emerald-300/90">· belgeden okundu, lütfen kontrol edin</span>}</p>
                    <input value={contractValue} onChange={(e) => { setContractValue(e.target.value); setValueFromDoc(false); }} placeholder="Örn. 2.400.000 TL (KDV hariç)" className={inputCls} maxLength={80} />
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Sizin standartlarınız / kırmızı çizgileriniz <span className="font-normal normal-case text-slate-500">(isteğe bağlı ama en değerli kısım)</span></p>
                    <textarea value={playbook} onChange={(e) => setPlaybook(e.target.value)} rows={4} maxLength={6000} className={inputCls}
                      placeholder={"Her satıra bir kural yazın. Örn.\nÖdeme vadesi en fazla 60 gün olmalı.\nGecikme cezası günlük %0,1’i ve toplamda %10’u geçmemeli.\nSorumluluk sözleşme bedeliyle sınırlı olmalı.\nFikri mülkiyet bizde kalmalı."} />
                    <p className="mt-1 text-[11px] text-slate-500">Yazmazsanız genel iyi uygulamaya göre değerlendirilir ve bu raporda belirtilir.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Ne yapalım?</p>
                    {!role && (
                      <p className="mb-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3.5 py-2 text-[12.5px] text-amber-100">Başlamadan önce yukarıda hangi tarafta olduğunuzu seçin.</p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[15px] font-black text-white">Hızlı tarama</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-fuchsia-300">yaklaşık 1-2 dakika · {quickCredits} hak</p>
                        <ul className="mt-2.5 flex-1 space-y-1 text-[12.5px] leading-relaxed text-slate-300">
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />En önemli ~8 riski bulur, belgede boyar</li>
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Çelişkileri ve ceza hesaplarını yakalar</li>
                          <li className="flex gap-1.5"><span className="mt-0.5 w-3.5 shrink-0 text-center font-bold text-slate-500">✕</span><span className="text-slate-400">Güncel mevzuat kontrolü yok (kanun maddesi/kaynak bağlantısı vermez)</span></li>
                          <li className="flex gap-1.5"><span className="mt-0.5 w-3.5 shrink-0 text-center font-bold text-slate-500">✕</span><span className="text-slate-400">Önerilen yeni madde metni yok</span></li>
                          <li className="flex gap-1.5"><span className="mt-0.5 w-3.5 shrink-0 text-center font-bold text-slate-500">✕</span><span className="text-slate-400">Notlarınıza tek tek yanıt yazmaz (notlar analizde yine dikkate alınır)</span></li>
                        </ul>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">Önce aylık hakkınızdan, hakkınız bitince krediden düşer.{quota && !quota.unlimited ? <> Şu an: aylık {monthlyLeft(quota)}, kredi {creditBalance(quota)}.</> : null}</p>
                        {insufficientQuick ? (
                          <button type="button" onClick={() => setTopUpOpen(true)} className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-110">Hakkınız yetmiyor — kredi paketlerini gör</button>
                        ) : (
                          <button type="button" onClick={() => askConsent("quick")} disabled={!text || !role} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 px-4 py-2.5 text-[13.5px] font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-40">Hızlı tara</button>
                        )}
                      </div>

                      <div className="flex flex-col rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/[0.06] p-4">
                        <p className="text-[15px] font-black text-white">Detaylı denetim</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-fuchsia-300">yaklaşık 6-12 dakika · {credits} kredi</p>
                        <ul className="mt-2.5 flex-1 space-y-1 text-[12.5px] leading-relaxed text-slate-200">
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Tüm riskler, çelişkiler, hesaplar ve eksik maddeler</li>
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Güncel mevzuat resmî kaynaklarda kontrol edilir, kaynak bağlantısıyla gösterilir</li>
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Her bulgu için önerilen yeni madde metni</li>
                          <li className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />Notlarınıza tek tek yanıt ve müzakere öncelikleri</li>
                        </ul>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-slate-300">En güçlü yapay zekâ modeli belgeyi birkaç kez okur, rakamları hesaplar, hukuki noktaları resmî kaynaklarda arar; bu yüzden daha pahalıdır. <b className="text-white">Yalnızca satın alınan krediden düşer</b> (aylık hak geçmez).{quota && !quota.unlimited ? <> Krediniz: <b className={insufficientCredits ? "text-red-300" : "text-emerald-300"}>{creditBalance(quota)}</b>.</> : null}</p>
                        {insufficientCredits ? (
                          <button type="button" onClick={() => setTopUpOpen(true)} className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-110">Krediniz yetmiyor — kredi paketlerini gör</button>
                        ) : (
                          <button type="button" onClick={() => askConsent("full")} disabled={!text || !role} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-40"><Gavel className="h-4 w-4" />Detaylı denetle</button>
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-slate-500">
                      <li>• Analiz başarısız olursa harcanan hak/kredi iade edilir.</li>
                      <li>• Sonuç yalnızca bu sayfada gösterilir: bitince raporu indirin, sayfayı kapatırsanız sonuç kaybolur ve yeniden çalıştırmak yeniden hak/kredi harcar.</li>
                      <li>• Bu bir yapay zekâ ön değerlendirmesidir; hukuki danışmanlık değildir. Kritik maddeler için imzadan önce bir avukata danışın.</li>
                    </ul>
                  </div>

                  {error && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}
                </div>
              )}
              {!text && error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}
            </>
          )}

          {running && job && (
            <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-6">
              <p className="flex items-center gap-2 text-[15px] font-bold text-white"><Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" />{activeMode === "quick" ? "Sözleşmeniz taranıyor" : "Sözleşmeniz inceleniyor"}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                {activeMode === "quick" ? "Bu işlem genellikle 1-2 dakika sürer." : "Bu işlem belge uzunluğuna göre 6-12 dakika sürebilir."}{" "}
                <b className="text-amber-200">Bu sayfayı kapatmayın:</b> sonuç yalnızca burada gösterilir; kapatırsanız kaybolur ve yeniden çalıştırmak yeniden hak/kredi harcar.
              </p>
              <ol className="mt-5 space-y-3">
                {(job.stageLabels && job.stageLabels.length ? job.stageLabels : activeMode === "quick" ? QUICK_LABELS : FULL_LABELS).map((l, i) => {
                  const done = i < job.stageIndex;
                  const active = i === job.stageIndex;
                  return (
                    <li key={l} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-500/25 text-emerald-300" : active ? "bg-fuchsia-500/25 text-fuchsia-200" : "bg-white/[0.05] text-slate-500"}`}>
                        {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                      </span>
                      <div>
                        <p className={`text-[13px] ${done ? "text-slate-400" : active ? "font-semibold text-white" : "text-slate-500"}`}>{l}</p>
                        {active && job.progressNote && <p className="mt-0.5 text-[12px] text-fuchsia-200/80">{job.progressNote}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {!running && !report && error && job === null && text === "" && null}
          {!running && !report && error && text && job && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

          {report && file && (
            <ReportView
              report={report}
              fileName={file.name}
              open={open}
              setOpen={setOpen}
              copied={copied}
              onCopy={copy}
              busyExport={busyExport}
              exportNote={exportNote}
              onAnnotated={() => void exportAnnotated()}
              onReportPdf={() => void exportReport()}
              onCopyAll={() => copy("all", contractReportToMarkdown(report, file.name))}
              onClear={() => void clearAll()}
              hasNotes={concerns.trim().length > 0}
              fullCredits={credits}
              insufficientFull={insufficientCredits}
              onRunFull={() => askConsent("full")}
              proof={proof}
              onBuyCredits={() => setTopUpOpen(true)}
            />
          )}

          {report && <ToolRating toolSlug="sozlesme-denetci" language={language} />}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />Belge metni bizim sunucumuzda saklanmaz; rapor en geç 30 dakikada silinir. Yapay zekâ sağlayıcımız API verisini varsayılan olarak model eğitiminde kullanmaz; güvenlik denetimi için en fazla 30 gün tutabilir.
          </p>
        </>
      )}
      {consentFor && (
        <ConsentDialog
          mode={consentFor}
          units={unitsFor(consentFor)}
          fileName={file?.name ?? ""}
          pageCount={pageCount}
          roleLabel={[...ROLES_PRIVATE, ...ROLES_PUBLIC].find((r) => r.id === role)?.label ?? ""}
          roleNote={role === "diger" ? roleNote : ""}
          quota={quota}
          onCancel={() => setConsentFor(null)}
          onConfirm={() => { const m = consentFor; setConsentFor(null); void run(m); }}
        />
      )}
      {topUpOpen && (
        <TopUpModal
          language={language}
          accessToken={accessToken}
          bonus={quota?.bonus}
          onClose={() => setTopUpOpen(false)}
          onGranted={() => { void fetchAiQuota(accessToken).then((q) => q && setQuota(q)); }}
        />
      )}
    </div>
  );
}

function ReportView(props: {
  report: ContractReport;
  fileName: string;
  open: Record<string, boolean>;
  setOpen: (v: Record<string, boolean>) => void;
  copied: string | null;
  onCopy: (k: string, v: string) => void;
  busyExport: null | "annotated" | "report";
  exportNote: string | null;
  onAnnotated: () => void;
  onReportPdf: () => void;
  onCopyAll: () => void;
  onClear: () => void;
  hasNotes: boolean;
  proof: ContractProof | null;
  fullCredits: number;
  insufficientFull: boolean;
  onRunFull: () => void;
  onBuyCredits: () => void;
}) {
  const { report: r, open, setOpen, copied, onCopy } = props;
  const sev = SEV[r.riskLevel];
  const counts = (["kritik", "yuksek", "orta", "dusuk"] as Severity[]).map((s) => [s, r.findings.filter((f) => f.severity === s).length] as const);
  const toggle = (id: string) => setOpen({ ...open, [id]: !open[id] });
  const codes = findingCodes(r.findings);
  const codeOf = (id: string | null): string => { const i = id ? r.findings.findIndex((f) => f.id === id) : -1; return i >= 0 ? codes[i] : ""; };
  const quick = r.meta.mode === "quick";

  return (
    <div className="space-y-4">
      {quick ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/[0.07] p-5">
          <p className="text-[14px] font-black text-amber-100">Bu bir HIZLI TARAMA sonucudur</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-50/90">En önemli riskleri bulur, ancak <b>güncel mevzuat kontrolü, önerilen yeni madde metinleri, müzakere öncelikleri</b> ve (yazdıysanız) <b>notlarınıza tek tek yanıt</b> içermez. {props.hasNotes && "Notlarınız analizde dikkate alındı ama tek tek yanıtlanmadı. "}Hiçbir bulguya kanun maddesi dayanağı eklenmedi.</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-amber-100/70">Kapsamlı sonuç için aynı belgeyi detaylı denetleyebilirsiniz. Hızlı tarama için harcadığınız hak iade edilmez; detaylı denetim ayrıca {props.fullCredits} kredi harcar ve yalnızca satın alınan krediden düşer.</p>
          <button type="button" onClick={props.insufficientFull ? props.onBuyCredits : props.onRunFull}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110">
            <Gavel className="h-4 w-4" />{props.insufficientFull ? `Detaylı denetim için kredi al (${props.fullCredits} kredi gerekir)` : `Bu belgeyi detaylı denetle (${props.fullCredits} kredi)`}
          </button>
        </div>
      ) : null}
      {props.proof && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] leading-relaxed text-slate-500">{proofFooter(props.proof)} — anlaşmazlık halinde bu numarayı destek ekibine iletin; indirdiğiniz PDF’lere doğrulanabilir kayıt gömülür.</p>}
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[12px] leading-relaxed text-slate-300"><b className="text-white">Raporu şimdi indirin.</b> Sonuç yalnızca bu sayfada durur; sayfayı kapatır ya da yenilerseniz kaybolur ve yeniden çalıştırmak yeniden hak/kredi harcar.</p>
      <div className={`overflow-hidden rounded-3xl border ${sev.ring} ${sev.bg} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${sev.chip}`}>Genel risk: {sev.label}</span>
          <span className="text-[12px] text-slate-400">{r.meta.docType} · {r.meta.pageCount} sayfa</span>
        </div>
        <p className="mt-3 text-[17px] font-black leading-snug text-white">{r.headline}</p>
        {r.summary && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-200">{r.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map(([s, n]) => n > 0 && (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${SEV[s].chip}`}>
              <span className={`h-2 w-2 rounded-full ${SEV[s].dot}`} />{n} {SEV[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {r.concernResponses && r.concernResponses.length > 0 && (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.05] p-5">
          <p className="text-[13px] font-bold uppercase tracking-wide text-fuchsia-300">Notlarınıza yanıt</p>
          <div className="mt-3 space-y-3">
            {r.concernResponses.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                <p className="text-[12.5px] italic text-slate-400">“{c.note}”</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-100">{c.response}</p>
                {c.findingIds.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] text-fuchsia-300">İlgili bulgular: {c.findingIds.map((id) => codeOf(id)).filter(Boolean).join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={props.onAnnotated} disabled={props.busyExport !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
          {props.busyExport === "annotated" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Boyalı PDF’i indir
        </button>
        <button type="button" onClick={props.onReportPdf} disabled={props.busyExport !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50">
          {props.busyExport === "report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Raporu PDF indir
        </button>
        <button type="button" onClick={props.onCopyAll} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.08]">
          {copied === "all" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}Kopyala
        </button>
        <button type="button" onClick={props.onClear} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[13px] font-semibold text-slate-300 transition hover:bg-white/[0.06]">
          <Trash2 className="h-4 w-4" />Temizle ve yeni belge
        </button>
      </div>
      {props.exportNote && <p className="text-[12px] text-slate-400">{props.exportNote}</p>}

      {r.priorities.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[13px] font-bold uppercase tracking-wide text-fuchsia-300">Müzakerede ilk kapatmanız gerekenler</p>
          <ol className="mt-3 space-y-2.5">
            {r.priorities.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/20 text-[12px] font-black text-fuchsia-200">{i + 1}</span>
                <div className="text-[13px] leading-relaxed text-slate-300"><b className="text-white">{p.title}</b> — {p.why}{codeOf(p.findingId) && <span className="text-slate-500"> (bulgu {codeOf(p.findingId)})</span>}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {r.findings.length === 0 ? (
        <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5 text-center text-[14px] text-emerald-100">Belgede, kanıtlayabildiğimiz bir risk bulgusu çıkmadı. Aşağıdaki varsayımlara ve eksik maddelere yine de göz atın.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400">Bulgular ({r.findings.length})</p>
          <p className="text-[12px] leading-relaxed text-slate-500">{FINDING_CODE_LEGEND}</p>
          {r.findings.map((f, i) => (
            <FindingCard key={f.id} f={f} n={codes[i]} isOpen={!!open[f.id]} onToggle={() => toggle(f.id)} copied={copied} onCopy={onCopy} />
          ))}
        </div>
      )}

      {r.missingClauses.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber-300"><AlertTriangle className="h-4 w-4" />Sözleşmede olmayan ama olması gereken maddeler</p>
          <div className="mt-3 space-y-3">
            {r.missingClauses.map((m, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                <p className="text-[14px] font-bold text-white">{m.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{m.why}</p>
                {m.suggestedText && (
                  <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.05] p-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Eklemenizi öneririz</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{m.suggestedText}</p>
                    <button type="button" onClick={() => onCopy(`m${i}`, m.suggestedText)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">{copied === `m${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Kopyala</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {r.questionsForUser.length > 0 && (
        <div className="rounded-3xl border border-violet-400/20 bg-violet-500/[0.05] p-5">
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-violet-300"><HelpCircle className="h-4 w-4" />Cevaplarınıza rağmen belirsiz kalanlar</p>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-slate-200">{r.questionsForUser.map((q, i) => <li key={i} className="flex gap-2"><span className="text-violet-300">•</span>{q}</li>)}</ul>
        </div>
      )}

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-300"><Scale className="h-4 w-4" />Mevzuat kontrolü{quick ? " — yapılmadı" : ""}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{r.meta.lawCheck.note}</p>
        {r.meta.lawCheck.sources.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] font-semibold text-fuchsia-300">Taranan resmî kaynaklar ({r.meta.lawCheck.sources.length})</summary>
            <ul className="mt-2 space-y-1">{r.meta.lawCheck.sources.slice(0, 20).map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-slate-400 underline-offset-2 hover:text-white hover:underline">{s.title || s.url}</a></li>)}</ul>
          </details>
        )}
        {r.assumptions.length > 0 && (
          <>
            <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Varsayımlar ve sınırlar</p>
            <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-slate-400">{r.assumptions.map((a, i) => <li key={i} className="flex gap-2"><span>•</span>{a}</li>)}</ul>
          </>
        )}
      </div>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-[12px] leading-relaxed text-slate-400">
        Bu rapor yapay zekâ destekli bir ön değerlendirmedir; hukuki danışmanlık yerine geçmez. Özellikle kritik ve yüksek riskli maddeler için imzadan önce bir avukata danışmanızı öneririz.
      </p>
    </div>
  );
}

function FindingCard({ f, n, isOpen, onToggle, copied, onCopy }: { f: Finding; n: string; isOpen: boolean; onToggle: () => void; copied: string | null; onCopy: (k: string, v: string) => void }) {
  const s = SEV[f.severity];
  const legal = LEGAL_CHIP[f.legalStatus];
  return (
    <div className={`overflow-hidden rounded-2xl border ${s.ring} ${s.bg}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <span className={`mt-0.5 flex h-6 min-w-[1.6rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white ${s.dot}`}>{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.chip}`}>{s.label}</span>
            {legal && f.legalStatus !== "dogrulanamadi" && <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${legal.cls}`}>{legal.label}</span>}
            <span className="text-[11px] text-slate-500">{f.clause}{f.page ? ` · sayfa ${f.page}` : ""}</span>
          </div>
          <p className="mt-1.5 text-[14px] font-bold leading-snug text-white">{f.title}</p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
          {f.quote && (
            <blockquote className="rounded-lg border-l-2 border-red-400/60 bg-black/25 px-3 py-2 text-[13px] italic leading-relaxed text-slate-200">“{f.quote}”{f.quoteMatch === "partial" && <span className="not-italic text-[11px] text-slate-500"> (alıntı kısmen eşleşti)</span>}</blockquote>
          )}
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Neden riskli</p><p className="mt-0.5 text-[13px] leading-relaxed text-slate-200">{f.whyRisky}</p></div>
          {f.impact && <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sizin için etkisi</p><p className="mt-0.5 text-[13px] leading-relaxed text-slate-200">{f.impact}</p></div>}
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ne yapmalı</p><p className="mt-0.5 text-[13px] leading-relaxed text-slate-200">{f.recommendation}</p></div>
          {f.suggestedText && (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Önerilen madde metni</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-100">{f.suggestedText}</p>
              <button type="button" onClick={() => onCopy(`s${f.id}`, f.suggestedText)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">{copied === `s${f.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Kopyala</button>
            </div>
          )}
          {f.legalReferences.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><Scale className="h-3 w-3" />Güncel mevzuat (resmî kaynaktan okundu)</p>
              <ul className="mt-1.5 space-y-2">
                {f.legalReferences.map((ref, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed text-slate-300">
                    <b className="text-white">{ref.law} {ref.article}</b> — {ref.note}
                    {ref.sourceUrl && <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-fuchsia-300 hover:text-fuchsia-200"><ExternalLink className="h-3 w-3" />kaynak</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {f.confidence === "dusuk" && <p className="text-[11px] text-amber-300/80">Bu bulgu için güven düşük: belgedeki ifade farklı yorumlanabilir; imzadan önce teyit edin.</p>}
        </div>
      )}
    </div>
  );
}


/**
 * ONAY PENCERESİ — bedel ve koşullar AÇIKÇA gösterilir; kullanıcı kutuyu işaretleyip onaylamadan işlem başlamaz.
 * Onay (sürüm, zaman, IP, tarayıcı, bedel) sunucuda deftere yazılır; sunucu, onaysız isteği reddeder.
 */
function ConsentDialog({
  mode, units, fileName, pageCount, roleLabel, roleNote, quota, onCancel, onConfirm,
}: {
  mode: ContractMode; units: number; fileName: string; pageCount: number; roleLabel: string; roleNote: string;
  quota: AiQuota | null; onCancel: () => void; onConfirm: () => void;
}) {
  const [ok, setOk] = useState(false);
  const quick = mode === "quick";
  const admin = !!quota?.unlimited;
  const monthly = quota ? monthlyLeft(quota) : 0;
  const credits = quota ? creditBalance(quota) : 0;
  // İşlemden sonra tahmini kalan
  const afterMonthly = quick ? Math.max(0, monthly - units) : monthly;
  const afterCredits = quick ? credits - Math.max(0, units - monthly) : credits - units;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/[0.12] bg-[#0b1020] p-6 shadow-2xl">
        <h2 id="consent-title" className="text-lg font-black text-white">İşlemi onaylayın</h2>
        <p className="mt-1 text-[12.5px] text-slate-400">Başlamadan önce aşağıdakileri lütfen okuyun.</p>

        <dl className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-black/25 p-4 text-[13px]">
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Belge</dt><dd className="min-w-0 truncate text-right font-semibold text-white">{fileName}{pageCount ? ` · ${pageCount} sayfa` : ""}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">İşlem</dt><dd className="text-right font-semibold text-white">{quick ? "Hızlı tarama" : "Detaylı denetim"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Hangi taraf</dt><dd className="text-right font-semibold text-white">{roleLabel}{roleNote ? ` — ${roleNote}` : ""}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Bedel</dt><dd className="text-right text-[15px] font-black text-fuchsia-300">{admin ? "Yönetici hesabı: hiçbir şey düşülmez" : `${units} ${quick ? "hak" : "kredi"}`}</dd></div>
          {!admin && (
            <>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Nereden düşer</dt><dd className="max-w-[60%] text-right text-slate-200">{quick ? "Önce aylık hakkınızdan, bitince satın alınmış krediden" : "Yalnızca satın alınmış krediden (aylık hakkınızdan düşmez)"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Şu an</dt><dd className="text-right text-slate-200">aylık hak {monthly} · kredi {credits}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">İşlemden sonra (tahmini)</dt><dd className="text-right text-slate-200">aylık hak {afterMonthly} · kredi {Math.max(0, afterCredits)}</dd></div>
            </>
          )}
        </dl>

        {!admin && (
          <ul className="mt-4 space-y-1.5 text-[12.5px] leading-relaxed text-slate-300">
            <li className="flex gap-2"><span className="text-amber-300">•</span><span><b className="text-white">Bedel, işlem başlar başlamaz düşülür.</b> Sonucu indirmeseniz, sayfayı kapatsanız, yanlış bilgi girdiğinizi fark etseniz ya da sonuçtan memnun kalmasanız da <b className="text-white">iade edilmez</b>.</span></li>
            <li className="flex gap-2"><span className="text-emerald-300">•</span><span>Yalnızca bizden kaynaklı bir hata nedeniyle sonuç üretilemezse bedel <b className="text-white">otomatik iade edilir</b>.</span></li>
          </ul>
        )}
        <ul className="mt-1.5 space-y-1.5 text-[12.5px] leading-relaxed text-slate-300">
          <li className="flex gap-2"><span className="text-amber-300">•</span><span>Sonuç yalnızca bu sayfada gösterilir; bitince raporu <b className="text-white">hemen indirin</b>.</span></li>
          <li className="flex gap-2"><span className="text-amber-300">•</span><span>Sonuç bir <b className="text-white">yapay zekâ ön değerlendirmesidir</b>; hukuki danışmanlık değildir ve hata içerebilir. Kritik kararlar için bir avukata danışın.</span></li>
          {quick && <li className="flex gap-2"><span className="text-amber-300">•</span><span>Hızlı taramada güncel mevzuat kontrolü, önerilen madde metni ve notlarınıza tek tek yanıt <b className="text-white">yoktur</b>.</span></li>}
          <li className="flex gap-2"><span className="text-slate-500">•</span><span className="text-slate-400">Onayınız; tarih, saat ve IP adresinizle birlikte kayıt altına alınır.</span></li>
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] text-slate-100">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-500" />
          <span>Yukarıdakileri okudum, anladım ve onaylıyorum.</span>
        </label>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.06]">Vazgeç</button>
          <button type="button" disabled={!ok} onClick={onConfirm} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-40">Onayla ve başlat</button>
        </div>
      </div>
    </div>
  );
}
