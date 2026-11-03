import { useEffect, useState } from "react";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { buildIdSheetPdf, type CardKind, type Rotation, type SheetMode } from "../../lib/idCardSheet";
import { isTiffFile } from "../../lib/tiffPages";
import { detectIdCard, qualityHint, type DetectResult } from "../../lib/idCardDetect";

type Detect = DetectResult | "detecting" | "error";
type Slot = {
  file: File;
  rotation: Rotation;
  url: string;
  cropped: Blob | null;
  croppedUrl: string | null;
  detect: Detect;
} | null;

const revoke = (s: Slot) => {
  if (!s) return;
  URL.revokeObjectURL(s.url);
  if (s.croppedUrl) URL.revokeObjectURL(s.croppedUrl);
};

/** Kimlik / Ehliyet / Pasaport → tek A4 sayfa. Görüntü cihazdan çıkmaz. */
export function IdCardSheetTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [kind, setKind] = useState<CardKind>("id1");
  const [mode, setMode] = useState<SheetMode>("two");
  const [slots, setSlots] = useState<[Slot, Slot]>([null, null]);
  const [autoCrop, setAutoCrop] = useState(true);
  const [wm, setWm] = useState(false);
  const [wmText, setWmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  // Önizleme adresleri bellekten serbest bırakılır.
  useEffect(() => () => slots.forEach(revoke), []);

  const count = mode === "two" ? 2 : 1;
  const labels = tr ? ["Ön yüz", "Arka yüz"] : ["Front", "Back"];

  const setSlot = (i: 0 | 1, files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (isTiffFile(f) || !/^image\//.test(f.type || "image/x")) {
      setError(tr ? "Lütfen JPG veya PNG fotoğraf seçin." : "Please choose a JPG or PNG photo.");
      return;
    }
    setError(null);
    setSlots((prev) => {
      const n: [Slot, Slot] = [prev[0], prev[1]];
      revoke(n[i]);
      n[i] = { file: f, rotation: 0, url: URL.createObjectURL(f), cropped: null, croppedUrl: null, detect: "detecting" };
      return n;
    });
    // Kenar bulma arka planda; bitince aynı dosya hâlâ yuvadaysa sonuç yazılır.
    void detectIdCard(f)
      .then((d) => ({ d, err: false }))
      .catch(() => ({ d: null, err: true }))
      .then(({ d, err }) =>
        setSlots((prev) => {
          const cur = prev[i];
          if (!cur || cur.file !== f) return prev;
          const n: [Slot, Slot] = [prev[0], prev[1]];
          n[i] = {
            ...cur,
            cropped: d?.blob ?? null,
            croppedUrl: d?.blob ? URL.createObjectURL(d.blob) : null,
            detect: err || !d ? "error" : d,
          };
          return n;
        }),
      );
  };
  const rotate = (i: 0 | 1) =>
    setSlots((p) => {
      const n: [Slot, Slot] = [p[0], p[1]];
      if (n[i]) n[i] = { ...n[i]!, rotation: (((n[i]!.rotation + 90) % 360) as Rotation) };
      return n;
    });
  const clear = (i: 0 | 1) =>
    setSlots((p) => {
      const n: [Slot, Slot] = [p[0], p[1]];
      revoke(n[i]);
      n[i] = null;
      return n;
    });

  const ready = slots.slice(0, count).every((s) => s && s.detect !== "detecting");
  const usesCrop = (s: NonNullable<Slot>) => autoCrop && !!s.cropped;

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const inputs = slots.slice(0, count).map((s) => ({ file: usesCrop(s!) ? s!.cropped! : s!.file, rotation: usesCrop(s!) ? s!.rotation : s!.rotation }));
      const bytes = await buildIdSheetPdf(kind, mode, inputs, wm ? { text: wmText.trim() } : undefined);
      setResult(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    } catch {
      setError(tr ? "Sayfa oluşturulamadı. Fotoğraflar bozuk olabilir." : "Could not build the page. The photos may be corrupt.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ToolResultPanel ratingToolSlug="kimlik-karti-tek-sayfa" blob={result} filename="kimlik-on-arka.pdf" language={language} processedOnDevice onClose={() => setResult(null)}>
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">
          {tr ? "Kimlik sayfanız hazır: belge gerçek boyutunda tek A4 sayfada." : "Your ID page is ready: the document at real size on one A4 page."}
        </p>
        <ValueMomentNudge language={language} source="idcard_success" />
      </ToolResultPanel>
    );
  }

  return (
    <div className="tool-form">
      <div className="field field--full flex flex-wrap gap-4 text-[13px] text-slate-200">
        <label className="flex items-center gap-1.5">
          {tr ? "Belge:" : "Document:"}
          <select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>
            <option value="id1">{tr ? "Kimlik kartı / Ehliyet" : "ID card / Driving licence"}</option>
            <option value="id3">{tr ? "Pasaport (bilgi sayfası)" : "Passport (data page)"}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {tr ? "Yüz:" : "Sides:"}
          <select value={mode} onChange={(e) => setMode(e.target.value as SheetMode)}>
            <option value="two">{tr ? "Ön + arka" : "Front + back"}</option>
            <option value="one">{tr ? "Tek yüz" : "One side"}</option>
          </select>
        </label>
      </div>

      <div className="field field--full space-y-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-3.5 py-2.5 text-left text-[12px] leading-relaxed text-sky-100/90">
        <p>
          {tr
            ? "İpucu: Kimliği ne kadar yakından çekerseniz sonuç o kadar net ve kaliteli olur. Belge kadrajın büyük bölümünü kaplasın; düz bir zemine koyun, ışık yansıması olmasın. Genel bir fotoğraf da olur — kimliğin kenarlarını biz buluruz."
            : "Tip: the closer you shoot the ID, the sharper the result. Let the document fill most of the frame, place it on a plain surface and avoid glare. A general photo works too — we find the card edges for you."}
        </p>
        <label className="flex items-center gap-2 text-slate-200">
          <input type="checkbox" checked={autoCrop} onChange={(e) => setAutoCrop(e.target.checked)} />
          {tr ? "Kimliğin kenarlarını otomatik bul ve düzelt" : "Find and straighten the card edges automatically"}
        </label>
      </div>

      {([0, 1] as const).slice(0, count).map((i) => (
        <div key={`${kind}-${mode}-${i}`} className="field field--full">
          <span>{mode === "one" ? (tr ? "Fotoğraf" : "Photo") : labels[i]}</span>
          {slots[i] ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
              <img src={usesCrop(slots[i]!) ? slots[i]!.croppedUrl! : slots[i]!.url} alt="" className="h-20 w-32 rounded-md bg-slate-900 object-contain" style={{ transform: `rotate(${slots[i]!.rotation}deg)` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-slate-200">{slots[i]!.file.name}</p>
                <SlotStatus slot={slots[i]!} tr={tr} autoCrop={autoCrop} />
              </div>
              <button type="button" onClick={() => rotate(i)} aria-label={tr ? "Döndür" : "Rotate"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/5"><RotateCw className="h-4 w-4" /></button>
              <button type="button" onClick={() => clear(i)} aria-label={tr ? "Kaldır" : "Remove"} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) : (
            <WorkspaceUploadField
              toolId="kimlik-karti-tek-sayfa"
              language={language}
              accept="image/*"
              disabled={busy}
              label={tr ? `${mode === "one" ? "Fotoğrafı" : labels[i] + " fotoğrafını"} buraya sürükle` : "Drag the photo here"}
              note={tr ? "JPG / PNG · cihazınızdan çıkmaz" : "JPG / PNG · stays on your device"}
              hideHeader={describesTool}
              onFiles={(f) => setSlot(i, f)}
            />
          )}
        </div>
      ))}

      <div className="field field--full space-y-2">
        <label className="flex items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={wm} onChange={(e) => setWm(e.target.checked)} />
          {tr ? "Filigran ekle (kimliğin kötüye kullanımına karşı)" : "Add a watermark (against misuse of the ID)"}
        </label>
        {wm && (
          <>
            <input
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              maxLength={60}
              placeholder={tr ? "Örn: Yalnızca X Bankası başvurusu için – 03.11.2026" : "e.g. Only for X Bank application – 03.11.2026"}
            />
            <p className="text-[12px] text-slate-400">
              {tr
                ? "Filigran belgenin üzerine yazılır. Bazı kurumlar filigranlı kimliği kabul etmeyebilir; önce kuruma sorun."
                : "The watermark is drawn over the document. Some institutions may not accept a watermarked ID; check first."}
            </p>
          </>
        )}
      </div>

      {error && <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>}

      <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || !ready || (wm && !wmText.trim())}>
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</span> : tr ? "Tek sayfa PDF oluştur" : "Create one-page PDF"}
      </button>
      <p className="field--full text-center text-[12px] text-slate-400">
        {tr ? "Fotoğraflarınız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Your photos are processed in your browser — never uploaded."}
      </p>
    </div>
  );
}

