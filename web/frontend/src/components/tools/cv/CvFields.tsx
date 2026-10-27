import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { CvPopover } from "./CvPopover";
import { COUNTRIES, DEFAULT_COUNTRY, applyMask, composePhone, countryByIso, countryFromCity, nationalDigits, parsePhone, type CountryPhone } from "./cvPhone";

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-[14px] text-white placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";

const errCls = "!border-amber-400/60 !ring-2 !ring-amber-400/20";

// ── Telefon ────────────────────────────────────────────────────────────────

type PhoneProps = { label: string; value: string; onChange: (v: string) => void; city: string; tr: boolean; error?: string | null; disabled?: boolean };

/**
 * Ülke kodlu telefon alanı. Şehir yazıldıysa ülke ondan seçilir; yazılmadıysa +90.
 * Kullanıcı ülkeyi elle seçtiyse artık şehre göre değişmez. Yazdıkça numara ülkenin biçimine girer.
 */
export function PhoneField({ label, value, onChange, city, tr, error, disabled }: PhoneProps) {
  const [iso, setIso] = useState<string>(() => (value ? parsePhone(value).country.iso : countryFromCity(city) ?? DEFAULT_COUNTRY));
  const [manual, setManual] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLButtonElement>(null);

  // Şehre göre otomatik ülke: yalnızca numara boşken ve kullanıcı elle seçmediyse
  useEffect(() => {
    if (manual || value.trim()) return;
    setIso(countryFromCity(city) ?? DEFAULT_COUNTRY);
  }, [city, manual, value]);

  const parsed = value.trim() ? parsePhone(value, iso) : { country: countryByIso(iso), national: "" };
  const country = parsed.country;
  const shown = applyMask(parsed.national, country.mask);

  function typed(raw: string) {
    // Tam uluslararası numara yapıştırıldıysa ülkeyi ondan al
    if (raw.trim().startsWith("+") || raw.trim().startsWith("00")) {
      const p = parsePhone(raw, iso);
      setIso(p.country.iso);
      setManual(true);
      onChange(composePhone(p.national, p.country));
      return;
    }
    onChange(composePhone(nationalDigits(raw, country), country));
  }

  function pick(c: CountryPhone) {
    setIso(c.iso);
    setManual(true);
    setOpen(false);
    setQ("");
    // Girilmiş rakamları yeni ülkenin biçimine taşı
    onChange(parsed.national ? composePhone(parsed.national, c) : "");
  }

  const list = useMemo(() => {
    const f = q.trim().toLocaleLowerCase("tr");
    const base = COUNTRIES.filter((c) => !f || c.tr.toLocaleLowerCase("tr").includes(f) || c.en.toLowerCase().includes(f) || c.iso.toLowerCase() === f || `+${c.dial}`.startsWith(f.startsWith("+") ? f : `+${f}`));
    return [...base].sort((a, b) => (a.iso === country.iso ? -1 : b.iso === country.iso ? 1 : 0));
  }, [q, country.iso]);

  return (
    <div>
      <span className="mb-1 block text-[12px] font-semibold text-slate-300">{label}</span>
      <div className={`flex items-stretch rounded-xl border border-white/10 bg-slate-900/60 focus-within:border-sky-400/60 focus-within:ring-2 focus-within:ring-sky-400/20 ${error ? errCls : ""} ${disabled ? "opacity-50" : ""}`}>
        <button
          ref={btn}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={tr ? `Ülke kodu: ${country.tr} +${country.dial}. Değiştirmek için tıklayın` : `Country code: ${country.en} +${country.dial}. Click to change`}
          className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-white/10 px-2.5 text-[13px] font-semibold text-slate-100 hover:bg-white/[0.06]"
        >
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-slate-300">{country.iso}</span>
          <span>+{country.dial}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={shown}
          onChange={(e) => typed(e.target.value)}
          placeholder={applyMask("5321234567890", country.mask)}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
        />
      </div>
      {error ? <span className="mt-1 flex items-start gap-1 text-[12px] font-medium text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</span> : null}
      <CvPopover anchor={btn} open={open} onClose={() => setOpen(false)} width={320} label={tr ? "Ülke kodu seçin" : "Choose a country code"}>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr ? "Ülke ya da kod ara (ör. Almanya, +49)" : "Search country or code (e.g. Germany, +49)"} className={`${inputCls} !pl-9`} />
        </div>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1" role="listbox">
          {list.map((c) => (
            <li key={c.iso} role="option" aria-selected={c.iso === country.iso}>
              <button type="button" onClick={() => pick(c)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/10 ${c.iso === country.iso ? "bg-sky-500/15 text-white" : "text-slate-200"}`}>
                <span className="w-7 shrink-0 rounded bg-white/10 px-1 py-0.5 text-center text-[11px] font-bold text-slate-300">{c.iso}</span>
                <span className="min-w-0 flex-1 truncate">{tr ? c.tr : c.en}</span>
                <span className="shrink-0 text-slate-400">+{c.dial}</span>
                {c.iso === country.iso ? <Check className="h-4 w-4 shrink-0 text-sky-300" /> : null}
              </button>
            </li>
          ))}
          {!list.length ? <li className="px-2 py-3 text-[12.5px] text-slate-400">{tr ? "Bulunamadı." : "No match."}</li> : null}
        </ul>
      </CvPopover>
    </div>
  );
}

// ── Ay / yıl seçici ────────────────────────────────────────────────────────

const MONTHS: Record<"tr" | "en", string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG: Record<"tr" | "en", string[]> = {
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const MIN_YEAR = 1950;

type MonthProps = { label: string; value: string; onChange: (v: string) => void; tr: boolean; disabled?: boolean; error?: string | null; hint?: string };

/**
 * Modern ay/yıl seçici: tarayıcının eski "ay" kutusu yerine, yıl okları ve ay düğmeleriyle açılan pencere.
 * Yıla tıklayınca on yıllık yıl listesi açılır. Değer "YYYY-AA" biçimindedir.
 */
export function MonthField({ label, value, onChange, tr, disabled, error, hint }: MonthProps) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  const selY = m ? Number(m[1]) : null;
  const selM = m ? Number(m[2]) : null;
  const maxYear = curY + 8;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selY ?? curY);
  const [yearsView, setYearsView] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const lang = tr ? "tr" : "en";

  const toggle = () => {
    setYear(selY ?? curY);
    setYearsView(false);
    setOpen((o) => !o);
  };
  const close = useCallback(() => setOpen(false), []);
  const choose = (mo: number) => {
    onChange(`${year}-${String(mo).padStart(2, "0")}`);
    setOpen(false);
  };
  const decadeStart = Math.floor(year / 12) * 12;

  return (
    <div>
      <span className="mb-1 block text-[12px] font-semibold text-slate-300">{label}</span>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        className={`${inputCls} flex items-center gap-2 text-left ${error ? errCls : ""}`}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-sky-300/80" />
        <span className={`min-w-0 flex-1 truncate ${m ? "text-white" : "text-slate-500"}`}>{m ? `${MONTHS_LONG[lang][Number(m[2]) - 1]} ${m[1]}` : tr ? "Ay ve yıl seçin" : "Pick month and year"}</span>
        {m && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={tr ? "Tarihi temizle" : "Clear date"}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(""); } }}
            className="rounded-md p-0.5 text-slate-500 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>
      {error ? <span className="mt-1 flex items-start gap-1 text-[12px] font-medium text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</span> : hint ? <span className="mt-1 block text-[12px] text-slate-500">{hint}</span> : null}

      <CvPopover anchor={btn} open={open} onClose={close} width={296} label={tr ? "Ay ve yıl seçin" : "Pick month and year"}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label={yearsView ? (tr ? "Önceki yıllar" : "Earlier years") : (tr ? "Önceki yıl" : "Previous year")} disabled={yearsView ? decadeStart <= MIN_YEAR : year <= MIN_YEAR} onClick={() => setYear((y) => y - (yearsView ? 12 : 1))} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setYearsView((v) => !v)} aria-label={tr ? "Yıl listesini aç" : "Open year list"} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[15px] font-bold text-white hover:bg-white/10">
            {yearsView ? `${decadeStart} – ${decadeStart + 11}` : year}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${yearsView ? "rotate-180" : ""}`} />
          </button>
          <button type="button" aria-label={yearsView ? (tr ? "Sonraki yıllar" : "Later years") : (tr ? "Sonraki yıl" : "Next year")} disabled={yearsView ? decadeStart + 12 > maxYear : year >= maxYear} onClick={() => setYear((y) => y + (yearsView ? 12 : 1))} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {yearsView ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => {
              const off = y < MIN_YEAR || y > maxYear;
              return (
                <button key={y} type="button" disabled={off} onClick={() => { setYear(y); setYearsView(false); }} className={`rounded-xl px-2 py-2.5 text-[13.5px] font-semibold transition disabled:opacity-25 ${y === selY ? "bg-sky-500 text-white" : y === curY ? "bg-white/[0.07] text-sky-200 ring-1 ring-sky-400/40 hover:bg-white/15" : "text-slate-200 hover:bg-white/10"}`}>{y}</button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS[lang].map((name, i) => {
              const mo = i + 1;
              const isSel = selY === year && selM === mo;
              const isNow = year === curY && mo === curM;
              return (
                <button key={name} type="button" onClick={() => choose(mo)} aria-label={`${MONTHS_LONG[lang][i]} ${year}`} aria-pressed={isSel} className={`rounded-xl px-2 py-2.5 text-[13.5px] font-semibold transition ${isSel ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-[0_8px_20px_-8px_rgba(59,130,246,0.8)]" : isNow ? "bg-white/[0.07] text-sky-200 ring-1 ring-sky-400/40 hover:bg-white/15" : "text-slate-200 hover:bg-white/10"}`}>{name}</button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-400 hover:bg-white/10 hover:text-white">{tr ? "Temizle" : "Clear"}</button>
          <button type="button" onClick={() => { onChange(`${curY}-${String(curM).padStart(2, "0")}`); setOpen(false); }} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-sky-300 hover:bg-sky-500/10">{tr ? "Bu ay" : "This month"}</button>
        </div>
      </CvPopover>
    </div>
  );
}
