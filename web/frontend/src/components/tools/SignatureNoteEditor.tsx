/**
 * İMZA İSTEĞİ NOTU DÜZENLEYİCİ — kalın, italik, altı çizili, punto ve sabit renkler.
 *
 * Açık zeminli yazılır: not, e-postada beyaz zeminde görüneceği için «gördüğün
 * gibi gider». Çıktı HTML'dir; sunucu bunu beyaz listeyle yeniden temizler, bu
 * yüzden buradaki biçimlendirme güvenlik sınırı değildir.
 */
import { useEffect, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";

/** Hem koyu uygulamada hem beyaz e-postada okunur sabit renkler. */
const RENKLER: { ad: string; deger: string }[] = [
  { ad: "Siyah", deger: "#0f172a" },
  { ad: "Kırmızı", deger: "#dc2626" },
  { ad: "Turuncu", deger: "#ea580c" },
  { ad: "Yeşil", deger: "#16a34a" },
  { ad: "Mavi", deger: "#2563eb" },
  { ad: "Mor", deger: "#7c3aed" },
];

/** execCommand fontSize: 2 küçük, 3 normal, 5 büyük. */
const PUNTOLAR: { ad: string; deger: string; sinif: string }[] = [
  { ad: "Küçük", deger: "2", sinif: "text-[11px]" },
  { ad: "Normal", deger: "3", sinif: "text-[14px]" },
  { ad: "Büyük", deger: "5", sinif: "text-[18px]" },
];

export function duzMetin(html: string): string {
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").trim();
}

const BTN =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700";

export function SignatureNoteEditor({
  onChange,
  placeholder,
  sifirla,
}: {
  onChange: (html: string) => void;
  placeholder: string;
  /** Değer değiştikçe düzenleyici içeriği temizlenir (form sıfırlanınca). */
  sifirla: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = "";
  }, [sifirla]);

  const komut = (ad: string, deger?: string) => {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(ad, false, deger);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // Seçimi bozmamak için düğmeler odağı almaz.
  const tut = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.14] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.6)] transition focus-within:border-cyan-400/60 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-100/80 px-2.5 py-2">
        <button type="button" title="Kalın" aria-label="Kalın" onMouseDown={tut} onClick={() => komut("bold")} className={BTN}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" title="İtalik" aria-label="İtalik" onMouseDown={tut} onClick={() => komut("italic")} className={BTN}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" title="Altı çizili" aria-label="Altı çizili" onMouseDown={tut} onClick={() => komut("underline")} className={BTN}>
          <Underline className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        {PUNTOLAR.map((p) => (
          <button
            key={p.deger}
            type="button"
            title={`Punto: ${p.ad}`}
            aria-label={`Punto: ${p.ad}`}
            onMouseDown={tut}
            onClick={() => komut("fontSize", p.deger)}
            className={`${BTN} font-semibold ${p.sinif}`}
          >
            A
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        {RENKLER.map((r) => (
          <button
            key={r.deger}
            type="button"
            title={r.ad}
            aria-label={`Renk: ${r.ad}`}
            onMouseDown={tut}
            onClick={() => komut("foreColor", r.deger)}
            className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-slate-300 transition hover:scale-125 hover:ring-slate-500"
            style={{ backgroundColor: r.deger }}
          />
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Not"
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onPaste={(e) => {
          // Dışarıdan yapıştırılan biçimi alma: yalnızca düz metin.
          e.preventDefault();
          const t = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, t);
        }}
        className="min-h-[4.5rem] max-h-48 overflow-y-auto px-3 py-2.5 text-[14px] leading-relaxed text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
