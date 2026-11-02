import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import {
  createPinterestBoard,
  createPinterestPin,
  fetchPinterestBoardRules,
  fetchPinterestBoardSetup,
  fetchPinterestKeywords,
  fetchPinterestOverview,
  fetchPinterestPreview,
  fetchSocialToolReels,
  savePinterestKeywords,
  selectPinterestBoard,
  setPinterestBoardMap,
  syncPinterestBoards,
  type PinterestBoardChoice,
  type PinterestBoardRules,
  type PinterestBoardSetup,
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

const SOURCE_LABEL: Record<string, string> = {
  kayıtlı: "Bağlı",
  "adla bulundu": "Adla bulundu (henüz bağlanmadı)",
  eksik: "Eksik",
};

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

  // Altı konu panosunun kurulumu (eşleştirme / eksikleri oluşturma) ve eşleştirme kuralları.
  const [setup, setSetup] = useState<PinterestBoardSetup | null>(null);
  const [setupMsg, setSetupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [rules, setRules] = useState<PinterestBoardRules | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [previewBoard, setPreviewBoard] = useState<PinterestBoardChoice | null>(null);
  // Anahtar kelimeler.
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
      const [o, r, boardSetup, kws] = await Promise.all([
        fetchPinterestOverview(accessToken),
        fetchSocialToolReels(accessToken),
        fetchPinterestBoardSetup(accessToken).catch(() => null),
        fetchPinterestKeywords(accessToken).catch(() => [] as PinterestToolKeywords[]),
      ]);
      setOverview(o);
      setBoardId(o.boardId);
      setReels(r.reels);
      setSetup(boardSetup);
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
  // Pin, konusuna ayrılmış panoya ya da (eşleşme yoksa) seçili tek panoya gider.
  const hasBoard = Boolean(boardId || setup?.rows.some((row) => row.boardId));
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
        setPreviewBoard(p.board);
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

  async function runSync(createMissing: boolean) {
    setSetupBusy(true);
    setSetupMsg(null);
    setConfirmCreate(false);
    try {
      const next = await syncPinterestBoards(accessToken, createMissing);
      setSetup(next);
      const made = next.created?.length ?? 0;
      setSetupMsg({
        ok: true,
        text: createMissing
          ? made > 0
            ? `${made} pano oluşturuldu ve bağlandı.`
            : "Oluşturulacak eksik pano yoktu; bulunanlar bağlandı."
          : "Adla bulunan panolar bağlandı. Eksik olanlar için “Eksik panoları oluştur”a bas.",
      });
      await load();
    } catch (e) {
      setSetupMsg({ ok: false, text: e instanceof Error ? e.message : "Panolar eşleştirilemedi" });
    } finally {
      setSetupBusy(false);
    }
  }

  async function changeBoardFor(key: string, id: string) {
    if (!id) return;
    setSetupMsg(null);
    try {
      await setPinterestBoardMap(accessToken, key, id);
      setSetup(await fetchPinterestBoardSetup(accessToken));
      setSetupMsg({ ok: true, text: "Pano değiştirildi." });
    } catch (e) {
      setSetupMsg({ ok: false, text: e instanceof Error ? e.message : "Pano değiştirilemedi" });
    }
  }

  async function toggleRules() {
    const next = !showRules;
    setShowRules(next);
    if (next && !rules) {
      try {
        setRules(await fetchPinterestBoardRules(accessToken));
      } catch (e) {
        setSetupMsg({ ok: false, text: e instanceof Error ? e.message : "Kurallar okunamadı" });
      }
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
      });
      setResult({
        ok: true,
        message: `Pin Pinterest’e gönderildi${pin.board ? ` → “${pin.board.name}” panosu (${pin.board.reason})` : ""}.${pin.warning ? ` ${pin.warning}` : ""}`,
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
        <p className="text-xs font-medium text-slate-300">Konuya göre panolar (otomatik seçilir)</p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Her pin, konusuna göre bu 6 panodan birine kendiliğinden gider. Önce hesaptaki panolar adla bulunur; eksik olanları senin
          onayınla oluşturulur. Seçilen pano ve nedeni her gönderinin yanında görünür.
        </p>
        {setup?.envMismatch ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              “Kum havuzu” kutusu değişti: panolar başka ortamda eşleştirilmişti ve burada geçmez.{" "}
              {setup.sandbox ? "Kum havuzu" : "Gerçek hesap"} için aşağıdan <strong>Panoları eşleştir</strong> ve gerekirse{" "}
              <strong>Eksik panoları oluştur</strong> yap.
            </span>
          </p>
        ) : null}
        {setup ? (
          <div className="space-y-1.5">
            {setup.rows.map((row) => (
              <div key={row.key} className="grid items-center gap-2 md:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="text-[12px] font-medium text-slate-200">{row.name}</p>
                  <p className={`text-[10px] ${row.source === "eksik" ? "text-amber-300" : row.source === "kayıtlı" ? "text-emerald-300" : "text-slate-400"}`}>
                    {SOURCE_LABEL[row.source] ?? row.source}
                  </p>
                </div>
                <select
                  className={fieldClass}
                  value={row.boardId ?? ""}
                  onChange={(e) => void changeBoardFor(row.key, e.target.value)}
                  disabled={setupBusy}
                >
                  <option value="">{row.source === "eksik" ? "Henüz yok" : "Seç…"}</option>
                  {overview.boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Pano durumu okunamadı.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-600 px-4 text-xs font-semibold text-slate-200 transition hover:border-slate-400 disabled:opacity-40"
            disabled={setupBusy}
            onClick={() => void runSync(false)}
          >
            {setupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Panoları eşleştir
          </button>
          {setup && setup.missingCount > 0 ? (
            confirmCreate ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100">
                {setup.missingCount} pano Pinterest’te herkese açık oluşturulacak. Onaylıyor musun?
                <button type="button" className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white" disabled={setupBusy} onClick={() => void runSync(true)}>
                  Evet, oluştur
                </button>
                <button type="button" className="underline" onClick={() => setConfirmCreate(false)}>
                  Vazgeç
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
                disabled={setupBusy}
                onClick={() => setConfirmCreate(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Eksik panoları oluştur ({setup.missingCount})
              </button>
            )
          ) : null}
          <button type="button" className="text-[11px] text-slate-400 underline" onClick={() => void toggleRules()}>
            {showRules ? "Eşleştirme kurallarını gizle" : "Eşleştirme kurallarını göster"}
          </button>
        </div>
        {setupMsg ? <p className={`text-[11px] ${setupMsg.ok ? "text-emerald-300" : "text-rose-300"}`}>{setupMsg.text}</p> : null}
        {setup?.sandbox ? (
          <p className="text-[11px] leading-relaxed text-amber-300/90">
            Kum havuzu açık: bu panolar test ortamında oluşur. Canlıya geçince (kutu kapanınca) aynı eşleştirmeyi gerçek hesapta bir kez daha yapman gerekir; panel
            seni uyaracak.
          </p>
        ) : null}
        {showRules && rules ? (
          <div className="space-y-2 rounded-lg border border-slate-700/50 p-2 text-[11px] text-slate-300">
            <p className="font-medium text-slate-200">Sıra: elle seçim → araç → blog kategorisi/etiketi → başlık+açıklama anahtar kelimesi → varsayılan ({rules.boards[rules.defaultBoard]?.name})</p>
            {Object.entries(rules.boards).map(([key, board]) => {
              const toolList = rules.tools.filter((x) => x.board === key).map((x) => x.slug);
              const cat = rules.categoryRules.find((r) => r.board === key)?.terms ?? [];
              const kw = rules.keywordRules.filter((r) => r.board === key).flatMap((r) => r.terms);
              return (
                <div key={key} className="rounded-md bg-slate-900/60 p-2">
                  <p className="font-semibold text-slate-100">{board.name}</p>
                  {toolList.length ? <p><span className="text-slate-500">Araçlar:</span> {toolList.join(", ")}</p> : null}
                  {cat.length ? <p><span className="text-slate-500">Blog kategorisi/etiketi:</span> {cat.join(", ")}</p> : null}
                  {kw.length ? <p><span className="text-slate-500">Başlık/açıklama kelimeleri:</span> {kw.join(", ")}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}
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
            {previewBoard ? (
              <p className="rounded-lg border border-slate-700/50 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-300">
                Gideceği pano: <strong className="text-slate-100">{previewBoard.name}</strong>
                <span className="text-slate-500"> · neden: {previewBoard.reason}</span>
              </p>
            ) : null}
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
