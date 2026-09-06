import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  EyeOff,
  FileText,
  Loader2,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Wand2,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { extractPdfText } from "../../lib/pdfText";
import { ocrPdfToText } from "../../lib/ocr";
import { redactPdf, saveBlobToUser } from "../../api";
import { aiDetectSensitive, fetchAiQuota, type AiError, type AiQuota } from "../../api/ai";
import { TopUpModal } from "./TopUpModal";
import { detectSensitiveByRegex } from "../../lib/redactDetectors";

type Item = { id: string; type: string; label: string; value: string; checked: boolean };
const uid = () => Math.random().toString(36).slice(2, 9);

const AI_TYPE_LABEL: Record<string, { tr: string; en: string }> = {
  isim: { tr: "İsim", en: "Name" }, name: { tr: "İsim", en: "Name" },
  adres: { tr: "Adres", en: "Address" }, address: { tr: "Adres", en: "Address" },
  kimlik: { tr: "Kimlik", en: "ID" }, id: { tr: "Kimlik", en: "ID" },
  hesap: { tr: "Hesap", en: "Account" }, account: { tr: "Hesap", en: "Account" },
  tarih: { tr: "Tarih", en: "Date" }, date: { tr: "Tarih", en: "Date" },
  telefon: { tr: "Telefon", en: "Phone" }, phone: { tr: "Telefon", en: "Phone" },
  eposta: { tr: "E-posta", en: "Email" }, email: { tr: "E-posta", en: "Email" },
  // Genişletilmiş kategoriler (sunucudaki istem ile birebir aynı olmalı)
  fatura: { tr: "Fatura / Belge No", en: "Invoice / Document no." }, invoice: { tr: "Fatura / Belge No", en: "Invoice / Document no." },
  vergi: { tr: "Vergi No", en: "Tax ID" }, tax: { tr: "Vergi No", en: "Tax ID" },
  sirket: { tr: "Şirket / Kurum", en: "Company" }, company: { tr: "Şirket / Kurum", en: "Company" },
  tutar: { tr: "Tutar / Maaş", en: "Amount / Salary" }, amount: { tr: "Tutar / Maaş", en: "Amount / Salary" },
  saglik: { tr: "Sağlık Bilgisi", en: "Health info" }, health: { tr: "Sağlık Bilgisi", en: "Health info" },
  plaka: { tr: "Plaka", en: "License plate" }, plate: { tr: "Plaka", en: "License plate" },
  musteri: { tr: "Müşteri / Abone No", en: "Customer no." }, customer: { tr: "Müşteri / Abone No", en: "Customer no." },
  imza: { tr: "İmza / Kaşe", en: "Signature" }, signature: { tr: "İmza / Kaşe", en: "Signature" },
  kullanici: { tr: "Kullanıcı Adı", en: "Username" }, username: { tr: "Kullanıcı Adı", en: "Username" },
};

type Props = { language: Language; accessToken: string | null; onLogin: () => void; onUpgrade: () => void; comingSoon?: boolean; initialFile?: File | null };

/** AI HASSAS VERİ GİZLEME — TC/IBAN/telefon/e-posta'yı cihazda regex ile, isim/adresi
 * yapay zekâ ile bul; onaylananları sunucuda GERÇEKTEN kaldır (PyMuPDF redaction). */
