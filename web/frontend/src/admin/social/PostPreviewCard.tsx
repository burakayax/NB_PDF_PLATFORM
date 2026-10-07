import { useState } from "react";
import { AlertTriangle, Check, CheckCheck, ClipboardCheck, Copy, Download, ExternalLink, Eye, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import type { SocialPlatformSpec, SocialPostRow } from "../../api/admin";
import { BRANDS, PlatformBadge } from "./platformBrand";
import { PostFullPreviewModal } from "./PostFullPreviewModal";
import { PostMediaPreview } from "./PostMediaPreview";

/**
 * Bir gönderinin panel içindeki hâli: yayına gideceği biçimde önizleme.
 *
 * NEDEN ÖNİZLEME: Metin ve görsel ayrı alanlarda gidiyor. Admin'in "ne
 * paylaşılacak" sorusunu yayından önce gözüyle yanıtlayabilmesi gerekiyor —
 * özellikle görselin doğru orandan (Instagram kare, Pinterest dikey) geldiğini.
 */

type Status = SocialPostRow["status"];

const STATUS_META: Record<Status, { label: string; className: string }> = {
  DRAFT: { label: "Onay bekliyor", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  QUEUED: { label: "Sırada", className: "border-slate-600/50 bg-slate-800/70 text-slate-300" },
  PUBLISHING: { label: "Gönderiliyor", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" },
  PUBLISHED: { label: "Paylaşıldı", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
  FAILED: { label: "Başarısız", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
  SKIPPED: { label: "Atlandı", className: "border-slate-600/50 bg-slate-800/70 text-slate-400" },
  MANUAL: { label: "Elle paylaş", className: "border-violet-500/30 bg-violet-500/10 text-violet-200" },
};

const iconButton =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-40";

function formatWhen(value: string): string {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Karakter doluluk çubuğu — sınıra yaklaşınca renk değiştirir. */
function CharMeter({ used, max }: { used: number; max: number }) {
  const ratio = Math.min(1, used / max);
  const tone = ratio > 1 ? "bg-rose-500" : ratio > 0.92 ? "bg-amber-400" : "bg-cyan-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-700/70">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className={`tabular-nums text-[11px] ${used > max ? "text-rose-300" : "text-slate-400"}`}>
        {used}/{max}
      </span>
    </div>
  );
}

export function PostPreviewCard({
  post,
  spec,
  busyId,
  onPublish,
  onDelete,
  onSaveBody,
  onMarkShared,
  accountLabel,
}: {
  post: SocialPostRow;
  spec: SocialPlatformSpec | undefined;
  busyId: string | null;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveBody: (id: string, body: string) => void;
  /** Elle paylaşılan gönderiyi "paylaşıldı" saymak için (yalnızca MANUAL). */
  onMarkShared?: (id: string) => void;
  /** Tam önizlemede başlık satırında gösterilen hesap adı. */
  accountLabel?: string | null;
}) {
  const [draft, setDraft] = useState(post.body);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * Elle paylaşım için metni panoya alır.
   *
   * NEDEN: Henüz bağlanmamış ağlara (ya da bağlantı sorunu olan bir ağa)
   * gönderiyi elle atmak gerekebiliyor. Metni kart içinden seçmek, etiketleri
   * ve satır sonlarını bozmadan kopyalamayı zorlaştırıyor.
   */
  async function copyBody() {
    try {
      await navigator.clipboard.writeText(post.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kal: metin zaten ekranda seçilebilir durumda.
    }
  }
  /**
   * İndirilen görselin adı: "instagram-pdf-birlestirme.jpg" gibi. Aynı yazının
   * beş ağdaki kesimi aynı klasöre inince, adı olmayan dosyalar birbirine
   * karışıyordu.
   */
  function imageFileName(): string {
    const slug = post.title
      .toLocaleLowerCase("tr")
      .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const ext = (post.imageUrl?.split("?")[0]?.split(".").pop() ?? "jpg").slice(0, 4);
    return `${post.platform.toLowerCase()}-${slug || "gonderi"}.${ext}`;
  }

  const brand = BRANDS[post.platform];
  const status = STATUS_META[post.status];
  const manual = post.status === "MANUAL";
  const editable = post.status === "DRAFT" || post.status === "QUEUED" || post.status === "FAILED" || manual;
  const maxChars = spec?.maxChars ?? 2000;
  const busy = busyId === post.id;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 transition hover:border-slate-600"
      style={{ boxShadow: "0 1px 0 0 rgba(255,255,255,0.03) inset" }}
    >
      {/* Platform rengi: kartın sol kenarında ince bir şerit. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: brand.background }} />

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 px-4 py-3 pl-5">
        <PlatformBadge platform={post.platform} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{brand.label}</p>
          <p className="truncate text-[11px] text-slate-400">{post.title}</p>
        </div>
        <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
          {post.status === "PUBLISHING" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {status.label}
            </span>
          ) : (
            status.label
          )}
        </span>
      </div>

      <div className="flex gap-4 px-4 py-4 pl-5">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                className="min-h-[150px] w-full resize-y rounded-xl border border-cyan-500/40 bg-slate-950/60 px-3.5 py-3 text-sm leading-relaxed text-slate-100 outline-none ring-2 ring-cyan-500/15"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <CharMeter used={draft.length} max={maxChars} />
                <div className="flex gap-2">
                  <button type="button" className={iconButton} onClick={() => { setDraft(post.body); setEditing(false); }}>
                    <X className="h-3.5 w-3.5" />
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
                    disabled={busy || !draft.trim()}
                    onClick={() => { onSaveBody(post.id, draft); setEditing(false); }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{post.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <CharMeter used={post.body.length} max={maxChars} />
                <span className="text-[11px] text-slate-400">
                  {post.publishedAt
                    ? `Paylaşıldı · ${formatWhen(post.publishedAt)}`
                    : `Planlandı · ${formatWhen(post.scheduledAt)}`}
                </span>
                {post.attempts > 1 ? (
                  <span className="text-[11px] text-slate-400">{post.attempts}. deneme</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Medyanın GERÇEK önizlemesi: kaydırmalı gönderide tüm slaytlar, Reels'te video.
            Tıklayınca platformdaki düzeniyle tam önizleme açılır. */}
        <PostMediaPreview post={post} onOpen={() => setZoomed(true)} />
      </div>

      {post.lastError ? (
        <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{post.lastError}</span>
        </p>
      ) : null}

      {!editing ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/40 px-4 py-2.5 pl-5">
          {/* Kopyalama ve indirme HER durumda açık: paylaşılmış bir gönderinin
              metnini/görselini başka bir ağa elle taşımak en sık yapılan iş. */}
          <button type="button" className={iconButton} onClick={() => void copyBody()}>
            {copied ? (
              <ClipboardCheck className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopyalandı" : "Metni kopyala"}
          </button>
          <button type="button" className={iconButton} onClick={() => setZoomed(true)}>
            <Eye className="h-3.5 w-3.5" />
            Tam önizleme
          </button>
          {post.imageUrl ? (
            <a
              className={iconButton}
              href={post.imageUrl}
              download={imageFileName()}
              // Görsel kendi alan adımızdan geliyor; indirme dosya olarak iner.
            >
              <Download className="h-3.5 w-3.5" />
              Görseli indir
            </a>
          ) : null}

          {manual ? (
            <>
              <button type="button" className={iconButton} disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Metni düzenle
              </button>
              {onMarkShared ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
                  disabled={busy}
                  onClick={() => onMarkShared(post.id)}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                  Paylaştım
                </button>
              ) : null}
            </>
          ) : editable ? (
            <>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-600/90 px-3 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
                disabled={busy}
                onClick={() => onPublish(post.id)}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Şimdi paylaş
              </button>
              <button type="button" className={iconButton} disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Metni düzenle
              </button>
            </>
          ) : post.externalUrl ? (
            <a className={iconButton} href={post.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Gönderiyi aç
            </a>
          ) : null}

          {editable ? (
            <button
              type="button"
              className={`${iconButton} ml-auto text-rose-300 hover:border-rose-500/50 hover:text-rose-200`}
              disabled={busy}
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          ) : (
            <span className="ml-auto text-[11px] text-slate-400">Yayınlanmış gönderi düzenlenemez.</span>
          )}
        </div>
      ) : null}

      {zoomed ? (
        <PostFullPreviewModal post={post} accountLabel={accountLabel} onClose={() => setZoomed(false)} />
      ) : null}
    </article>
  );
}
