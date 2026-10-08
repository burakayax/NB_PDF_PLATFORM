/**
 * CV fotoğrafı hazırlama — AI Fotoğraf Stüdyosu çekirdeğini CV içinde kullanır.
 * Her şey cihazda çalışır (arka plan ayırma + yüz kadrajı); fotoğraf sunucuya gitmez.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { analyzeBase, compose, level, runChecks, PhotoLoadError, type BaseAnalysis, type Leveled } from "../../../lib/photoStudio/compose";
import { PRESETS, BACKGROUNDS, type BgId } from "../../../lib/photoStudio/presets";
import type { CvPhoto } from "./cvModel";
import type { CvTemplate } from "./cvTemplates";

const BG_CHOICES: BgId[] = ["white", "lightgray", "lightblue", "beige", "studio", "navy", "blur", "original"];

type Props = { photo: CvPhoto; tpl: CvTemplate; tr: boolean; onApply: (src: string) => void; onClose: () => void };

export function CvPhotoPrep({ photo, tpl, tr, onApply, onClose }: Props) {
  const { w: bw, h: bh } = tpl.theme.photo;
  const square = Math.abs(bw / bh - 1) < 0.08;
  const preset = useMemo(() => PRESETS.find((p) => p.id === (square ? "cv-square" : "cv-portrait"))!, [square]);
  const outW = 900;
  const outH = Math.round((900 * bh) / bw);

  const [bg, setBg] = useState<BgId>("white");
  const [enhance, setEnhance] = useState(true);
  const [headRatio, setHeadRatio] = useState((preset.head[0] + preset.head[1]) / 2);
  const [base, setBase] = useState<BaseAnalysis | null>(null);
  const [leveled, setLeveled] = useState<Leveled | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  // Çözümleme (bir kez)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const blob = await (await fetch(photo.src)).blob();
        const b = await analyzeBase(blob, (_s, p) => live && setPct(Math.round(p)));
        const l = await level(b, true);
        if (!live) return;
        setBase(b);
        setLeveled(l);
      } catch (e) {
        if (live) setErr(e instanceof PhotoLoadError ? (tr ? "Fotoğraf açılamadı." : "Couldn't open the photo.") : (tr ? "Yapay zekâ modeli yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin." : "The AI model couldn't load. Check your connection and try again."));
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Önizleme
  useEffect(() => {
    if (!leveled || !base) return;
    const opts = { outW, outH, head: preset.head, topShare: preset.topShare, headRatio, offsetX: 0, offsetY: 0, bg, customColor: "#ffffff", circle: false, enhance, brightness: 0 };
    const { canvas, guides } = compose(leveled, opts);
    // JPEG için düz zemin üzerine yaz (şeffaf kenar kalmasın)
    const flat = document.createElement("canvas");
    flat.width = outW;
    flat.height = outH;
    const c = flat.getContext("2d")!;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, outW, outH);
    c.drawImage(canvas, 0, 0);
    setPreview(flat.toDataURL("image/jpeg", 0.9));
    const checks = runChecks(leveled, base, { head: preset.head, strict: false }, opts, guides);
    setNotes(checks.filter((k) => k.level !== "ok").map((k) => (tr ? k.tr : k.en)));
  }, [leveled, base, bg, enhance, headRatio, preset, outW, outH, tr]);

  const busy = !leveled && !err;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={tr ? "Fotoğrafı yapay zekâ ile hazırla" : "Prepare photo with AI"}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-slate-900 p-5 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-white"><Sparkles className="h-4 w-4 text-fuchsia-300" />{tr ? "Fotoğrafı CV için hazırla" : "Prepare your CV photo"}</h3>
            <p className="mt-1 text-[12px] text-slate-400">{tr ? "Arka plan temizlenir, yüz şablonun fotoğraf alanına göre kadraja alınır. Fotoğrafınız bu cihazdan çıkmaz." : "The background is cleaned and your face is framed for this template's photo slot. Your photo never leaves this device."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-[13px] text-red-200">{err}</p> : null}
        {busy ? (
          <div className="mt-6 flex items-center gap-3 text-[13px] text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Yapay zekâ modeli hazırlanıyor… (ilk seferde birkaç saniye sürebilir)" : "Preparing the AI model… (a few seconds the first time)"} {pct > 0 ? `%${pct}` : ""}</div>
        ) : null}

        {leveled ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.1fr]">
            <div className="grid grid-cols-2 gap-2">
              <figure className="space-y-1"><img src={photo.src} alt="" className="w-full rounded-xl object-cover opacity-80" style={{ aspectRatio: `${bw}/${bh}` }} /><figcaption className="text-center text-[11px] text-slate-500">{tr ? "Önce" : "Before"}</figcaption></figure>
              <figure className="space-y-1">{preview ? <img src={preview} alt={tr ? "Hazırlanan fotoğraf" : "Prepared photo"} className="w-full rounded-xl" style={{ aspectRatio: `${bw}/${bh}` }} /> : null}<figcaption className="text-center text-[11px] text-slate-300">{tr ? "Sonra" : "After"}</figcaption></figure>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-slate-200">{tr ? "Arka plan" : "Background"}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {BG_CHOICES.map((id) => {
                    const o = BACKGROUNDS.find((x) => x.id === id)!;
                    return (
                      <button key={id} type="button" role="radio" aria-checked={bg === id} aria-label={tr ? o.tr : o.en} title={tr ? o.tr : o.en} onClick={() => setBg(id)} className={`h-8 w-8 rounded-full ring-2 ${bg === id ? "ring-sky-400" : "ring-white/15"}`} style={{ background: o.swatch }} />
                    );
                  })}
                </div>
              </div>
              <label className="block text-[12px] text-slate-200"><span className="font-semibold">{tr ? "Baş boyutu" : "Head size"}</span>
                <input type="range" min={Math.round(preset.head[0] * 100) - 8} max={Math.round(preset.head[1] * 100) + 10} value={Math.round(headRatio * 100)} onChange={(e) => setHeadRatio(Number(e.target.value) / 100)} className="mt-1 w-full accent-sky-400" />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} className="accent-sky-400" />{tr ? "Işığı otomatik dengele" : "Auto-balance lighting"}</label>
              {notes.length ? <ul className="space-y-1 rounded-xl bg-amber-500/10 p-2.5 text-[11.5px] text-amber-100">{notes.slice(0, 3).map((n) => <li key={n}>• {n}</li>)}</ul> : <p className="text-[11.5px] text-emerald-300">{tr ? "Kadraj ve ışık uygun görünüyor." : "Framing and lighting look good."}</p>}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-white/10">{tr ? "Vazgeç" : "Cancel"}</button>
          <button type="button" disabled={!preview} onClick={() => preview && onApply(preview)} className="rounded-xl bg-sky-500 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-sky-400 disabled:opacity-40">{tr ? "CV'de kullan" : "Use in CV"}</button>
        </div>
      </div>
    </div>
  );
}
