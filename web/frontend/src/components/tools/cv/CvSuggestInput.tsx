import { useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Yazılan metne göre öneriler (cihazda, sözlükten). */
  suggest: (q: string) => string[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** Öneriler başlık (boş alanda da gösterilsin: ör. dil listesi). */
  showOnEmpty?: boolean;
  tr: boolean;
};

/**
 * Yazarken tamamlama: öneriler giriş kutusunun ALTINDA, tıklanabilir hap düğmeler olarak akar
 * (açılır liste değil → kapsayıcı kırpmasına takılmaz, telefonda parmakla kolay seçilir).
 * Klavye: ↓/↑ ile gezin, Enter seçer, Esc kapatır. Öneri seçmek zorunlu değildir; kullanıcı kendi yazdığını da kullanır.
 */
export function SuggestInput({ value, onChange, suggest, placeholder, className, ariaLabel, disabled, autoComplete, showOnEmpty, tr }: Props) {
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(-1);
  const [closed, setClosed] = useState(false);
  const id = useId();
  const list = useMemo(() => (focus && !closed && (showOnEmpty || value.trim().length >= 1) ? suggest(value) : []), [focus, closed, value, suggest, showOnEmpty]);
  const exact = list.length === 1 && list[0].toLocaleLowerCase("tr") === value.trim().toLocaleLowerCase("tr");
  const shown = exact ? [] : list;

  const pick = (s: string) => {
    onChange(s);
    setHi(-1);
    setClosed(true);
  };
  return (
    <div>
      <input
        value={value}
        disabled={disabled}
        autoComplete={autoComplete ?? "off"}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={id}
        aria-autocomplete="list"
        className={className}
        onFocus={() => { setFocus(true); setClosed(false); }}
        onBlur={() => window.setTimeout(() => setFocus(false), 120)}
        onChange={(e) => { onChange(e.target.value); setHi(-1); setClosed(false); }}
        onKeyDown={(e) => {
          if (!shown.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % shown.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h <= 0 ? shown.length - 1 : h - 1)); }
          else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(shown[hi]); }
          else if (e.key === "Escape") setClosed(true);
        }}
      />
      {shown.length ? (
        <ul id={id} role="listbox" aria-label={tr ? "Öneriler" : "Suggestions"} className="mt-1.5 flex flex-wrap gap-1.5">
          {shown.map((s, i) => (
            <li key={s} role="option" aria-selected={i === hi}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${i === hi ? "border-sky-400 bg-sky-500/20 text-white" : "border-white/15 bg-white/[0.05] text-slate-200 hover:border-sky-400/50 hover:bg-sky-500/10"}`}>
                <Plus className="h-3 w-3 text-sky-300" />{s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