export function AiRedactTool({ language, accessToken, onLogin, onUpgrade, comingSoon, initialFile }: Props) {
  const tr = language === "tr";
  const [file, setFile] = useState<File | null>(null);
  const [docText, setDocText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!comingSoon) void fetchAiQuota(accessToken).then((q) => q && setQuota(q)); }, [accessToken, comingSoon]);

  function mergeItems(prev: Item[], add: Item[]): Item[] {
    const seen = new Set(prev.map((i) => i.value.toLowerCase()));
    const fresh = add.filter((i) => !seen.has(i.value.toLowerCase()));
    return [...prev, ...fresh];
  }

  function regexDetect(text: string): Item[] {
    return detectSensitiveByRegex(text, tr).map((d) => ({ ...d, id: uid(), checked: true }));
  }

  // Araçlar arası aktarım: dışarıdan (Taramalarım) gelen PDF'i bir kez yükle.
  const loadedInitialRef = useRef<File | null>(null);
  useEffect(() => {
    if (initialFile && loadedInitialRef.current !== initialFile) {
      loadedInitialRef.current = initialFile;
      void pickFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    setError(null); setResult(null); setItems([]); setAiDone(false);
    if (f.type !== "application/pdf") { setError(tr ? "Lütfen PDF seçin." : "Please choose a PDF."); return; }
    setFile(f);
    try {
      setBusy(true);
      const r = await extractPdfText(f);
      const text = r.likelyScanned ? await ocrPdfToText(f) : r.text;
      setDocText(text);
      setItems(regexDetect(text));
    } catch { setError(tr ? "PDF okunamadı." : "Could not read the PDF."); }
    finally { setBusy(false); }
  }

  async function runAiDetect() {
    if (!docText.trim()) return;
    setError(null); setGate(null);
    try {
      setAiBusy(true);
      const { items: found, quota: q } = await aiDetectSensitive(docText, tr ? "tr" : "en", accessToken);
      if (q) setQuota(q);
      const mapped: Item[] = found.map((i) => {
        const lbl = AI_TYPE_LABEL[i.type];
        return { id: uid(), type: i.type, label: lbl ? (tr ? lbl.tr : lbl.en) : (tr ? "Diğer" : "Other"), value: i.value, checked: true };
      });
      setItems((prev) => mergeItems(prev, mapped));
      setAiDone(true);
    } catch (e) {
      const err = e as AiError;
      if (err?.status === 401) setGate("login");
      else if (err?.status === 403) setGate("upgrade");
      else if (err?.status === 429) { if (err.quota) setQuota(err.quota); setError(tr ? "Bu ayki AI kotan doldu." : "Monthly AI quota reached."); }
      else if (err?.status === 503) setError(tr ? "AI şu an kullanılamıyor." : "AI is currently unavailable.");
      else setError(err?.message || (tr ? "Bir hata oluştu." : "Something went wrong."));
    } finally { setAiBusy(false); }
  }

  async function runRedact() {
    if (!file) return;
    const terms = items.filter((i) => i.checked).map((i) => i.value);
    if (terms.length === 0) { setError(tr ? "Gizlenecek en az bir öğe seçin." : "Select at least one item to redact."); return; }
    setError(null);
    try {
      setBusy(true);
      const blob = await redactPdf(file, terms, accessToken);
      setResult(blob);
    } catch (e) { setError(e instanceof Error ? e.message : tr ? "Gizlenemedi." : "Failed."); }
    finally { setBusy(false); }
  }

  function download() {
    if (!result || !file) return;
    const name = `${file.name.replace(/\.pdf$/i, "")}-gizlenmis.pdf`;
    // İndirme konumunu sorar (destekleyen tarayıcıda); değilse klasik indirmeye düşer.
    void saveBlobToUser(result, name).catch(() => {});
  }

  const selectedCount = items.filter((i) => i.checked).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  /** Etikete göre gruplanmış öğeler — kategori bazlı toplu seçim için. */
  const groupedItems = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) {
      const list = map.get(i.label);
      if (list) list.push(i);
      else map.set(i.label, [i]);
    }
    return [...map.entries()].map(([label, list]) => ({ label, items: list }));
  }, [items]);

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]"><EyeOff className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "Hassas Veri Gizle" : "Redact Sensitive Data"}</h1>
            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">Pro</span>
            {quota && !comingSoon ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${!quota.unlimited && (quota.remaining ?? 0) <= 0 ? "border-red-400/35 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                {quota.unlimited ? (tr ? "Sınırsız" : "Unlimited") : tr ? `Bu ay: ${quota.remaining}/${quota.limit}` : `This month: ${quota.remaining}/${quota.limit}`}
              </span>
            ) : null}
            {quota && !quota.unlimited && !comingSoon ? (
              <button type="button" onClick={() => setTopUpOpen(true)} title={tr ? "Ek AI kredisi al" : "Get extra AI credits"}
                className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20">
                + {tr ? "Kredi" : "Credits"}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{tr ? "TC, IBAN, telefon ve e-postayı cihazda bulur; isim/adresi yapay zekâ ile tespit eder; onayladıklarınızı PDF'ten GERÇEKTEN kaldırır (örtme değil)." : "Finds ID, IBAN, phone and email on your device; detects names/addresses with AI; truly removes what you confirm (not just covers)."}</p>
        </div>
      </div>

      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}</span>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10"><EyeOff className="h-9 w-9" /></div>
          <p className="mt-5 text-xl font-black text-white">{tr ? "Hassas Veri Gizle" : "Redact Sensitive Data"}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-300">{tr ? "Kişisel verileri (TC, IBAN, isim, adres) bulup PDF'ten kalıcı kaldıran KVKK-dostu araç çok yakında açılıyor." : "A KVKK/GDPR-friendly tool that finds and permanently removes personal data from a PDF is coming very soon."}</p>
        </div>
      ) : gate ? (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{gate === "login" ? (tr ? "Giriş gerekli" : "Login required") : (tr ? "Pro / Business özelliği" : "Pro / Business feature")}</p>
          <button type="button" onClick={gate === "login" ? onLogin : onUpgrade} className="mt-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white">{gate === "login" ? (tr ? "Giriş yap" : "Log in") : (tr ? "Planları gör" : "See plans")}</button>
        </div>
      ) : result ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"><Check className="h-8 w-8" /></div>
          <p className="mt-4 text-xl font-bold text-white">{tr ? "Veriler gizlendi 🎉" : "Data redacted 🎉"}</p>
          <p className="mt-1 text-sm text-slate-400">{tr ? "Seçtiğiniz bilgiler PDF'ten kalıcı olarak kaldırıldı." : "The selected information was permanently removed from the PDF."}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"><Download className="h-4 w-4" />{tr ? "İndir" : "Download"}</button>
            <button type="button" onClick={() => { setResult(null); setFile(null); setItems([]); setDocText(""); setAiDone(false); }} className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]">{tr ? "Yeni belge" : "New document"}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{tr ? "Gerçek gizleme için dosyanız güvenli sunucumuzda işlenir (metin tespiti cihazınızda yapılır), işlem biter bitmez silinir." : "For true redaction your file is processed on our secure server (detection runs on your device) and deleted right after."}</p>
          </div>

          {!file ? (
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pickFile(e.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] p-10 text-center transition hover:border-fuchsia-400/40">
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-200">{busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}</div>
              <p className="mt-4 text-base font-bold text-white">{busy ? (tr ? "Belge okunuyor…" : "Reading…") : tr ? "PDF'i buraya sürükle" : "Drag your PDF here"}</p>
              <p className="mt-1 text-[13px] text-slate-400">{tr ? "TC, IBAN, telefon, e-posta otomatik bulunur" : "ID, IBAN, phone, email auto-detected"}</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/12 text-fuchsia-300"><FileText className="h-5 w-5" /></span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{file.name}</p>
                <button type="button" onClick={() => void runAiDetect()} disabled={aiBusy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-[12px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50">
                  {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}{aiDone ? (tr ? "AI tekrar tara" : "AI re-scan") : (tr ? "AI ile isim/adres bul" : "Find names/addresses with AI")}
                </button>
              </div>

              {items.length > 0 ? (
                <>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[12px] font-semibold text-slate-300">{items.length} {tr ? "hassas öğe bulundu" : "sensitive items"} · {selectedCount} {tr ? "seçili" : "selected"}</span>
                    <button type="button" onClick={() => setItems((p) => p.map((i) => ({ ...i, checked: !allChecked })))} className="text-[12px] font-semibold text-fuchsia-300 hover:text-fuchsia-200">{allChecked ? (tr ? "Hiçbirini seçme" : "Deselect all") : (tr ? "Tümünü seç" : "Select all")}</button>
                  </div>
                  {/* Kategoriye göre grupla: tespit kapsamı genişledikçe düz liste
                      kullanışsız kalıyor. Başlıktaki kutu o türün TAMAMINI seçer —
                      "adresleri gizle ama tarihleri bırak" gibi kararlar tek tıkla. */}
                  <ul className="max-h-[40vh] space-y-3 overflow-y-auto">
                    {groupedItems.map((g) => (
                      <li key={g.label}>
                        <label className="mb-1 flex cursor-pointer items-center gap-2 px-1">
                          <input
                            type="checkbox"
                            checked={g.items.every((i) => i.checked)}
                            ref={(el) => {
                              if (el) el.indeterminate = g.items.some((i) => i.checked) && !g.items.every((i) => i.checked);
                            }}
                            onChange={() => {
                              const turnOn = !g.items.every((i) => i.checked);
                              const ids = new Set(g.items.map((i) => i.id));
                              setItems((p) => p.map((x) => (ids.has(x.id) ? { ...x, checked: turnOn } : x)));
                            }}
                            className="h-4 w-4 accent-fuchsia-500"
                          />
                          <span className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-300">{g.label}</span>
                          <span className="text-[11px] text-slate-500">
                            {g.items.filter((i) => i.checked).length}/{g.items.length}
                          </span>
                        </label>
                        <ul className="space-y-1.5">
                          {g.items.map((i) => (
                            <li key={i.id}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.04]">
                                <input type="checkbox" checked={i.checked} onChange={() => setItems((p) => p.map((x) => (x.id === i.id ? { ...x, checked: !x.checked } : x)))} className="h-4 w-4 accent-fuchsia-500" />
                                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-200">{i.value}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              ) : busy ? null : (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-[13px] text-slate-400">{tr ? "Yapılandırılmış veri bulunamadı. İsim/adres için «AI ile bul»u deneyin." : "No structured data found. Try «Find with AI» for names/addresses."}</p>
              )}

              {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

              <button type="button" onClick={() => void runRedact()} disabled={busy || selectedCount === 0}
                className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-40">
                {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Gizleniyor…" : "Redacting…"}</> : <><EyeOff className="h-5 w-5" />{tr ? `${selectedCount} öğeyi gizle` : `Redact ${selectedCount} items`}</>}
              </button>
            </>
          )}
        </>
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
