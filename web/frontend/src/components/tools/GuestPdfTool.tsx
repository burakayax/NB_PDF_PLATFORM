import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getToolSeo } from "../../seo/seoContent.mjs";
import {
  mergePdfs,
  imagesToPdf,
  pdfBytesToBlob,
  PdfEncryptedError,
} from "../../lib/clientPdf";

/** Misafirde client-side çalışan araçlar. */
export type GuestToolId = "merge" | "image-to-pdf";

const MAX_BYTES = 80 * 1024 * 1024; // 80 MB — ücretsiz/misafir tavanı

type Picked = { id: string; file: File };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type GuestPdfToolProps = {
  slug: string;
  tool: GuestToolId;
  language: Language;
  onLogin: () => void;
  onRegister: () => void;
};

/**
 * MİSAFİR-ÖNCELİKLİ araç ekranı — login YOK. Dosyalar sunucuya GİTMEDEN cihazda
 * işlenir (pdf-lib): anında, gizli, sınırsız. SEO içeriği (H1 + açıklama + SSS)
 * görünür kalır → sayfa hem arama hedefi hem çalışan araç. Üyelik yalnızca
 * "geçmişini kaydet / ağır araçlar" için (gönüllü upsell).
 */
export function GuestPdfTool({
  slug,
  tool,
  language,
  onLogin,
  onRegister,
}: GuestPdfToolProps) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);

  const isImages = tool === "image-to-pdf";
  const accept = isImages ? "image/png,image/jpeg,image/jpg,image/webp" : "application/pdf";
  const minFiles = isImages ? 1 : 2;

  const [files, setFiles] = useState<Picked[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctaLabel = isImages
    ? tr
      ? "PDF'e Çevir"
      : "Convert to PDF"
    : tr
      ? "Birleştir"
      : "Merge";
  const outName = isImages ? "gorseller.pdf" : "birlestirilmis.pdf";

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const arr = Array.from(incoming).filter((f) =>
        isImages ? f.type.startsWith("image/") : f.type === "application/pdf",
      );
      if (arr.length === 0) {
        setError(
          tr
            ? isImages
              ? "Lütfen görsel (JPG/PNG) ekleyin."
              : "Lütfen PDF dosyası ekleyin."
            : isImages
              ? "Please add image (JPG/PNG) files."
              : "Please add PDF files.",
        );
        return;
      }
      setFiles((prev) => [...prev, ...arr.map((file) => ({ id: uid(), file }))]);
    },
    [isImages, tr],
  );

  const move = (i: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i]!, next[j]!] = [next[j]!, next[i]!];
      return next;
    });
  };
  const remove = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const run = async () => {
    setError(null);
    if (files.length < minFiles) {
      setError(
        tr
          ? isImages
            ? "En az 1 görsel ekleyin."
            : "Birleştirmek için en az 2 PDF ekleyin."
          : isImages
            ? "Add at least 1 image."
            : "Add at least 2 PDFs to merge.",
      );
      return;
    }
    const total = files.reduce((s, f) => s + f.file.size, 0);
    if (total > MAX_BYTES) {
      setError(
        tr
          ? "Toplam boyut 80 MB'ı aşıyor. Daha büyük dosyalar için ücretsiz üye olun."
          : "Total size exceeds 80 MB. Sign up free for larger files.",
      );
      return;
    }
    try {
      setBusy(true);
      let bytes: Uint8Array;
      if (isImages) {
        const imgs = await Promise.all(
          files.map(async (f) => ({
            bytes: await f.file.arrayBuffer(),
            mime: f.file.type,
          })),
        );
        bytes = await imagesToPdf(imgs);
      } else {
        const buffers = await Promise.all(
          files.map((f) => f.file.arrayBuffer()),
        );
        bytes = await mergePdfs(buffers);
      }
      const blob = pdfBytesToBlob(bytes);
      // Otomatik indir
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setResult({ blob, filename: outName });
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setError(
          tr
            ? "Bu PDF şifre korumalı. Şifreli dosyalar için giriş yapın (sunucu modu)."
            : "This PDF is password-protected. Log in to process encrypted files.",
        );
      } else {
        setError(
          tr ? "İşlem sırasında bir hata oluştu." : "Something went wrong.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadAgain = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      {/* Üst bar */}
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

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:pt-14">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            {tr ? "Ücretsiz · Gizli · Kurulum yok" : "Free · Private · No install"}
          </span>
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl md:text-5xl">
            {seo?.h1 ?? slug}
          </h1>
          {seo?.intro && (
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
              {seo.intro}
            </p>
          )}
        </div>

        {/* Araç kartı */}
        <div className="mt-9">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                  <Check className="h-8 w-8" />
                </div>
                <p className="mt-4 text-xl font-bold">
                  {tr ? "Hazır! Dosyan indirildi 🎉" : "Done! Your file downloaded 🎉"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {tr
                    ? "Dosyan cihazından hiç çıkmadı — tamamen gizli."
                    : "Your file never left your device — fully private."}
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={downloadAgain}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    {tr ? "Tekrar indir" : "Download again"}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    {tr ? "Yeni işlem" : "New task"}
                  </button>
                </div>
                {/* Zarif upsell */}
                <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
                  <p className="text-sm font-semibold text-white">
                    {tr ? "Daha fazlası ister misin?" : "Want more?"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-slate-400">
                    {tr
                      ? "Ücretsiz üye ol: işlem geçmişin kaydedilsin, Word/Excel dönüştürme, OCR ve daha fazlasına eriş."
                      : "Sign up free: save your history, unlock Word/Excel conversion, OCR and more."}
                  </p>
                  <button
                    type="button"
                    onClick={onRegister}
                    className="mt-3 text-[13px] font-semibold text-cyan-300 transition hover:text-cyan-200"
                  >
                    {tr ? "Ücretsiz üye ol →" : "Sign up free →"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="tool"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition ${
                    dragOver
                      ? "border-cyan-400/70 bg-cyan-400/[0.06]"
                      : "border-white/15 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 text-cyan-300 ring-1 ring-white/10 transition group-hover:scale-105">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-white">
                    {tr ? "Dosyaları buraya sürükle" : "Drag your files here"}
                  </p>
                  <p className="mt-1 text-[13px] text-slate-400">
                    {tr ? "ya da tıklayıp seç" : "or click to choose"} ·{" "}
                    {isImages ? "JPG, PNG" : "PDF"} · {tr ? "80 MB'a kadar" : "up to 80 MB"}
                  </p>
                </div>

                {/* Dosya listesi */}
                {files.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {files.map((f, i) => (
                      <motion.li
                        key={f.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-300">
                          {isImages ? (
                            <ImageIcon className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-100">
                            {f.file.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {humanSize(f.file.size)}
                          </p>
                        </div>
                        {!isImages && files.length > 1 && (
                          <span className="flex shrink-0 items-center">
                            <button
                              type="button"
                              onClick={() => move(i, -1)}
                              disabled={i === 0}
                              className="rounded-md p-1 text-slate-500 transition hover:text-white disabled:opacity-30"
                              aria-label={tr ? "Yukarı" : "Up"}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(i, 1)}
                              disabled={i === files.length - 1}
                              className="rounded-md p-1 text-slate-500 transition hover:text-white disabled:opacity-30"
                              aria-label={tr ? "Aşağı" : "Down"}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(f.id)}
                          className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                          aria-label={tr ? "Kaldır" : "Remove"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                )}

                {error && (
                  <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
                    {error}
                  </p>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={busy || files.length < minFiles}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {tr ? "İşleniyor…" : "Processing…"}
                    </>
                  ) : (
                    <>
                      {ctaLabel} →
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Güven satırı */}
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              t: tr ? "Dosyan cihazından çıkmaz" : "Files never leave your device",
            },
            {
              icon: <Zap className="h-4 w-4" />,
              t: tr ? "Anında işlem" : "Instant processing",
            },
            {
              icon: <Lock className="h-4 w-4" />,
              t: tr ? "Sınırsız & ücretsiz" : "Unlimited & free",
            },
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

        {/* SSS (SEO) */}
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
                    <span className="text-slate-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
