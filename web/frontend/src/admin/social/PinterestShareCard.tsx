import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import {
  createPinterestBoard,
  createPinterestPin,
  fetchPinterestOverview,
  fetchSocialToolReels,
  selectPinterestBoard,
  type PinterestOverview,
  type PinterestPinResult,
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

export function PinterestShareCard({ accessToken, onChanged }: { accessToken: string; onChanged?: () => void | Promise<void> }) {
  const [overview, setOverview] = useState<PinterestOverview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reels, setReels] = useState<SocialToolReel[]>([]);

  const [boardId, setBoardId] = useState("");
  const [newBoard, setNewBoard] = useState("");
  const [boardBusy, setBoardBusy] = useState(false);

  const [reelId, setReelId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; pin?: PinterestPinResult } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [o, r] = await Promise.all([fetchPinterestOverview(accessToken), fetchSocialToolReels(accessToken)]);
      setOverview(o);
      setBoardId(o.boardId);
      setReels(r.reels);
      setReelId((current) => current || r.reels[0]?.id || "");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Pinterest bilgileri yüklenemedi");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const reel = reels.find((r) => r.id === reelId) ?? null;
  // Pin görseli: aracın dikey markalı kapağı (sitede yayında olmalı; Pinterest adresten indirir).
  const imageUrl = reel ? `${window.location.origin}/reel-covers/${encodeURIComponent(reel.id)}.jpg` : "";

  // Araç değişince metinler önerilerle dolar (kullanıcı sonra düzenleyebilir).
  useEffect(() => {
    if (!reel) return;
    setTitle(reel.tr.title.slice(0, 100));
    setDescription(reel.tr.summary.slice(0, 500));
    setLink(absoluteLink(reel.tr.link));
  }, [reel]);

  async function chooseBoard(id: string) {
    setBoardId(id);
    if (!id) return;
    setBoardBusy(true);
    try {
      await selectPinterestBoard(accessToken, id);
      await onChanged?.();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Pano seçilemedi" });
    } finally {
      setBoardBusy(false);
    }
  }

  async function addBoard() {
    if (!newBoard.trim()) return;
    setBoardBusy(true);
    try {
      const board = await createPinterestBoard(accessToken, newBoard.trim());
      setNewBoard("");
      await load();
      setBoardId(board.id);
      await onChanged?.();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Pano oluşturulamadı" });
    } finally {
      setBoardBusy(false);
    }
  }

  async function submit() {
    if (!boardId || !imageUrl || !title.trim() || !description.trim() || !link.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const pin = await createPinterestPin(accessToken, { imageUrl, title, description, link });
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
              <img src={imageUrl} alt="" className="w-full bg-slate-200 object-cover" style={{ aspectRatio: "9 / 16" }} />
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
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Başlık</span>
              <input className={`${fieldClass} mt-1`} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Açıklama</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-[96px] resize-y`}
                value={description}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="mt-0.5 block text-right text-[10px] text-slate-500">{description.length}/500</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Bağlantı</span>
              <input className={`${fieldClass} mt-1`} value={link} onChange={(e) => setLink(e.target.value)} />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={primaryButton}
                disabled={busy || !boardId || !title.trim() || !description.trim() || !link.trim()}
                onClick={() => void submit()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Gönderiliyor…" : "Pinle"}
              </button>
              {!boardId ? <span className="text-[11px] text-slate-500">Önce bir pano seç.</span> : null}
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
    </section>
  );
}
