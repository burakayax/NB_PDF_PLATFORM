import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, Trash2, Wand2 } from "lucide-react";
import {
  discardSocialToolReel,
  fetchSocialToolReels,
  queueSocialToolReel,
  type SocialPlatformId,
  type SocialQueueResult,
  type SocialToolReel,
} from "../../api/admin";
import { PlatformBadge } from "./platformBrand";

/**
 * Araç tanıtım videoları (Reels).
 *
 * Videolar önceden hazır beklemez: paylaşım zamanı yaklaşınca otomatik üretilir, paylaşıldıktan
 * sonra silinir. Burada o an hazır olan video izlenir; “Reels taslağı hazırla” gönderiyi hazırlar,
 * “Gönderi akışı”nda onaylamadan hiçbir yere gitmez.
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

type VariantKey = "profile" | "caption";

const VARIANT_INFO: Record<VariantKey, { label: string; platforms: string; note: string }> = {
  profile: {
    label: "Instagram · TikTok",
    platforms: "Instagram ve TikTok",
    note: "Son karede “Bağlantı profilde” yazar. İkisinde de açıklamadaki bağlantı tıklanmaz; bu sürüm Instagram ve TikTok taslaklarına otomatik eklenir.",
  },
  caption: {
    label: "YouTube · Facebook",
    platforms: "YouTube ve Facebook",
    note: "Son karede “Bağlantı açıklamada” yazar; açıklamadaki adres tıklanır.",
  },
};

/** Videoyu dosya olarak indirir; sunucu farklı adreste olduğundan önce içeriği çekip yerelden kaydeder. */
/**
 * TikTok kapağı: TikTok profil ızgarasında/kapak ekranında kenarları ve üst-altı kırptığı için araç kapağı
 * 1080×1920 tuvalin ortasına %72 küçültülerek yerleştirilir; çevresi kapağın kendi zemin renginden doldurulur.
 */
