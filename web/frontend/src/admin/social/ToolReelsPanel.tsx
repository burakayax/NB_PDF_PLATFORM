import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, RefreshCw, Wand2 } from "lucide-react";
import {
  fetchSocialToolReels,
  queueSocialToolReel,
  type SocialQueueResult,
  type SocialToolReel,
} from "../../api/admin";
import { PlatformBadge } from "./platformBrand";

/**
 * Araç tanıtım videoları: izle, Instagram + Facebook Reels taslağı hazırla.
 *
 * Taslak hazırlanınca video "Gönderi akışı"na düşer; orada metni düzeltip
 * "Şimdi paylaş" denmeden hiçbir yere gitmez.
 */

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  QUEUED: "Sırada",
  PUBLISHING: "Yayınlanıyor",
  PUBLISHED: "Paylaşıldı",
  FAILED: "Hata",
  SKIPPED: "Atlandı",
  MANUAL: "Elle paylaşılacak",
};

const ghostButton =
  "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/50 px-3.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-40";
const primaryButton =
  "inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-xs font-semibold text-white shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-500 disabled:opacity-40";

/** Video adresini bu sitenin kendi yoluna indirger: panel hangi adreste açıksa orada oynar. */
function playablePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function ToolReelsPanel({
  accessToken,
  onQueued,
}: {
  accessToken: string;
  /** Taslaklar hazırlanınca: üst panel listeyi yenileyip sonucu gösterir. */
  onQueued: (result: SocialQueueResult, title: string) => Promise<void> | void;
}) {
  const [reels, setReels] = useState<SocialToolReel[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReels((await fetchSocialToolReels(accessToken)).reels);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Videolar yüklenemedi");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function queue(reel: SocialToolReel) {
    setBusyId(reel.id);
    setErr(null);
    try {
      const result = await queueSocialToolReel(accessToken, reel.id);
      await load();
      await onQueued(result, reel.tr.title);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Taslak hazırlanamadı");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
          Araçların tanıtım videoları. Birini seçip “Reels taslağı hazırla” dediğinde Instagram ve Facebook için
          metin yazılır; “Gönderi akışı”nda okuyup onaylamadan hiçbir yere gitmez.
        </p>
        <button type="button" className={ghostButton} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Yenile
        </button>
      </div>

      {err ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200">{err}</p> : null}

      {reels === null && !err ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Videolar yükleniyor…
        </p>
      ) : null}

      {reels !== null && reels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700/60 p-8 text-center">
          <Film className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-2 text-sm font-medium text-slate-300">Henüz araç videosu yok</p>
          <p className="mt-1 text-xs text-slate-500">Videolar sitenin “arac-videolari” klasörüne eklenir.</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {(reels ?? []).map((reel) => (
          <article key={reel.id} className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40">
            <div className="flex justify-center bg-black/60 p-3">
              <video
                className="max-h-[420px] rounded-lg"
                style={{ aspectRatio: "9 / 16" }}
                src={playablePath(reel.videoUrl)}
                controls
                preload="metadata"
                playsInline
              />
            </div>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{reel.tr.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{reel.tr.summary}</p>
                {reel.seconds > 0 ? <p className="mt-1 text-[11px] text-slate-500">{reel.seconds} saniye</p> : null}
              </div>

              {reel.posts.length > 0 ? (
                <ul className="space-y-1.5">
                  {reel.posts.slice(0, 4).map((p, i) => (
                    <li key={`${p.platform}-${p.createdAt}-${i}`} className="flex items-center gap-2 text-xs text-slate-300">
                      <PlatformBadge platform={p.platform} size={22} />
                      <span className="font-medium">{STATUS_LABEL[p.status] ?? p.status}</span>
                      <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString("tr-TR")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Henüz paylaşım için hazırlanmadı.</p>
              )}

              <button
                type="button"
                className={primaryButton}
                disabled={busyId !== null}
                onClick={() => void queue(reel)}
              >
                {busyId === reel.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Reels taslağı hazırla
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
