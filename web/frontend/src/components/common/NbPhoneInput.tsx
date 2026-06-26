import { useEffect, useRef, useState } from "react";
import PhoneInput, { type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { isValidPhoneNumber } from "libphonenumber-js";
import { getCountryCode } from "../../lib/geoCountry";

type NbPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Otomatik IP tespitini atlayıp ülkeyi sabitlemek için (ISO alpha-2, örn. "TR"). */
  defaultCountry?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  className?: string;
};

/**
 * Uluslararası telefon alanı. Ülke kodu (+90 vb.) bayraklı bir açılır menüden
 * SEÇİLİR — elle yazılmaz (countryCallingCodeEditable={false}). Başlangıç ülkesi,
 * kullanıcının IP'sinden (getCountryCode) otomatik tespit edilir; tespit başarısız
 * olursa veya `defaultCountry` verilirse o kullanılır (varsayılan TR).
 *
 * onChange daima E.164 döner (örn. +905321234567).
 * `react-phone-number-input/style.css` bir kez import edilmelidir (main.tsx).
 */
export function NbPhoneInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  defaultCountry,
  className,
  "aria-invalid": ariaInvalid,
}: NbPhoneInputProps) {
  const [country, setCountry] = useState<Country>(
    (defaultCountry as Country) || "TR",
  );
  // Otomatik tespit en fazla bir kez uygulanır; kullanıcı değer girdiyse hiç uygulanmaz.
  const appliedRef = useRef(false);

  useEffect(() => {
    if (defaultCountry || value.trim() || appliedRef.current) {
      return;
    }
    let active = true;
    void getCountryCode().then((cc) => {
      if (active && cc && !value.trim() && !appliedRef.current) {
        appliedRef.current = true;
        setCountry(cc as Country);
      }
    });
    return () => {
      active = false;
    };
  }, [defaultCountry, value]);

  return (
    <div className={className}>
      <PhoneInput
        // Geo tespiti çözülünce (değer henüz boşken) doğru ülkeyle yeniden kurulur.
        key={country}
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry={country}
        flags={flags}
        value={value.trim() ? value : undefined}
        onChange={(v) => onChange(typeof v === "string" ? v : "")}
        disabled={disabled}
        placeholder={placeholder ?? "Telefon numarası"}
        aria-invalid={ariaInvalid}
      />
    </div>
  );
}

export { isValidPhoneNumber };
