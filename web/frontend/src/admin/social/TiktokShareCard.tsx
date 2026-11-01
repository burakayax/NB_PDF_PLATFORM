import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, Send } from "lucide-react";
import {
  fetchSocialToolReels,
  fetchTiktokCreator,
  shareToTiktok,
  type SocialToolReel,
  type TiktokCreator,
} from "../../api/admin";

/**
 * TikTok paylaşım ekranı (TikTok Direct Post kurallarına uygun).
 *
 * Kurallar: bağlı hesabın adı ve fotoğrafı görünür; video paylaşımdan önce önizlenir; açıklama
 * düzenlenebilir; gizlilik düzeyi VARSAYILANLA VERİLMEZ, kullanıcı kendisi seçer (seçenekler TikTok’un
 * “creator_info” yanıtından gelir); yorum/düet/stitch izinleri kapalı başlar; tanıtım işareti ve müzik
 * kullanımı onayı görünür. Denetimden önce TikTok yalnızca “Yalnız ben” seçeneğini sunar.
 */

const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Herkes",
  MUTUAL_FOLLOW_FRIENDS: "Karşılıklı takipleştiklerim",
  FOLLOWER_OF_CREATOR: "Takipçilerim",
  SELF_ONLY: "Yalnız ben",
};

const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40";
const fieldClass =
  "w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40";

/** Açıklama önerisi: aracın kendi başlığı + özeti + son karedeki yönlendirme. */
function suggestedCaption(reel: SocialToolReel): string {
  return `${reel.tr.title}\n\n${reel.tr.summary}\n\nBağlantı profilde: pdfplatform.app`;
}

