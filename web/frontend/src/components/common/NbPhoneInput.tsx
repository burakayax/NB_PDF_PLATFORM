import PhoneInput from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";

type NbPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  className?: string;
};

/**
 * TR-only field; E.164 onChange (e.g. +905321234567). Display shows +90 with national spacing.
 * Import `react-phone-number-input/style.css` once (e.g. in main.tsx).
 */
export function NbPhoneInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  className,
  "aria-invalid": ariaInvalid,
}: NbPhoneInputProps) {
  return (
    <div className={className}>
      <PhoneInput
        id={id}
        international
        countryCallingCodeEditable={false}
        defaultCountry="TR"
        countries={["TR"]}
        value={value.trim() ? value : undefined}
        onChange={(v) => onChange(typeof v === "string" ? v : "")}
        disabled={disabled}
        placeholder={placeholder ?? "+90 (5XX) XXX XX XX"}
        aria-invalid={ariaInvalid}
      />
    </div>
  );
}

export { isValidPhoneNumber };
