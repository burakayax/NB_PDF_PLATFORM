import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import {
  createPinterestBoard,
  createPinterestPin,
  fetchPinterestBoardMap,
  fetchPinterestKeywords,
  fetchPinterestOverview,
  fetchPinterestPreview,
  fetchSocialToolReels,
  savePinterestBoardMap,
  savePinterestKeywords,
  selectPinterestBoard,
  type PinterestBoardMap,
  type PinterestBoardTopic,
  type PinterestOverview,
  type PinterestPinResult,
  type PinterestToolKeywords,
  type SocialToolReel,
} from "../../api/admin";

/**
 * Pinterest paylaşım ekranı (Standard erişim demosu için).
 *
 * Görünenler: bağlı hesap adı, pano seçimi (ID elle yazılmaz), pin önizlemesi (görsel, başlık,
 * açıklama, bağlantı), “Pinle” düğmesi ve başarı mesajı + pine giden bağlantı. Anahtarlar hiçbir
 * yerde gösterilmez.
 */

const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40";
const fieldClass =
  "w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40";

function absoluteLink(link: string): string {
  return link.startsWith("http") ? link : `${window.location.origin}${link.startsWith("/") ? "" : "/"}${link}`;
}

/** İçerik türüne göre pano başlıkları (Pinterest'te bu adlarla pano açılması önerilir). */
const BOARD_TOPICS: { topic: PinterestBoardTopic; label: string; hint: string }[] = [
  { topic: "cv", label: "CV Örnekleri", hint: "CV ve iş başvurusu yazıları" },
  { topic: "pdf", label: "PDF İpuçları", hint: "PDF araçları ve diğer yazılar" },
  { topic: "sozlesme", label: "Sözleşme ve Hukuk Belgeleri", hint: "Sözleşme, ihale, kira yazıları" },
];

