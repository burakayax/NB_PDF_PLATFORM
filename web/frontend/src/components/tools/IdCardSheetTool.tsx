import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crop, LayoutTemplate, Eye, Loader2, Trash2, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { IdCropDialog } from "./IdCropDialog";
import { alignmentsConflict, buildIdSheetPdf, CARD_MM, defaultAligns, layoutSheet, sameAlign, type AlignH, type AlignV, type CardKind, type SheetAlign, type SheetAligns, type SheetMode } from "../../lib/idCardSheet";
import { isTiffFile } from "../../lib/tiffPages";

/** `original`: kullanıcının yüklediği dosya (yeniden kırpmak için), `cropped`: kırpılmış hali. */
type Slot = { original: File; cropped: Blob; url: string } | null;

const revoke = (s: Slot) => {
  if (s) URL.revokeObjectURL(s.url);
};

/** `together`: ön ve arka aynı konumda = tek blok, arka yüz ön yüzün hemen altında. */
type Preset = { key: string; tr: string; en: string; front: SheetAlign; back: SheetAlign; together?: boolean };
const A = (h: AlignH, v: AlignV): SheetAlign => ({ h, v });

/** İki yüz için hazır düzenler (konuşulan tüm varyasyonlar). */
const TWO_PRESETS: Preset[] = [
  // 1. satır: alt alta, sayfanın üstünde — soldan sağa
  { key: "stack-l", tr: "Solda alt alta", en: "Stacked, left", front: A("left", "top"), back: A("left", "top"), together: true },
  { key: "stack-c", tr: "Ortada alt alta", en: "Stacked, centered", front: A("center", "top"), back: A("center", "top"), together: true },
  { key: "stack-r", tr: "Sağda alt alta", en: "Stacked, right", front: A("right", "top"), back: A("right", "top"), together: true },
  // 2. satır: yan yana — yukarıdan aşağıya
  { key: "side-top", tr: "Üstte yan yana", en: "Side by side, top", front: A("left", "top"), back: A("right", "top") },
  { key: "side-mid", tr: "Ortada yan yana", en: "Side by side, middle", front: A("left", "middle"), back: A("right", "middle") },
  { key: "side-bot", tr: "Altta yan yana", en: "Side by side, bottom", front: A("left", "bottom"), back: A("right", "bottom") },
  // 3. satır: ortalı — yukarıdan aşağıya
  { key: "top-bottom", tr: "Üstte ve altta", en: "Top and bottom", front: A("center", "top"), back: A("center", "bottom") },
  { key: "stack-mid", tr: "Sayfa ortasında alt alta", en: "Stacked, page middle", front: A("center", "middle"), back: A("center", "middle"), together: true },
  { key: "stack-bot", tr: "Altta alt alta", en: "Stacked, bottom", front: A("center", "bottom"), back: A("center", "bottom"), together: true },
];

/** Tek yüz için hazır konumlar. */
const ONE_PRESETS: Preset[] = [
  { key: "one-tl", tr: "Üstte solda", en: "Top, left", front: A("left", "top"), back: A("left", "top") },
  { key: "one-tc", tr: "Üstte ortada", en: "Top, center", front: A("center", "top"), back: A("center", "top") },
  { key: "one-tr", tr: "Üstte sağda", en: "Top, right", front: A("right", "top"), back: A("right", "top") },
  { key: "one-mc", tr: "Sayfanın ortası", en: "Page center", front: A("center", "middle"), back: A("center", "middle") },
  { key: "one-bc", tr: "Altta ortada", en: "Bottom, center", front: A("center", "bottom"), back: A("center", "bottom") },
];

/** A4 sayfanın küçük çizimi: ön yüz turkuaz, arka yüz yeşil. Konumlar gerçek yerleşim hesabından gelir. */
function PageThumb({ kind, mode, front, back }: { kind: CardKind; mode: SheetMode; front: SheetAlign; back: SheetAlign }) {
  const { page, cards } = layoutSheet(kind, mode, { front, back });
  const W = 44;
  const k = W / page.w;
  return (
    <span className="relative block rounded-[3px] bg-white/90 shadow-inner" style={{ width: W, height: page.h * k }} aria-hidden>
      {cards.map((c, i) => (
        <span
          key={i}
          className={`absolute rounded-[1.5px] ${i === 0 ? "bg-cyan-500" : "bg-emerald-500"}`}
          style={{ left: c.x * k, top: c.y * k, width: c.w * k, height: c.h * k }}
        />
      ))}
    </span>
  );
}

