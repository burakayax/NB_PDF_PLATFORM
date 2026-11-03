import { useEffect, useState } from "react";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { buildIdSheetPdf, type CardKind, type Rotation, type SheetMode } from "../../lib/idCardSheet";
import { isTiffFile } from "../../lib/tiffPages";

type Slot = { file: File; rotation: Rotation; url: string } | null;

/** Kimlik / Ehliyet / Pasaport → tek A4 sayfa. Görüntü cihazdan çıkmaz. */
export function IdCardSheetTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [kind, setKind] = useState<CardKind>("id1");
  const [mode, setMode] = useState<SheetMode>("two");
  const [slots, setSlots] = useState<[Slot, Slot]>([null, null]);
  const [wm, setWm] = useState(false);
  const [wmText, setWmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  // Önizleme adresleri bellekten serbest bırakılır.
  useEffect(() => () => slots.forEach((s) => s && URL.revokeObjectURL(s.url)), [slots]);

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
      if (n[i]) URL.revokeObjectURL(n[i]!.url);
      n[i] = { file: f, rotation: 0, url: URL.createObjectURL(f) };
      return n;
    });
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
      if (n[i]) URL.revokeObjectURL(n[i]!.url);
      n[i] = null;
      return n;
    });

  const ready = slots.slice(0, count).every(Boolean);

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const inputs = slots.slice(0, count).map((s) => ({ file: s!.file, rotation: s!.rotation }));
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

      {([0, 1] as const).slice(0, count).map((i) => (
        <div key={`${kind}-${mode}-${i}`} className="field field--full">
          <span>{mode === "one" ? (tr ? "Fotoğraf" : "Photo") : labels[i]}</span>
          {slots[i] ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
              <img src={slots[i]!.url} alt="" className="h-20 w-32 rounded-md bg-slate-900 object-contain" style={{ transform: `rotate(${slots[i]!.rotation}deg)` }} />
              <p className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{slots[i]!.file.name}</p>
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
