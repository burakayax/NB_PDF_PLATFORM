import { lazy, Suspense, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Lock,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getToolSeo } from "../../seo/seoContent.mjs";
import { expandPagesString } from "../../i18n/workspace";
import {
  rotatePdf,
  deletePages,
  reorderPages,
  pdfBytesToBlob,
  PdfEncryptedError,
} from "../../lib/clientPdf";
import type { PdfPageVisualMode } from "../split/PdfPageVisualGrid";

const PdfPageVisualGrid = lazy(() =>
  import("../split/PdfPageVisualGrid").then((m) => ({ default: m.PdfPageVisualGrid })),
);

/** Sayfa-seviyeli (grid'li) client-side misafir araçları. */
export type PageToolId = "rotate-pdf" | "delete-pages" | "organize-pdf";

const MAX_BYTES = 80 * 1024 * 1024;

function canShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function"
  );
}

type Props = {
  slug: string;
  tool: PageToolId;
  language: Language;
  onLogin: () => void;
  onRegister: () => void;
};

export function GuestPageTool({ slug, tool, language, onLogin, onRegister }: Props) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);
  const mode: PdfPageVisualMode =
    tool === "rotate-pdf" ? "rotate" : tool === "delete-pages" ? "delete" : "organize";

  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pagesText, setPagesText] = useState("");
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [zoom, setZoom] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const outName =
    mode === "rotate" ? "dondurulmus.pdf" : mode === "delete" ? "silinmis.pdf" : "duzenlenmis.pdf";

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF dosyası seçin." : "Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        tr
          ? "Dosya 80 MB'ı aşıyor. Daha büyüğü için ücretsiz üye olun."
          : "File exceeds 80 MB. Sign up free for larger files.",
      );
      return;
    }
    setFile(f);
    setPagesText("");
    setPageRotations({});
    setPageOrder([]);
    setResult(null);
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function shareResult() {
    if (!result) return;
    const f = new File([result.blob], result.filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [f] }) && nav.share) await nav.share({ files: [f], title: result.filename });
    } catch {
      /* iptal */
    }
  }

  const run = async () => {
    if (!file || numPages === 0) return;
    setError(null);

    // Mod doğrulaması
    let rot0: Record<number, number> = {};
    let del0: number[] = [];
    let order0: number[] = [];
    if (mode === "rotate") {
      for (const [p1, deg] of Object.entries(pageRotations)) {
        const d = Number(deg);
        if (d % 360 !== 0) rot0[Number(p1) - 1] = d;
      }
      if (Object.keys(rot0).length === 0) {
        setError(tr ? "Döndürmek için en az bir sayfayı çevir." : "Rotate at least one page.");
        return;
      }
    } else if (mode === "delete") {
      const pages1 = expandPagesString(pagesText, numPages, language) ?? [];
      if (pages1.length === 0) {
        setError(tr ? "Silinecek sayfa(lar) seç." : "Select page(s) to delete.");
        return;
      }
      if (pages1.length >= numPages) {
        setError(tr ? "Tüm sayfalar silinemez." : "Cannot delete every page.");
        return;
      }
      del0 = pages1.map((p) => p - 1);
    } else {
      const order1 = pageOrder.length ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1);
      order0 = order1.map((p) => p - 1);
    }

    // Kaydetme yerini SOR (kullanıcı aktivasyonu hâlâ geçerli)
    let saveHandle: FileSystemFileHandle | null = null;
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        saveHandle = await win.showSaveFilePicker({
          suggestedName: outName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      setBusy(true);
      const src = new Uint8Array(await file.arrayBuffer());
      let out: Uint8Array;
      if (mode === "rotate") out = await rotatePdf(src, rot0);
      else if (mode === "delete") out = await deletePages(src, del0);
      else out = await reorderPages(src, order0);

      const blob = pdfBytesToBlob(out);
      if (saveHandle) {
        const w = await saveHandle.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        downloadBlob(blob, outName);
      }
      setResult({ blob, filename: outName });
    } catch (e) {
      setError(
        e instanceof PdfEncryptedError
          ? tr
            ? "Bu PDF şifre korumalı. Şifreli dosyalar için giriş yapın."
            : "This PDF is password-protected. Log in to process it."
          : tr
            ? "İşlem sırasında bir hata oluştu."
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  const hint =
    mode === "rotate"
      ? tr
        ? "Her sayfanın altındaki ok ile döndür, sonra «Kaydet»."
        : "Rotate each page with the arrows, then «Save»."
      : mode === "delete"
        ? tr
          ? "Silmek istediğin sayfaları seç, sonra «Kaydet»."
          : "Select the pages to delete, then «Save»."
        : tr
          ? "Sayfaları sürükleyerek yeniden sırala, sonra «Kaydet»."
          : "Drag pages to reorder, then «Save».";

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button type="button" onClick={onLogin} className="flex items-center gap-2">
            <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold tracking-tight">PDF Platform</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              {tr ? "Giriş yap" : "Log in"}
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              {tr ? "Üye Ol" : "Sign up"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            {tr ? "Ücretsiz · Gizli · Kurulum yok" : "Free · Private · No install"}
          </span>
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl">
            {seo?.h1 ?? slug}
          </h1>
        </div>

        <div className="mt-8">
          {result ? (
            <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <Check className="h-8 w-8" />
              </div>
              <p className="mt-4 text-xl font-bold">
                {tr ? "Hazır! Dosyan kaydedildi 🎉" : "Done! Your file is ready 🎉"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {tr ? "Dosyan cihazından hiç çıkmadı." : "Your file never left your device."}
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => downloadBlob(result.blob, result.filename)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
                >
                  <Download className="h-4 w-4" />
                  {tr ? "İndir" : "Download"}
                </button>
                {canShare() && (
                  <button
                    type="button"
                    onClick={() => void shareResult()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                  >
                    <Share2 className="h-4 w-4" />
                    {tr ? "Paylaş" : "Share"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  {tr ? "Yeni işlem" : "New task"}
                </button>
              </div>
            </div>
          ) : !file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className={`group cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition ${
                dragOver
                  ? "border-cyan-400/70 bg-cyan-400/[0.06]"
                  : "border-white/15 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 text-cyan-300 ring-1 ring-white/10">
                <UploadCloud className="h-7 w-7" />
              </div>
              <p className="mt-4 text-base font-semibold">
                {tr ? "PDF'i buraya sürükle" : "Drag your PDF here"}
              </p>
              <p className="mt-1 text-[13px] text-slate-400">
                {tr ? "ya da tıklayıp seç · 80 MB'a kadar" : "or click to choose · up to 80 MB"}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <p className="text-[13px] text-slate-300">{hint}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(25, z - 25))}
                    className="rounded-md border border-white/10 p-1 text-slate-300 hover:bg-white/10"
                    aria-label="Uzaklaştır"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center text-xs text-slate-400">{zoom}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(100, z + 25))}
                    className="rounded-md border border-white/10 p-1 text-slate-300 hover:bg-white/10"
                    aria-label="Yakınlaştır"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="h-[58vh] min-h-[420px] overflow-hidden rounded-xl">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  }
                >
                  <PdfPageVisualGrid
                    file={file}
                    password=""
                    maxPage={numPages || null}
                    language={language}
                    mode={mode}
                    pagesText={pagesText}
                    onPagesTextChange={setPagesText}
                    onPagesErrorClear={() => setError(null)}
                    pageRotations={pageRotations}
                    onPageRotationsChange={setPageRotations}
                    pageOrder={pageOrder}
                    onPageOrderChange={setPageOrder}
                    zoomPercent={zoom}
                    onStatsChange={(s) => setNumPages(s.totalPages)}
                  />
                </Suspense>
              </div>

              {error && (
                <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
                  {error}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setError(null);
                  }}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white"
                >
                  {tr ? "← Başka dosya" : "← Other file"}
                </button>
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={busy || numPages === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 text-[15px] font-bold text-white shadow-[0_14px_36px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {tr ? "İşleniyor…" : "Processing…"}
                    </>
                  ) : (
                    <>{tr ? "Kaydet" : "Save"} →</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Dosyan cihazından çıkmaz" : "Files never leave your device" },
            { icon: <Zap className="h-4 w-4" />, t: tr ? "Anında işlem" : "Instant processing" },
            { icon: <Lock className="h-4 w-4" />, t: tr ? "Sınırsız & ücretsiz" : "Unlimited & free" },
          ].map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-slate-300"
            >
              <span className="text-cyan-300">{b.icon}</span>
              {b.t}
            </div>
          ))}
        </div>

        {seo?.faq && seo.faq.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-200">
              {tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-200">
                    {item.q}
                    <span className="text-slate-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