/** Seçenekleri doğrudan gösteren düğme grubu (açılır liste yerine). */
function Segmented({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[13px] font-semibold text-slate-300">{label}</p>
      <div className="flex gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`min-h-[44px] flex-1 rounded-lg px-3 text-[13px] font-semibold transition ${
                on ? "bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.5)]" : "text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Kimlik / Ehliyet / Pasaport → tek A4 sayfa. Görüntü cihazdan çıkmaz. */
export function IdCardSheetTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [kind, setKind] = useState<CardKind>("id1");
  const [mode, setMode] = useState<SheetMode>("two");
  const [slots, setSlots] = useState<[Slot, Slot]>([null, null]);
  const [crop, setCrop] = useState<{ i: 0 | 1; file: File } | null>(null);
  const [aligns, setAligns] = useState<SheetAligns>(() => defaultAligns("id1"));
  const [wm, setWm] = useState(false);
  const [wmText, setWmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  // Güncel değerleri ref'te tut: sayfadan çıkarken temizlik eski (boş) state'i yakalamasın.
  const previewRef = useRef<string | null>(null);
  previewRef.current = previewUrl;
  const slotsRef = useRef<[Slot, Slot]>([null, null]);
  slotsRef.current = slots;

  const closePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  };
  // Girdiler değişince eski önizleme geçersiz olur.
  useEffect(() => {
    closePreview();
  }, [slots, kind, mode, aligns, wm, wmText]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  // Önizleme adresleri bellekten serbest bırakılır.
  useEffect(() => () => slotsRef.current.forEach(revoke), []);

  const count = mode === "two" ? 2 : 1;
  const labels = tr ? ["Ön yüz", "Arka yüz"] : ["Front", "Back"];

  const aspect = CARD_MM[kind].w / CARD_MM[kind].h;

  // Dosya seçilince doğrudan kırpma penceresi açılır.
  const pick = (i: 0 | 1, files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (isTiffFile(f) || !/^image\//.test(f.type || "image/x")) {
      setError(tr ? "Lütfen JPG veya PNG fotoğraf seçin." : "Please choose a JPG or PNG photo.");
      return;
    }
    setError(null);
    setCrop({ i, file: f });
  };
  const applyCrop = (blob: Blob) => {
    if (!crop) return;
    const { i, file } = crop;
    setSlots((prev) => {
      const n: [Slot, Slot] = [prev[0], prev[1]];
      revoke(n[i]);
      n[i] = { original: file, cropped: blob, url: URL.createObjectURL(blob) };
      return n;
    });
    setCrop(null);
  };
  const clear = (i: 0 | 1) =>
    setSlots((p) => {
      const n: [Slot, Slot] = [p[0], p[1]];
      revoke(n[i]);
      n[i] = null;
      return n;
    });
  // Belge türü değişince oran değişir → eski kırpmalar geçersiz, baştan alınır.
  const changeKind = (k: CardKind) => {
    if (k === kind) return;
    setSlots((p) => {
      p.forEach(revoke);
      return [null, null];
    });
    setKind(k);
    setAligns(defaultAligns(k));
    // Pasaportta ön/arka yok: yalnızca fotoğraflı bilgi sayfası kopyalanır → tek sayfa.
    setMode(k === "id3" ? "one" : "two");
  };

  const ready = slots.slice(0, count).every(Boolean);

  const buildPdf = async () => {
    const inputs = slots.slice(0, count).map((s) => ({ file: s!.cropped, rotation: 0 as const }));
    const bytes = await buildIdSheetPdf(kind, mode, inputs, wm ? { text: wmText.trim() } : undefined, aligns);
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  };

  const preview = async () => {
    setError(null);
    setPreviewBusy(true);
    try {
      const blob = await buildPdf();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setError(tr ? "Önizleme oluşturulamadı. Fotoğraflar bozuk olabilir." : "Could not build the preview. The photos may be corrupt.");
    } finally {
      setPreviewBusy(false);
    }
  };

  /** İş bitti: fotoğraflar ve sonuç bellekten atılır (kimlik gibi hassas belge sayfada kalmasın). */
  const finish = () => {
    setSlots((p) => {
      p.forEach(revoke);
      return [null, null];
    });
    closePreview();
    setResult(null);
  };

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      setResult(await buildPdf());
    } catch {
      setError(tr ? "Sayfa oluşturulamadı. Fotoğraflar bozuk olabilir." : "Could not build the page. The photos may be corrupt.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ToolResultPanel ratingToolSlug="kimlik-karti-tek-sayfa" blob={result} filename="kimlik-on-arka.pdf" language={language} processedOnDevice onClose={finish}>
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">
          {tr ? "Kimlik sayfanız hazır: belge gerçek boyutunda tek A4 sayfada." : "Your ID page is ready: the document at real size on one A4 page."}
        </p>
        <ValueMomentNudge language={language} source="idcard_success" />
      </ToolResultPanel>
    );
  }

  return (
    <div className="tool-form">
      <div className="field--full grid gap-4 sm:grid-cols-2">
        <Segmented
          label={tr ? "Belge türü" : "Document type"}
          value={kind}
          onChange={(v) => changeKind(v as CardKind)}
          options={[
            { value: "id1", label: tr ? "Kimlik kartı / Ehliyet" : "ID card / Driving licence" },
            { value: "id3", label: tr ? "Pasaport" : "Passport" },
          ]}
        />
        {kind === "id1" ? (
          <Segmented
            label={tr ? "Kaç yüz?" : "How many sides?"}
            value={mode}
            onChange={(v) => setMode(v as SheetMode)}
            options={[
              { value: "two", label: tr ? "Ön + arka" : "Front + back" },
              { value: "one", label: tr ? "Tek yüz" : "One side" },
            ]}
          />
        ) : (
          <div className="min-w-0 space-y-1.5">
            <p className="text-[13px] font-semibold text-slate-300">{tr ? "Pasaportta ne kopyalanır?" : "What is copied for a passport?"}</p>
            <p className="flex min-h-[56px] items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] leading-snug text-slate-300">
              {tr ? "Yalnızca fotoğraflı bilgi sayfası (tek sayfa). Ön/arka yüz yoktur." : "Only the photo data page (a single page). There is no front/back."}
            </p>
          </div>
        )}
      </div>

      <div className={`field--full grid gap-4 ${count === 2 ? "sm:grid-cols-2" : ""}`}>
      {([0, 1] as const).slice(0, count).map((i) => (
        <div key={`${kind}-${mode}-${i}`} className="field min-w-0">
          <span>{mode === "one" ? (kind === "id3" ? (tr ? "Bilgi sayfası (fotoğraflı sayfa)" : "Data page (photo page)") : tr ? "Fotoğraf" : "Photo") : labels[i]}</span>
          {slots[i] ? (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <img src={slots[i]!.url} alt="" className="block aspect-[1.586/1] w-full bg-slate-900 object-contain" />
              <div className="flex items-center gap-2 p-2.5">
                <p className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{slots[i]!.original.name}</p>
                <button type="button" onClick={() => setCrop({ i, file: slots[i]!.original })} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold text-cyan-200 hover:bg-white/5">
                  <Crop className="h-4 w-4" />
                  {tr ? "Yeniden kırp" : "Re-crop"}
                </button>
                <button type="button" onClick={() => clear(i)} aria-label={tr ? "Kaldır" : "Remove"} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <WorkspaceUploadField
              toolId="kimlik-karti-tek-sayfa"
              language={language}
              accept="image/*"
              disabled={busy}
              label={tr ? `${mode === "one" ? (kind === "id3" ? "Bilgi sayfasının fotoğrafını" : "Fotoğrafı") : labels[i] + " fotoğrafını"} buraya sürükle` : kind === "id3" ? "Drag the data-page photo here" : "Drag the photo here"}
              note={tr ? "JPG / PNG · cihazınızdan çıkmaz" : "JPG / PNG · stays on your device"}
              hideHeader={describesTool}
              hideBenefits
              onFiles={(f) => pick(i, f)}
            />
          )}
        </div>
      ))}
      </div>

      <div className="field--full space-y-2.5">
        <label
          className={`inline-flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-xl border px-4 text-[13px] font-semibold transition ${
            wm ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25"
          }`}
        >
          <input type="checkbox" className="h-4 w-4 cursor-pointer accent-cyan-400" checked={wm} onChange={(e) => setWm(e.target.checked)} />
          {tr ? "Filigran ekle (kimliğin kötüye kullanımına karşı)" : "Add a watermark (against misuse of the ID)"}
        </label>
        {wm && (
          <div className="field">
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
          </div>
        )}
      </div>

      <div className="field--full space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/25">
            <LayoutTemplate className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white">{tr ? "Sayfa düzeni" : "Page layout"}</p>
            <p className="text-[12px] leading-snug text-slate-400">
              {tr ? "Kimliğin A4 sayfada nerede duracağını seçin. " : "Choose where the ID goes on the A4 page. "}
              <span className="font-semibold text-cyan-300">{mode === "two" ? (tr ? "Turkuaz: ön yüz" : "Cyan: front") : tr ? "Turkuaz: belge" : "Cyan: document"}</span>
              {mode === "two" && (
                <>
                  {" · "}
                  <span className="font-semibold text-emerald-300">{tr ? "Yeşil: arka yüz" : "Green: back"}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={tr ? "Sayfa düzeni" : "Page layout"}>
          {(mode === "two" ? TWO_PRESETS : ONE_PRESETS).map((p) => {
            const fits = mode === "one" || !!p.together || !alignmentsConflict(kind, p.front, p.back);
            const active = sameAlign(p.front, aligns.front) && (mode === "one" || sameAlign(p.back, aligns.back));
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!fits}
                title={!fits ? (tr ? "Bu belge bu düzene sığmaz" : "This document does not fit this layout") : undefined}
                onClick={() => setAligns({ front: p.front, back: p.back })}
                className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition ${
                  active
                    ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : fits
                      ? "border-white/10 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.07]"
                      : "cursor-not-allowed border-white/5 opacity-40"
                }`}
              >
                <PageThumb kind={kind} mode={mode} front={p.front} back={p.back} />
                <span className={`text-[12px] font-semibold leading-tight ${active ? "text-cyan-100" : "text-slate-300"} ${fits ? "" : "line-through"}`}>{tr ? p.tr : p.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="field--full inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/[0.07] px-4 text-[14px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => void preview()}
        disabled={busy || previewBusy || !ready || (wm && !wmText.trim())}
      >
        {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        {tr ? "Önizle (PDF çıktısını gör)" : "Preview (see the PDF output)"}
      </button>

      {previewUrl && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label={tr ? "Çıktı önizlemesi" : "Output preview"} onClick={closePreview}>
          <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-white">{tr ? "Çıktı önizlemesi (A4 PDF)" : "Output preview (A4 PDF)"}</p>
              <button type="button" onClick={closePreview} aria-label={tr ? "Kapat" : "Close"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <iframe title={tr ? "PDF önizleme" : "PDF preview"} src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 rounded-lg bg-white" />
            <button type="button" onClick={closePreview} className="min-h-[44px] rounded-xl bg-cyan-500 px-6 text-[13px] font-bold text-slate-950 hover:bg-cyan-400">
              {tr ? "Kapat" : "Close"}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {error && <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>}

      <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || !ready || (wm && !wmText.trim())}>
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</span> : tr ? "Tek sayfa PDF oluştur" : "Create one-page PDF"}
      </button>
      {crop && <IdCropDialog file={crop.file} aspect={aspect} tr={tr} onCancel={() => setCrop(null)} onDone={applyCrop} />}
      <p className="field--full text-center text-[12px] text-slate-400">
        {tr ? "Fotoğraflarınız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Your photos are processed in your browser — never uploaded."}
      </p>
    </div>
  );
}
