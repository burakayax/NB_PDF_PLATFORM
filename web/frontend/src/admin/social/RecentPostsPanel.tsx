import { useState } from "react";
import { ExternalLink, Eye, Layers, Loader2, Trash2 } from "lucide-react";
import type { SocialAccountRow, SocialPlatformId, SocialPostRow } from "../../api/admin";
import { BRANDS, PlatformBadge } from "./platformBrand";
import { PostFullPreviewModal } from "./PostFullPreviewModal";
import { isVideoUrl, slidesOf } from "./PostMediaPreview";

/**
 * Son paylaşımlar — HER AĞ İÇİN AYRI son 5 gönderi (Instagram'ın son 5'i, Facebook'un
 * son 5'i …). Tek karışık liste hangi ağda ne olduğunu seçtirmiyordu.
 *
 * Her satırdan gönderinin tam önizlemesi açılır (kaydırmalı gönderide tüm slaytlar).
 */

const PLATFORM_ORDER: SocialPlatformId[] = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "X", "PINTEREST"];

function formatWhen(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Thumb({ post }: { post: SocialPostRow }) {
  const slides = slidesOf(post);
  const src = slides[0] ?? post.imageUrl;
  if (!src) return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[9px] text-slate-500">yok</span>;
  if (isVideoUrl(src)) {
    return (
      <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-950">
        <video src={`${src}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="absolute bottom-0 left-0 right-0 bg-fuchsia-600/90 text-center text-[8px] font-bold text-white">REELS</span>
      </span>
    );
  }
  return (
    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-950">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      {slides.length > 0 ? (
        <span className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl-md bg-slate-950/80 px-1 text-[9px] font-semibold text-white">
          <Layers className="h-2.5 w-2.5" />
          {slides.length}
        </span>
      ) : null}
    </span>
  );
}

export function RecentPostsPanel({
  recent,
  accounts,
  busyId,
  onRemove,
}: {
  recent: Partial<Record<SocialPlatformId, SocialPostRow[]>>;
  accounts: SocialAccountRow[];
  busyId: string | null;
  /** Kaydı panelden kaldırır (ağdaki gerçek gönderiye dokunmaz). */
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState<SocialPostRow | null>(null);
  const accountOf = (p: SocialPlatformId) => accounts.find((a) => a.platform === p);

  return (
    <div className="space-y-3">
      {PLATFORM_ORDER.map((platform) => {
        const posts = (recent[platform] ?? []).slice(0, 5);
        const brand = BRANDS[platform];
        const account = accountOf(platform);
        return (
          <section key={platform} className="rounded-2xl border border-slate-700/50 bg-slate-900/30">
            <header className="flex items-center gap-3 border-b border-slate-700/40 px-4 py-2.5">
              <PlatformBadge platform={platform} size={28} />
              <h4 className="text-sm font-semibold text-white">{brand.label}</h4>
              <span className="text-[11px] text-slate-400">
                {posts.length > 0 ? `son ${posts.length} paylaşım` : "henüz paylaşım yok"}
              </span>
              {account && !account.connected ? (
                <span className="ml-auto text-[11px] text-slate-500">hesap bağlı değil</span>
              ) : null}
            </header>

            {posts.length > 0 ? (
              <ul className="divide-y divide-slate-800/70">
                {posts.map((post) => {
                  const slides = slidesOf(post);
                  return (
                    <li key={post.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button type="button" onClick={() => setOpen(post)} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Tam önizleme">
                        <Thumb post={post} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-100">{post.title}</span>
                          <span className="block text-[11px] text-slate-400">
                            {formatWhen(post.publishedAt ?? post.scheduledAt)}
                            {slides.length > 0 ? ` · ${slides.length} slayt` : isVideoUrl(post.imageUrl) ? " · Reels" : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(post)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Önizle
                      </button>
                      {post.externalUrl ? (
                        <a
                          href={post.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                          title="Gerçek gönderiyi aç"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === post.id}
                        onClick={() => onRemove(post.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:opacity-40"
                        title="Panelden kaldır (ağdaki gönderiye dokunmaz)"
                      >
                        {busyId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}

      {open ? (
        <PostFullPreviewModal
          post={open}
          accountLabel={accountOf(open.platform)?.displayName ?? null}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
