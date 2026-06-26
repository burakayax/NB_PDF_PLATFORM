import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import rawFlags from "react-phone-number-input/flags";
import trLabels from "react-phone-number-input/locale/tr.json";
import enLabels from "react-phone-number-input/locale/en.json";
import { getCountryCode } from "../../lib/geoCountry";

type FlagComponent = ComponentType<{ title?: string }>;
const flags = rawFlags as unknown as Record<string, FlagComponent | undefined>;
const LABELS: Record<"tr" | "en", Record<string, string>> = {
  tr: trLabels as Record<string, string>,
  en: enLabels as Record<string, string>,
};

type NbPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Arayüz dili — ülke adlarının dili. Varsayılan "tr". */
  language?: "tr" | "en";
  /** Otomatik IP tespitini atlayıp ülkeyi sabitlemek için (ISO alpha-2, örn. "TR"). */
  defaultCountry?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  className?: string;
};

/** Yalnızca rakamları döndürür. */
function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Verilen ülke için ulusal formatta örnek numara (placeholder şablonu). */
function exampleTemplate(country: CountryCode): string {
  try {
    const ex = getExampleNumber(country, examples);
    return ex ? ex.formatNational() : "";
  } catch {
    return "";
  }
}

/** Rakamları o ülkenin "yazdıkça dolan" ulusal formatına dönüştürür. */
function formatNational(digits: string, country: CountryCode): string {
  if (!digits) return "";
  try {
    return new AsYouType(country).input(digits);
  } catch {
    return digits;
  }
}

/**
 * Uluslararası telefon alanı (tamamen özel tasarım).
 *
 * - Ülke kodu (+90 vb.) SOL TARAFTA AYRI BİR KUTUDA gösterilir; bu kutuya tıklanınca
 *   bayrak + ülke adı + arama kodu içeren, site temasına uygun (koyu zemin / açık yazı)
 *   ARANABİLİR bir liste açılır.
 * - Numara alanı, seçili ülkeye göre bir ŞABLON (örn. "0532 123 45 67") gösterir ve
 *   kullanıcı yazdıkça canlı olarak biçimlenir (AsYouType).
 * - Başlangıç ülkesi kullanıcının IP'sinden otomatik tespit edilir; `defaultCountry`
 *   verilirse veya mevcut bir değer varsa o kullanılır (varsayılan TR).
 *
 * onChange daima E.164 döner (örn. +905321234567).
 */
export function NbPhoneInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  language = "tr",
  defaultCountry,
  className,
  "aria-invalid": ariaInvalid,
}: NbPhoneInputProps) {
  const labels = LABELS[language] ?? LABELS.tr;

  const [country, setCountry] = useState<CountryCode>(
    (defaultCountry as CountryCode) || "TR",
  );
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // En son DIŞARI bildirdiğimiz E.164 — dış değer senkronu sırasında çatışmayı önler.
  const lastEmittedRef = useRef<string>("");
  const appliedGeoRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Tüm ülkeler — TR en başta, kalanlar yerelleştirilmiş ada göre sıralı.
  const allCountries = useMemo(() => {
    const list = getCountries().filter((c) => flags[c]);
    return list.sort((a, b) => {
      if (a === "TR") return -1;
      if (b === "TR") return 1;
      return (labels[a] ?? a).localeCompare(labels[b] ?? b, language);
    });
  }, [labels, language]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter((c) => {
      const name = (labels[c] ?? c).toLowerCase();
      const dial = getCountryCallingCode(c);
      return (
        name.includes(q) ||
        dial.includes(q.replace("+", "")) ||
        c.toLowerCase().includes(q)
      );
    });
  }, [allCountries, labels, search]);

  // Dış değer (E.164) değiştiğinde ülke + ulusal kısmı senkronla (örn. sunucudan ön-dolum).
  useEffect(() => {
    const v = value.trim();
    if (!v || v === lastEmittedRef.current) return;
    const parsed = parsePhoneNumberFromString(v);
    if (parsed) {
      if (parsed.country) setCountry(parsed.country);
      setNational(parsed.formatNational());
      lastEmittedRef.current = v;
    }
  }, [value]);

  // IP'den otomatik ülke tespiti — en fazla bir kez, yalnızca değer ve defaultCountry yokken.
  useEffect(() => {
    if (defaultCountry || value.trim() || appliedGeoRef.current) return;
    let active = true;
    void getCountryCode().then((cc) => {
      if (active && cc && flags[cc] && !value.trim() && !appliedGeoRef.current) {
        appliedGeoRef.current = true;
        setCountry(cc as CountryCode);
      }
    });
    return () => {
      active = false;
    };
  }, [defaultCountry, value]);

  // Dropdown dışına tıklayınca kapat.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Açılınca arama kutusuna odaklan.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch("");
  }, [open]);

  function emit(digits: string, forCountry: CountryCode) {
    if (!digits) {
      lastEmittedRef.current = "";
      onChange("");
      return;
    }
    const formatted = formatNational(digits, forCountry);
    const parsed = parsePhoneNumberFromString(formatted, forCountry);
    const e164 = parsed
      ? parsed.number
      : `+${getCountryCallingCode(forCountry)}${digits}`;
    lastEmittedRef.current = e164;
    onChange(e164);
  }

  function handleInput(raw: string) {
    const digits = onlyDigits(raw);
    setNational(formatNational(digits, country));
    emit(digits, country);
  }

  function pickCountry(c: CountryCode) {
    setCountry(c);
    setOpen(false);
    // Mevcut numarayı yeni ülkeye göre yeniden biçimle ve yeni arama koduyla bildir.
    const digits = onlyDigits(national);
    setNational(formatNational(digits, c));
    emit(digits, c);
  }

  const Flag = flags[country];
  const dialCode = (() => {
    try {
      return getCountryCallingCode(country);
    } catch {
      return "";
    }
  })();
  const template =
    placeholder ?? exampleTemplate(country) ?? "Telefon numarası";

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-stretch gap-2">
        {/* Ülke kodu kutusu (ayrı) */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={labels.country ?? "Country"}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition hover:bg-white/[0.07] focus:border-white/20 focus:ring-1 focus:ring-white/15 disabled:opacity-40"
        >
          {Flag ? (
            <span className="flex h-4 w-6 items-center overflow-hidden rounded-[2px]">
              <Flag title={labels[country] ?? country} />
            </span>
          ) : null}
          <span className="font-medium tabular-nums text-slate-200">
            +{dialCode}
          </span>
          <svg
            className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Numara — şablonu placeholder olarak gösterir, yazdıkça dolar */}
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={template}
          aria-invalid={ariaInvalid}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15"
        />
      </div>

      {/* Aranabilir ülke listesi */}
      {open && (
        <div className="absolute left-0 top-full z-[600] mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d1120] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
          <div className="border-b border-white/[0.07] p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === "tr" ? "Ülke ara…" : "Search country…"}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/20"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-slate-500">
                {language === "tr" ? "Sonuç yok" : "No results"}
              </li>
            ) : (
              filtered.map((c) => {
                const ItemFlag = flags[c];
                const active = c === country;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pickCountry(c)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-blue-500/15 text-blue-200"
                          : "text-slate-200 hover:bg-white/[0.06]"
                      }`}
                    >
                      {ItemFlag ? (
                        <span className="flex h-4 w-6 shrink-0 items-center overflow-hidden rounded-[2px]">
                          <ItemFlag title={labels[c] ?? c} />
                        </span>
                      ) : (
                        <span className="h-4 w-6 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{labels[c] ?? c}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        +{getCountryCallingCode(c)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export { isValidPhoneNumber };
