import { useRef, useState } from "react";
import { FileUp, Loader2, Linkedin, X } from "lucide-react";
import { readCvFile, parsedToCv } from "./cvAi";
import { parseLinkedinText } from "./cvLinkedin";
import type { CvData } from "./cvModel";
import { ocrPdfToText } from "../../../lib/ocr";

type Props = { tr: boolean; base: CvData; onNew: (d: CvData, name: string) => void; onReplace: (d: CvData) => void; onClose: () => void; canAdd: boolean };

/** LinkedIn PDF'i (ya da eski CV) cihazda, ücretsiz ve kurallarla okunur; sonuç kontrol edilmek üzere gösterilir. */
export function CvImportModal({ tr, base, onNew, onReplace, onClose, canAdd }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ data: CvData; name: string; found: { experience: number; education: number; skills: number; languages: number } } | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const read = await readCvFile(f);
      let text = read.text;
      if (read.scanned && f.name.toLowerCase().endsWith(".pdf")) text = await ocrPdfToText(f);
      if (text.trim().length < 60) throw new Error("short");
      const { parsed, found } = parseLinkedinText(text);
      if (!parsed.name && !found.experience && !found.education) throw new Error("empty");
      const d = parsedToCv(parsed, base);
      setRes({ data: { ...d, photo: base.photo, showPhoto: base.showPhoto }, name: parsed.name || f.name.replace(/\.[^.]+$/, ""), found });
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === "type" ? (tr ? "Yalnızca PDF, Word (.docx) ya da metin (.txt) yükleyin." : "Upload a PDF, Word (.docx) or text (.txt) file.") : (tr ? "Bu dosyadan CV bilgisi okunamadı. LinkedIn'in “PDF olarak kaydet” çıktısını deneyin; çok farklı düzenli CV'lerde Yapay Zekâ sekmesindeki içe aktarma daha iyi sonuç verir." : "Couldn't read CV details from this file. Try LinkedIn's “Save to PDF”; for very differently laid-out CVs the AI tab's import works better."));
    } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={tr ? "LinkedIn'den aktar" : "Import from LinkedIn"}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-slate-900 p-5 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[17px] font-black text-white"><Linkedin className="h-5 w-5 text-sky-300" />{tr ? "LinkedIn / eski CV'den aktar" : "Import from LinkedIn / old CV"}</h3>
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <ol className="mt-4 space-y-2 text-[13px] text-slate-300">
          {(tr
            ? ["LinkedIn profilinizi açın → “Kaynaklar” (ya da “Diğer”) → “PDF olarak kaydet”.", "İnen PDF dosyasını aşağıdan seçin (Word ve metin dosyası da olur).", "Okunan bilgileri kontrol edip CV'nize alın."]
            : ["Open your LinkedIn profile → “Resources” (or “More”) → “Save to PDF”.", "Pick the downloaded PDF below (Word and text files work too).", "Check what was read and bring it into your CV."]
          ).map((t, i) => <li key={i} className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[11px] font-bold text-sky-200">{i + 1}</span>{t}</li>)}
        </ol>
        <input ref={ref} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 text-[14px] font-bold text-white hover:brightness-110 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{tr ? "Dosya seç" : "Choose file"}
        </button>
        <p className="mt-2 text-center text-[11.5px] text-slate-500">{tr ? "Dosya cihazınızda okunur; sunucuya gönderilmez. Ücretsizdir." : "The file is read on your device and never uploaded. Free."}</p>
        {err ? <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-[12.5px] text-red-200">{err}</p> : null}
        {res ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
            <p className="text-[14px] font-bold text-white">{res.data.name || res.name}</p>
            <p className="text-[12.5px] text-emerald-100">{tr ? `${res.found.experience} iş deneyimi · ${res.found.education} okul · ${res.found.skills} beceri · ${res.found.languages} dil bulundu.` : `Found ${res.found.experience} jobs · ${res.found.education} schools · ${res.found.skills} skills · ${res.found.languages} languages.`}</p>
            <p className="text-[11.5px] text-slate-400">{tr ? "Otomatik okuma kusursuz değildir; aktardıktan sonra şirket/pozisyon ve tarihleri kontrol edin." : "Automatic reading isn't perfect; after importing, check companies, titles and dates."}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canAdd} onClick={() => { onNew(res.data, res.name); onClose(); }} className="rounded-xl bg-sky-500 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-sky-400 disabled:opacity-40">{tr ? "Yeni CV olarak aç" : "Open as a new CV"}</button>
              <button type="button" onClick={() => { if (window.confirm(tr ? "Şu anki CV'nizin içeriği bununla değişecek. Devam edilsin mi?" : "This will replace the contents of the current CV. Continue?")) { onReplace(res.data); onClose(); } }} className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10">{tr ? "Mevcut CV'nin yerine koy" : "Replace current CV"}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