function SlotStatus({ slot, tr, autoCrop }: { slot: NonNullable<Slot>; tr: boolean; autoCrop: boolean }) {
  const d = slot.detect;
  if (!autoCrop) return null;
  if (d === "detecting")
    return <p className="mt-0.5 text-[12px] text-slate-400">{tr ? "Kenarlar aranıyor…" : "Looking for the edges…"}</p>;
  if (d === "error" || d.reason === "not-found")
    return (
      <p className="mt-0.5 text-[12px] text-amber-300">
        {tr
          ? "Kimlik bulunamadı; fotoğraf olduğu gibi kullanılacak. Daha yakından ve düz bir zeminde çekmeyi deneyin."
          : "Card not found; the photo will be used as is. Try a closer shot on a plain surface."}
      </p>
    );
  if (d.reason === "not-card-shaped")
    return (
      <p className="mt-0.5 text-[12px] text-amber-300">
        {tr
          ? "Bulunan şekil kimlik oranına uymuyor; fotoğraf olduğu gibi kullanılacak. Daha yakından çekin."
          : "The detected shape does not match a card; the photo will be used as is. Shoot closer."}
      </p>
    );
  const hint = qualityHint(d);
  if (hint === "closer")
    return (
      <p className="mt-0.5 text-[12px] text-amber-300">
        {tr ? "Kimlik bulundu ama fotoğrafın küçük bir kısmını kaplıyor. Daha yakından çekerseniz daha net çıkar." : "Card found but it fills only a small part of the photo. Shoot closer for a sharper result."}
      </p>
    );
  if (hint === "low-res")
    return (
      <p className="mt-0.5 text-[12px] text-amber-300">
        {tr ? "Kimlik bulundu ama çözünürlük düşük; baskıda bulanık çıkabilir. Daha yakından çekin." : "Card found but resolution is low; print may look blurry. Shoot closer."}
      </p>
    );
  return <p className="mt-0.5 text-[12px] text-emerald-300">{tr ? "Kimlik bulundu ve düzeltildi." : "Card found and straightened."}</p>;
}
