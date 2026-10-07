import { useEffect, useState } from "react";
import { Download, ExternalLink, Layers, X } from "lucide-react";
import type { SocialPostRow } from "../../api/admin";
import { BRANDS, PlatformBadge } from "./platformBrand";
import { SlideViewer, isVideoUrl, previewRatio, slidesOf } from "./PostMediaPreview";

/**
 * TAM ÖNİZLEME: gönderi, platformda görüneceği düzende — başlık satırı, medya (tüm
 * slaytlarıyla) ve metnin TAMAMI. Kırpma yok; ne yazıldıysa o.
 *
 * Bu bir simülasyondur, platformun birebir kopyası değil: ağlar metni "devamını gör"
 * ile kısaltabilir. Burada o kısaltma YOK; sistemin gönderdiği tam metin görünür.
 */
export function PostFullPreviewModal({
  post,
  accountLabel,
  onClose,
}: {
  post: SocialPostRow;
  /** Hesap adı (varsa), örn. "@pdfplatform". */
  accountLabel?: string | null;
  onClose: () => void;
}) {
  const slides = slidesOf(post);
  const [index, setIndex] = useState(0);
  const brand = BRANDS[post.platform];
  const video = isVideoUrl(post.imageUrl);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, slides.length]);

  const current = slides.length > 0 ? slides[index] : post.imageUrl;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/90 p-4 sm:p-8" onClick={onClose} role="presentation">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tam önizleme"
      >
        {/* Başlık satırı: platform + hesap. */}
        <div className="flex items-center gap-3 border-b border-slate-700/50 px-4 py-3">
          <PlatformBadge platform={post.platform} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{accountLabel || brand.label}</p>
            <p className="text-[11px] text-slate-400">
              {brand.label}
              {slides.length > 0 ? ` · kaydırmalı gönderi (${slides.length} slayt)` : video ? " · Reels" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Medya */}
        <div className="bg-slate-950 p-3">
          {slides.length > 0 ? (
            <SlideViewer slides={slides} ratio={previewRatio(post)} index={index} onIndex={setIndex} large />
          ) : post.imageUrl && video ? (
            <video src={post.imageUrl} controls playsInline className="max-h-[70vh] w-full rounded-xl bg-black object-contain" />
          ) : post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt=""
              className="w-full rounded-xl border border-slate-700/60 object-cover"
              style={{ aspectRatio: brand.ratio }}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-8 text-center text-xs text-amber-300/80">
              Bu gönderide görsel yok; yalnızca metin paylaşılır.
            </p>
          )}
        </div>

        {/* Metnin TAMAMI */}
        <div className="space-y-3 px-4 py-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{post.body}</p>
          <p className="text-[11px] text-slate-400">
            {post.body.length} karakter
            {post.publishedAt ? ` · paylaşıldı ${new Date(post.publishedAt).toLocaleString("tr-TR")}` : ""}
          </p>
          {slides.length > 0 ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 px-3 py-2 text-[11px] text-fuchsia-200/90">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              Slaytlar yazının adımlarından üretilir; gönderinin tüm slaytları yukarıda sırasıyla görünür.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/50 px-4 py-3">
          {current ? (
            <a
              href={current}
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              {slides.length > 0 ? `Slayt ${index + 1}'i indir` : video ? "Videoyu indir" : "Görseli indir"}
            </a>
          ) : null}
          {post.externalUrl ? (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Gerçek gönderiyi aç
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