export function PinterestShareCard({ accessToken, onChanged }: { accessToken: string; onChanged?: () => void | Promise<void> }) {
  const [overview, setOverview] = useState<PinterestOverview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reels, setReels] = useState<SocialToolReel[]>([]);

  const [boardId, setBoardId] = useState("");
  const [newBoard, setNewBoard] = useState("");
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardMsg, setBoardMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [reelId, setReelId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [altText, setAltText] = useState("");
  const [mode, setMode] = useState<"image" | "video">("image");

  // Konuya göre pano eşlemesi ve anahtar kelimeler.
  const [boardMap, setBoardMap] = useState<PinterestBoardMap>({});
  const [mapMsg, setMapMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toolKeywords, setToolKeywords] = useState<PinterestToolKeywords[]>([]);
  const [kwMain, setKwMain] = useState("");
  const [kwExtra, setKwExtra] = useState("");
  const [kwMsg, setKwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Anahtar kelime kaydedilince önizleme metinleri yeniden üretilir. */
  const [previewVersion, setPreviewVersion] = useState(0);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; pin?: PinterestPinResult } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [o, r, map, kws] = await Promise.all([
        fetchPinterestOverview(accessToken),
        fetchSocialToolReels(accessToken),
        fetchPinterestBoardMap(accessToken).catch(() => ({}) as PinterestBoardMap),
        fetchPinterestKeywords(accessToken).catch(() => [] as PinterestToolKeywords[]),
      ]);
      setOverview(o);
      setBoardId(o.boardId);
      setReels(r.reels);
      setBoardMap(map);
      setToolKeywords(kws);
      setReelId((current) => current || r.reels[0]?.id || "");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Pinterest bilgileri yüklenemedi");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const reel = reels.find((r) => r.id === reelId) ?? null;
  // Pin, "PDF" konusuna ayrılmış panoya ya da (yoksa) seçili panoya gider.
  const hasBoard = Boolean(boardId || boardMap.pdf);
  // Pin görseli: aracın dikey markalı kapağı (sitede yayında olmalı; Pinterest adresten indirir).
  const imageUrl = reel ? `${window.location.origin}/reel-covers/${encodeURIComponent(reel.id)}.jpg` : "";

  const videoUrl = reel?.video?.url ?? "";
  // Video hazır değilse görsel pine dönülür.
  useEffect(() => {
    if (!videoUrl && mode === "video") setMode("image");
  }, [videoUrl, mode]);

  // Araç değişince metinler SUNUCUDAKİ kurallarla (otomatik yayıncıyla aynı) önerilir: ana kelime başlıkta
  // başta, sonda çağrı, en çok 3 etiket, Pinterest UTM'li bağlantı. Kullanıcı sonra düzenleyebilir.
  const reelKey = reel?.id ?? "";
  useEffect(() => {
    if (!reel) return;
    let live = true;
    const fallback = () => {
      setTitle(reel.tr.title.slice(0, 100));
      setDescription(reel.tr.summary.slice(0, 800));
      setLink(absoluteLink(reel.tr.link));
      setAltText("");
    };
    fetchPinterestPreview(accessToken, reel.id)
      .then((p) => {
        if (!live) return;
        setTitle(p.title);
        setDescription(p.description);
        setLink(p.link);
        setAltText(p.altText);
      })
      .catch(() => live && fallback());
    return () => {
      live = false;
    };
    // reel nesnesi her yüklemede yenilenir; yalnız kimliği ve anahtar kelime sürümü yeniden üretimi tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelKey, previewVersion, accessToken]);

  // Seçili aracın anahtar kelime alanları: kayıtlı olan, yoksa otomatik öneri.
  useEffect(() => {
    const entry = toolKeywords.find((k) => k.id === reelKey);
    const kw = entry?.saved ?? entry?.suggested ?? null;
    setKwMain(kw?.main ?? "");
    setKwExtra((kw?.extra ?? []).join(", "));
    setKwMsg(null);
  }, [reelKey, toolKeywords]);

  async function changeBoardTopic(topic: PinterestBoardTopic, id: string) {
    const next = { ...boardMap, [topic]: id || undefined };
    setBoardMap(next);
    setMapMsg(null);
    try {
      const saved = await savePinterestBoardMap(accessToken, next);
      setBoardMap(saved);
      setMapMsg({ ok: true, text: "Pano eşlemesi kaydedildi." });
    } catch (e) {
      setMapMsg({ ok: false, text: e instanceof Error ? e.message : "Pano eşlemesi kaydedilemedi" });
      void load();
    }
  }

  async function saveKeywords(clear = false) {
    if (!reel) return;
    setKwMsg(null);
    try {
      const extra = kwExtra
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      await savePinterestKeywords(accessToken, reel.id, clear ? "" : kwMain.trim(), clear ? [] : extra);
      setToolKeywords(await fetchPinterestKeywords(accessToken));
      setPreviewVersion((v) => v + 1);
      setKwMsg({ ok: true, text: clear ? "Otomatik öneriye dönüldü." : "Anahtar kelimeler kaydedildi; başlık ve açıklama yenilendi." });
    } catch (e) {
      setKwMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi" });
    }
  }

  async function chooseBoard(id: string) {
    setBoardId(id);
    if (!id) return;
    setBoardBusy(true);
    setBoardMsg(null);
    try {
      await selectPinterestBoard(accessToken, id);
      await onChanged?.();
    } catch (e) {
      setBoardMsg({ ok: false, text: e instanceof Error ? e.message : "Pano seçilemedi" });
    } finally {
      setBoardBusy(false);
    }
  }

  async function addBoard() {
    if (!newBoard.trim()) return;
    setBoardBusy(true);
    setBoardMsg(null);
    try {
      const board = await createPinterestBoard(accessToken, newBoard.trim());
      setNewBoard("");
      // Yeni pano listede hemen görünür (Pinterest listeyi geç güncelleyebilir); sunucu da seçili yaptı.
      setOverview((o) => (o ? { ...o, boards: [...o.boards.filter((b) => b.id !== board.id), board], boardId: board.id } : o));
      setBoardId(board.id);
      setBoardMsg({ ok: true, text: `“${board.name}” panosu oluşturuldu ve seçildi.` });
      await onChanged?.();
    } catch (e) {
      setBoardMsg({ ok: false, text: e instanceof Error ? e.message : "Pano oluşturulamadı" });
    } finally {
      setBoardBusy(false);
    }
  }

  async function submit() {
    if (!hasBoard || !imageUrl || !title.trim() || !description.trim() || !link.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const pin = await createPinterestPin(accessToken, {
        ...(mode === "video" && videoUrl ? { videoUrl, toolId: reelKey } : { imageUrl }),
        title,
        description,
        link,
        altText: altText.trim() || undefined,
        kind: "arac",
        topic: "pdf",
      });
      setResult({
        ok: true,
        message: `Pin Pinterest’e gönderildi.${pin.warning ? ` ${pin.warning}` : ""}`,
        pin,
      });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Pin gönderilemedi" });
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

  if (!overview) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pinterest hesabı okunuyor…
      </p>
    );
  }

  if (overview.needsReconnect) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Pinterest bağlantısı yeniden kurulmalı: anahtar {overview.sandbox ? "gerçek Pinterest’te" : "kum havuzunda"} alınmış ya da
            “kum havuzu” kutusu değişmiş. Yukarıdaki <strong>Pinterest ile bağlan</strong> düğmesine bas, izin ver, sonra bir pano seç.
          </span>
        </p>
        <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-amber-100 underline" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3" /> Yeniden kontrol et
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
      <header>
        <p className="text-[11px] text-slate-400">Pinterest’e şu hesapla pinlenecek</p>
        <p className="text-sm font-semibold text-white">@{overview.username}</p>
        {overview.sandbox ? (
          <p className="mt-1 text-[11px] text-amber-300/90">
            Kum havuzu (Trial) açık: pinler yalnızca sana görünür. Standard onayı gelince Ayarlar’dan kapat.
          </p>
        ) : null}
      </header>

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-300">Pano</span>
          <select className={`${fieldClass} mt-1`} value={boardId} disabled={boardBusy} onChange={(e) => void chooseBoard(e.target.value)}>
            <option value="">Pano seçin…</option>
            {overview.boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {overview.boards.length === 0 ? (
          <p className="text-[11px] text-slate-500">Bu ortamda hiç pano yok. Aşağıdan yeni bir pano oluştur.</p>
        ) : null}
        <div className="flex gap-2">
          <input
            className={fieldClass}
            placeholder="Yeni pano adı (ör. PDF ipuçları)"
            value={newBoard}
            maxLength={100}
            onChange={(e) => setNewBoard(e.target.value)}
          />
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-600 px-4 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:opacity-40"
            disabled={boardBusy || !newBoard.trim()}
            onClick={() => void addBoard()}
          >
            {boardBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Pano oluştur
          </button>
        </div>
        {boardMsg ? (
          <p className={`text-[11px] leading-relaxed ${boardMsg.ok ? "text-emerald-300" : "text-rose-300"}`}>{boardMsg.text}</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-950/30 p-3">
        <p className="text-xs font-medium text-slate-300">İçerik türüne göre panolar</p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Otomatik pinler konusuna göre ilgili panoya gider. Bir konuyu boş bırakırsan yukarıda seçtiğin pano kullanılır. Panoları önce
          yukarıdan oluştur (ör. “CV Örnekleri”, “PDF İpuçları”, “Sözleşme ve Hukuk Belgeleri”).
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {BOARD_TOPICS.map(({ topic, label, hint }) => (
            <label key={topic} className="block">
              <span className="text-[11px] font-medium text-slate-300">{label}</span>
              <select
                className={`${fieldClass} mt-1`}
                value={boardMap[topic] ?? ""}
                onChange={(e) => void changeBoardTopic(topic, e.target.value)}
                title={hint}
              >
                <option value="">Seçili pano (varsayılan)</option>
                {overview.boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {mapMsg ? <p className={`text-[11px] ${mapMsg.ok ? "text-emerald-300" : "text-rose-300"}`}>{mapMsg.text}</p> : null}
      </div>

      {reels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700/60 px-4 py-5 text-center text-xs text-slate-400">
          Pinlenecek araç bulunamadı.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-300">Pin önizlemesi</p>
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-white text-slate-900">
              {mode === "video" && videoUrl ? (
                <video
                  src={videoUrl}
                  poster={imageUrl}
                  controls
                  playsInline
                  preload="none"
                  className="w-full bg-slate-200 object-cover"
                  style={{ aspectRatio: "9 / 16" }}
                />
              ) : (
                <img src={imageUrl} alt="" className="w-full bg-slate-200 object-cover" style={{ aspectRatio: "9 / 16" }} />
              )}
              <div className="space-y-0.5 p-2">
                <p className="line-clamp-2 text-xs font-semibold">{title || "Başlık"}</p>
                <p className="truncate text-[10px] text-slate-500">{link.replace(/^https?:\/\//, "")}</p>
              </div>
            </div>
            <label className="block">
              <span className="text-[11px] font-medium text-slate-300">Araç</span>
              <select className={`${fieldClass} mt-1`} value={reelId} onChange={(e) => setReelId(e.target.value)}>
                {reels.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.tr.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5 rounded-lg border border-slate-700/50 p-2">
              <p className="text-[11px] font-medium text-slate-300">Pinterest anahtar kelimeleri</p>
              <input
                className={fieldClass}
                placeholder="Ana kelime (ör. pdf sıkıştırma)"
                value={kwMain}
                maxLength={80}
                onChange={(e) => setKwMain(e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Yan kelimeler, virgülle (en çok 4)"
                value={kwExtra}
                onChange={(e) => setKwExtra(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="h-8 rounded-lg border border-slate-600 px-3 text-[11px] font-semibold text-slate-200 transition hover:border-slate-400 disabled:opacity-40"
                  disabled={!kwMain.trim()}
                  onClick={() => void saveKeywords()}
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  className="h-8 rounded-lg px-3 text-[11px] text-slate-400 underline"
                  onClick={() => void saveKeywords(true)}
                >
                  Otomatiğe dön
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Başlık bu ana kelimeyle başlar. Dokunmazsan aracın SEO başlığından türeyen öneri kullanılır.
              </p>
              {kwMsg ? <p className={`text-[11px] ${kwMsg.ok ? "text-emerald-300" : "text-rose-300"}`}>{kwMsg.text}</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-300">Pin türü</span>
              {(["image", "video"] as const).map((m) => {
                const disabled = m === "video" && !videoUrl;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(m)}
                    className={`h-8 rounded-lg border px-3 text-[11px] font-semibold transition disabled:opacity-40 ${
                      mode === m ? "border-rose-500 bg-rose-500/15 text-rose-100" : "border-slate-600 text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {m === "image" ? "Görsel pin" : "Video pin"}
                  </button>
                );
              })}
              {!videoUrl ? <span className="text-[10px] text-slate-500">Bu aracın videosu şu an hazır değil.</span> : null}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Başlık</span>
              <input className={`${fieldClass} mt-1`} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Açıklama</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-[96px] resize-y`}
                value={description}
                maxLength={800}
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="mt-0.5 block text-right text-[10px] text-slate-500">{description.length}/800</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Alt metin (görselde ne var)</span>
              <input className={`${fieldClass} mt-1`} value={altText} maxLength={500} onChange={(e) => setAltText(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Bağlantı</span>
              <input className={`${fieldClass} mt-1`} value={link} onChange={(e) => setLink(e.target.value)} />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={primaryButton}
                disabled={busy || !hasBoard || !title.trim() || !description.trim() || !link.trim()}
                onClick={() => void submit()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? (mode === "video" ? "Video yükleniyor…" : "Gönderiliyor…") : mode === "video" ? "Video pin olarak pinle" : "Pinle"}
              </button>
              {!hasBoard ? <span className="text-[11px] text-slate-500">Önce bir pano seç.</span> : null}
              {busy && mode === "video" ? (
                <span className="text-[11px] text-slate-500">Video Pinterest’e yüklenip işleniyor; bir–iki dakika sürebilir.</span>
              ) : null}
            </div>

            {result ? (
              <div
                className={`space-y-1 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                  result.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                <p className="flex items-start gap-1.5">
                  {result.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{result.message}</span>
                </p>
                {result.pin?.url ? (
                  <a className="inline-flex items-center gap-1 text-emerald-100 underline" href={result.pin.url} target="_blank" rel="noopener noreferrer">
                    Pine git <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Hatırlatma: Pinterest hesabın Instagram gönderilerini zaten otomatik pinliyor ve bu pinler Instagram’a link veriyor. Pinterest
          API canlıya geçince <strong>Pinterest ayarlarından Instagram otomatik yayınlamayı kapat</strong>; yoksa profilinde her içerik
          için ikişer pin görünür.
        </span>
      </p>
    </section>
  );
}