async function downloadTiktokCover(toolId: string): Promise<void> {
  const src = `/reel-covers/${encodeURIComponent(toolId)}.jpg`;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = 1080;
    const H = 1920;
    const S = 0.72;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const probe = document.createElement("canvas");
    probe.width = img.naturalWidth;
    probe.height = img.naturalHeight;
    const pctx = probe.getContext("2d");
    if (!pctx) throw new Error("canvas");
    pctx.drawImage(img, 0, 0);
    const rgb = (x: number, y: number) => {
      const d = pctx.getImageData(x, y, 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(4, 4));
    g.addColorStop(1, rgb(4, img.naturalHeight - 5));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const fw = Math.round(W * S);
    const fh = Math.round(H * S);
    ctx.drawImage(img, Math.round((W - fw) / 2), Math.round((H - fh) / 2), fw, fh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${toolId}-tiktok-kapak.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

async function downloadVideo(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    // Çekilemezse (ör. tarayıcı kısıtı) videoyu yeni sekmede açar; oradan "Farklı kaydet" yapılır.
    window.open(url, "_blank", "noopener");
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
  const [variantById, setVariantById] = useState<Record<string, VariantKey>>({});

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

  const readyReels = (reels ?? []).filter((r) => r.video !== null);

  async function queue(reel: SocialToolReel, platforms?: SocialPlatformId[]) {
    setBusyId(reel.id);
    setErr(null);
    try {
      const result = platforms
        ? await queueSocialToolReel(accessToken, reel.id, platforms)
        : await queueSocialToolReel(accessToken, reel.id);
      await load();
      await onQueued(result, reel.tr.title);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Taslak hazırlanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function discard(reel: SocialToolReel) {
    if (!window.confirm(`“${reel.tr.title}” videosu kaldırılsın mı? Bu videoya bağlı yayınlanmamış taslaklar silinir; araç “paylaşıldı” sayılmaz, yeniden üretilebilir.`)) return;
    setBusyId(reel.id);
    setErr(null);
    try {
      await discardSocialToolReel(accessToken, reel.id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Video kaldırılamadı");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
          Araç videoları önceden hazır tutulmaz: paylaşım zamanı yaklaşınca aracın gerçek kullanımı kaydedilerek
          üretilir, paylaşıldıktan sonra silinir. Video hazırsa burada izleyip taslağını hazırlayabilirsin (Instagram, Facebook, YouTube ve TikTok); “Gönderi
          akışı”nda onaylamadan hiçbir yere gitmez.
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

      {/* Yalnızca videosu hazır olan araçlar listelenir; hazır olmayanlar gösterilmez. */}
      {reels !== null && readyReels.length === 0 && !err ? (
        <p className="rounded-xl border border-dashed border-slate-700/60 px-4 py-6 text-center text-xs text-slate-400">
          Şu an hazır araç videosu yok. Paylaşım zamanı yaklaşınca sıradaki araç için video kendiliğinden
          üretilir ve burada görünür.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {readyReels.map((reel) => (
          <article key={reel.id} className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40">
            {(() => {
              const variant: VariantKey = variantById[reel.id] === "caption" && reel.captionVideo ? "caption" : "profile";
              const shown = variant === "caption" ? reel.captionVideo : reel.video;
              const info = VARIANT_INFO[variant];
              return (
                <>
                  {reel.captionVideo ? (
                    <div className="flex gap-1 bg-slate-950/60 p-2">
                      {(Object.keys(VARIANT_INFO) as VariantKey[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setVariantById((m) => ({ ...m, [reel.id]: k }))}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                            variant === k ? "bg-cyan-600 text-white" : "bg-slate-800/60 text-slate-300 hover:text-white"
                          }`}
                        >
                          {VARIANT_INFO[k].label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex justify-center bg-black/60 p-3">
                    {shown ? (
                      <video
                        key={shown.id}
                        className="max-h-[420px] rounded-lg"
                        style={{ aspectRatio: "9 / 16" }}
                        src={shown.url}
                        poster={`/reel-covers/${encodeURIComponent(reel.id)}.jpg`}
                        controls
                        preload="none"
                        playsInline
                      />
                    ) : null}
                  </div>
                  {shown ? (
                    <div className="space-y-2 border-t border-slate-800/70 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] leading-snug text-slate-400">
                        <span className="font-semibold text-slate-200">{info.platforms}.</span> {info.note}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {variant === "profile" ? (
                          <button
                            type="button"
                            className={ghostButton}
                            onClick={() => void downloadVideo(shown.url, `${reel.id}-tiktok.mp4`)}
                            title="Videoyu indir (TikTok bağlı değilse elle yüklemek için)"
                          >
                            <Download className="h-3.5 w-3.5" />
                            TikTok için indir
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={ghostButton}
                          onClick={() => void downloadVideo(shown.url, `${reel.id}-${variant === "caption" ? "aciklama" : "profil"}.mp4`)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {variant === "caption" ? "YouTube / Facebook için indir" : "Instagram için indir"}
                        </button>
                        <button
                          type="button"
                          className={ghostButton}
                          onClick={() => void downloadTiktokCover(reel.id)}
                          title="TikTok kapağı: ekrana sığacak şekilde kenar boşluklu 1080×1920"
                        >
                          <Download className="h-3.5 w-3.5" />
                          TikTok kapağını indir
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              );
            })()}
            <div className="space-y-3 p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{reel.tr.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{reel.tr.summary}</p>
                {reel.video && reel.video.seconds > 0 ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {reel.video.seconds} saniye · {new Date(reel.video.createdAt).toLocaleString("tr-TR")} tarihinde üretildi
                  </p>
                ) : null}
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

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel)}
                >
                  {busyId === reel.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Reels taslağı hazırla
                </button>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel, ["FACEBOOK"])}
                >
                  Yalnızca Facebook
                </button>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel, ["INSTAGRAM"])}
                >
                  Yalnızca Instagram
                </button>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel, ["YOUTUBE"])}
                >
                  Yalnızca YouTube
                </button>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel, ["TIKTOK"])}
                >
                  Yalnızca TikTok
                </button>
                <button
                  type="button"
                  className={ghostButton}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void queue(reel, ["PINTEREST"])}
                >
                  Yalnızca Pinterest
                </button>
                <button
                  type="button"
                  className={`${ghostButton} border-rose-500/40 text-rose-300 hover:border-rose-400 hover:text-rose-200`}
                  disabled={busyId !== null || !reel.video}
                  onClick={() => void discard(reel)}
                  title="Beğenmediysen videoyu kaldır; yeni video üretilebilir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Videoyu kaldır
                </button>
              </div>
              <p className="text-[11px] leading-snug text-slate-500">
                Daha önce paylaşılmış bir gönderiyi yeniden yayınlamak için de bunları kullanabilirsin; aynı gün ikinci
                taslak açılır (ilk gönderiyi ağın kendisinden silmen gerekebilir).
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