export function TiktokShareCard({ accessToken }: { accessToken: string }) {
  const [creator, setCreator] = useState<TiktokCreator | null>(null);
  const [brandDefault, setBrandDefault] = useState(true);
  const [reels, setReels] = useState<SocialToolReel[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [reelId, setReelId] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(true);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [c, r] = await Promise.all([fetchTiktokCreator(accessToken), fetchSocialToolReels(accessToken)]);
      setCreator(c.creator);
      setBrandDefault(c.brandOrganic);
      setBrandOrganic(c.brandOrganic);
      const ready = r.reels.filter((x) => x.video !== null);
      setReels(ready);
      setReelId((current) => current || ready[0]?.id || "");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "TikTok bilgileri yüklenemedi");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const reel = reels.find((r) => r.id === reelId) ?? null;
  // TikTok videosu “Bağlantı profilde” sürümüdür (video alanı).
  const video = reel?.video ?? null;

  // Video değişince açıklama önerisi yenilenir (kullanıcı değiştirmediyse üzerine yazılır).
  useEffect(() => {
    if (reel) setCaption(suggestedCaption(reel));
  }, [reel]);

  async function submit() {
    if (!video || !privacy || !caption.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await shareToTiktok(accessToken, {
        videoUrl: video.url,
        title: caption,
        privacy,
        brandOrganic,
        allowComment,
        allowDuet,
        allowStitch,
      });
      const where = r.privacy === "SELF_ONLY" ? "TikTok’ta Profil → Gizli videolar altında" : "TikTok profilinde";
      setResult({
        ok: true,
        message: `Video TikTok’a gönderildi (durum: ${r.status}). ${where} görünür. ${r.warning ?? ""}`.trim(),
      });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Paylaşılamadı" });
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{loadErr}</span>
        </p>
        <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-rose-100 underline" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" /> Tekrar dene
        </button>
      </div>
    );
  }

  if (!creator) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> TikTok hesabı okunuyor…
      </p>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
      <header className="flex items-center gap-3">
        {creator.avatarUrl ? (
          <img src={creator.avatarUrl} alt="" className="h-11 w-11 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-slate-800" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400">TikTok’a şu hesapla paylaşılacak</p>
          <p className="truncate text-sm font-semibold text-white">{creator.nickname || "TikTok hesabı"}</p>
        </div>
      </header>

      {reels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700/60 px-4 py-5 text-center text-xs text-slate-400">
          Şu an hazır araç videosu yok. “Araç videoları” sekmesinde video hazır olunca burada seçilebilir.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {video ? (
              <video
                key={video.id}
                className="w-full rounded-lg bg-black"
                style={{ aspectRatio: "9 / 16" }}
                src={video.url}
                poster={reel ? `/reel-covers/${encodeURIComponent(reel.id)}.jpg` : undefined}
                controls
                preload="metadata"
                playsInline
              />
            ) : null}
            <label className="block">
              <span className="text-[11px] font-medium text-slate-300">Video</span>
              <select className={`${fieldClass} mt-1`} value={reelId} onChange={(e) => setReelId(e.target.value)}>
                {reels.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.tr.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Açıklama</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-[120px] resize-y`}
                value={caption}
                maxLength={2200}
                onChange={(e) => setCaption(e.target.value)}
              />
              <span className="mt-0.5 block text-right text-[10px] text-slate-500">{caption.length}/2200</span>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-300">Bu videoyu kimler görebilir? (zorunlu)</span>
              <select className={`${fieldClass} mt-1`} value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
                <option value="">Seçin…</option>
                {creator.privacyOptions.map((o) => (
                  <option key={o} value={o}>
                    {PRIVACY_LABEL[o] ?? o}
                  </option>
                ))}
              </select>
              {creator.privacyOptions.length === 1 && creator.privacyOptions[0] === "SELF_ONLY" ? (
                <span className="mt-0.5 block text-[11px] text-amber-300/90">
                  Uygulama TikTok denetiminden geçene kadar yalnızca “Yalnız ben” seçilebilir.
                </span>
              ) : null}
            </label>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-slate-300">Etkileşim izinleri</legend>
              {(
                [
                  { label: "Yorumlara izin ver", value: allowComment, set: setAllowComment, off: creator.commentDisabled },
                  { label: "Düete izin ver", value: allowDuet, set: setAllowDuet, off: creator.duetDisabled },
                  { label: "Stitch’e izin ver", value: allowStitch, set: setAllowStitch, off: creator.stitchDisabled },
                ] as const
              ).map((t) => (
                <label key={t.label} className={`flex items-center gap-2 text-xs ${t.off ? "text-slate-600" : "text-slate-300"}`}>
                  <input
                    type="checkbox"
                    checked={t.value && !t.off}
                    disabled={t.off}
                    onChange={(e) => t.set(e.target.checked)}
                  />
                  {t.label}
                  {t.off ? <span className="text-[10px]">(hesap ayarında kapalı)</span> : null}
                </label>
              ))}
            </fieldset>

            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" className="mt-0.5" checked={brandOrganic} onChange={(e) => setBrandOrganic(e.target.checked)} />
              <span>
                Bu video kendi markamızı tanıtıyor
                <span className="block text-[11px] text-slate-500">
                  İşaretliyse TikTok videoya “Tanıtım içeriği” etiketi koyar{brandDefault ? " (varsayılan: açık)" : ""}.
                </span>
              </span>
            </label>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Paylaş’a basarak{" "}
              <a
                className="text-cyan-300 underline"
                href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                target="_blank"
                rel="noopener noreferrer"
              >
                TikTok Müzik Kullanımı Onayı
              </a>
              {brandOrganic ? (
                <>
                  {" "}
                  ve{" "}
                  <a
                    className="text-cyan-300 underline"
                    href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Markalı İçerik Politikası
                  </a>
                </>
              ) : null}
              ’nı kabul etmiş olursun. Video yüklenip işlenene kadar yaklaşık bir dakika sürebilir.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={primaryButton} disabled={busy || !video || !privacy || !caption.trim()} onClick={() => void submit()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Gönderiliyor…" : "TikTok’ta paylaş"}
              </button>
              {!privacy ? <span className="text-[11px] text-slate-500">Önce gizlilik düzeyini seç.</span> : null}
            </div>

            {result ? (
              <p
                className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                  result.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                {result.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{result.message}</span>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
