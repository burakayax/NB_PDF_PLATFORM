import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Layers, Maximize2 } from "lucide-react";
import type { SocialPostRow } from "../../api/admin";
import { BRANDS } from "./platformBrand";

/**
 * Bir gönderinin MEDYASININ gerçek önizlemesi: tek görsel, video (Reels) ya da
 * kaydırmalı (carousel) gönderinin TÜM slaytları.
 *
 * NEDEN: Instagram gönderisi artık kaydırmalı çıkıyor; panel yalnızca kapağı gösterirse
 * "ne paylaşılacak" sorusu yanıtsız kalıyordu. Burada her slayt, gideceği oranda ve
 * sırada görünür.
 */

/** Reels gönderisinde "görsel" adresi aslında videodur (sunucu uzantıdan tanır). */
export function isVideoUrl(url: string | null | undefined): boolean {
  return /\.mp4(\?|$)/i.test(url ?? "");
}

/** Kaydırmalı gönderi mi? (Instagram carousel en az 2 görsel ister.) */
export function slidesOf(post: Pick<SocialPostRow, "carouselSlides">): string[] {
  return post.carouselSlides && post.carouselSlides.length >= 2 ? post.carouselSlides : [];
}

/** Önizleme oranı: carousel 4:5 (Instagram'da en çok alan), diğerleri ağın kendi oranı. */
export function previewRatio(post: Pick<SocialPostRow, "platform" | "carouselSlides">): string {
  return slidesOf(post).length > 0 ? "4 / 5" : BRANDS[post.platform].ratio;
}

/** Slayt göstergesi + ok düğmeleri olan kaydırıcı. Klavye okları da çalışır (odaktayken). */
export function SlideViewer({
  slides,
  ratio,
  index,
  onIndex,
  large = false,
  onOpen,
}: {
  slides: string[];
  ratio: string;
  index: number;
  onIndex: (next: number) => void;
  large?: boolean;
  /** Verilirse görsele tıklayınca çağrılır (büyütme). */
  onOpen?: () => void;
}) {
  const last = slides.length - 1;
  const go = (delta: number) => onIndex(Math.min(last, Math.max(0, index + delta)));
  const arrow =
    "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/70 text-white backdrop-blur transition hover:bg-slate-950 disabled:pointer-events-none disabled:opacity-0";
  const size = large ? "h-10 w-10" : "h-7 w-7";

  return (
    <div
      className="relative w-full select-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="block w-full overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950"
        style={{ aspectRatio: ratio }}
        title={onOpen ? "Tam önizleme" : undefined}
      >
        <img
          key={slides[index]}
          src={slides[index]}
          alt={`Slayt ${index + 1} / ${slides.length}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </button>

      <button type="button" className={`${arrow} ${size} left-1.5`} onClick={() => go(-1)} disabled={index === 0} aria-label="Önceki slayt">
        <ChevronLeft className={large ? "h-6 w-6" : "h-4 w-4"} />
      </button>
      <button type="button" className={`${arrow} ${size} right-1.5`} onClick={() => go(1)} disabled={index === last} aria-label="Sonraki slayt">
        <ChevronRight className={large ? "h-6 w-6" : "h-4 w-4"} />
      </button>

      <span className="absolute right-2 top-2 rounded-full bg-slate-950/75 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white">
        {index + 1}/{slides.length}
      </span>

      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden>
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-cyan-400" : "w-1.5 bg-slate-600"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Kart içindeki medya önizlemesi — küçük ama TAM: tüm slaytlar kaydırılabilir. */
export function PostMediaPreview({
  post,
  onOpen,
}: {
  post: SocialPostRow;
  /** "Tam önizleme" penceresini açar. */
  onOpen: () => void;
}) {
  const slides = slidesOf(post);
  const [index, setIndex] = useState(0);
  // Slayt listesi değişirse (yeni veri) başa dön.
  useEffect(() => setIndex(0), [post.id, slides.length]);

  const ratio = previewRatio(post);
  const brand = BRANDS[post.platform];

  if (slides.length > 0) {
    return (
      <div className="w-44 shrink-0">
        <SlideViewer slides={slides} ratio={ratio} index={index} onIndex={setIndex} onOpen={onOpen} />
        <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-fuchsia-300">
          <Layers className="h-3 w-3" />
          Kaydırmalı gönderi · {slides.length} slayt
        </p>
      </div>
    );
  }

  if (!post.imageUrl) {
    return (
      <div
        className="flex w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-amber-300/70"
        style={{ aspectRatio: brand.ratio, maxHeight: 190 }}
      >
        <ImageOff className="h-4 w-4" />
        <span className="text-[10px]">Görselsiz</span>
      </div>
    );
  }

  const video = isVideoUrl(post.imageUrl);
  return (
    <button type="button" onClick={onOpen} className="group relative block w-36 shrink-0" title={video ? "Videoyu izle" : "Tam önizleme"}>
      {video ? (
        <>
          <video
            src={`${post.imageUrl}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            className="w-full rounded-xl border border-slate-700/60 bg-slate-950 object-cover transition group-hover:border-slate-500"
            style={{ aspectRatio: "9 / 16", maxHeight: 190 }}
          />
          <span className="absolute left-1.5 top-1.5 rounded-md bg-fuchsia-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            REELS
          </span>
        </>
      ) : (
        <img
          src={post.imageUrl}
          alt=""
          loading="lazy"
          className="w-full rounded-xl border border-slate-700/60 object-cover transition group-hover:border-slate-500"
          // Dikey kesim (Pinterest) kartı gereksiz uzatmasın: yükseklik sınırlı, oran doğru.
          style={{ aspectRatio: brand.ratio, maxHeight: 190 }}
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/40 group-hover:opacity-100">
        <Maximize2 className="h-5 w-5 text-white" />
      </span>
    </button>
  );
}
