import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { AuthUser, UpdateProfileInput } from "../../api/auth";
import type { Language } from "../../i18n/landing";
import type { PlanId } from "../../lib/planConfig";
import { getMissingBillingFields } from "../../lib/billingProfile";
import { TURKISH_PROVINCES } from "../../lib/trCities";
import { NbPhoneInput } from "../common/NbPhoneInput";

type ProfileCompletionModalProps = {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  language: Language;
  tier: PlanId;
  /** Shown under the title (e.g. current plan label). */
  productHint?: string;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  onSavedAndContinue: (tier: PlanId) => Promise<void>;
  onOpenTerms: () => void;
  onOpenKvkk: () => void;
};

const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/60 px-4 py-3 text-sm text-nb-text outline-none transition duration-200 ease-out placeholder:text-nb-muted focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12";

function splitFromName(name: string | null | undefined): { first: string; last: string } {
  const t = name?.trim() ?? "";
  if (!t) {
    return { first: "", last: "" };
  }
  const i = t.indexOf(" ");
  if (i <= 0) {
    return { first: t, last: "" };
  }
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

export function ProfileCompletionModal({
  open,
  onClose,
  user,
  language,
  tier,
  productHint,
  updateProfile,
  onSavedAndContinue,
  onOpenTerms,
  onOpenKvkk,
}: ProfileCompletionModalProps) {
  const tr = language === "tr";

  const missing = useMemo(() => getMissingBillingFields(user), [user]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddressLine, setBillingAddressLine] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Turkey");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setLegalAccepted(false);
    const f = user.firstName?.trim() ?? "";
    const l = user.lastName?.trim() ?? "";
    if (f || l) {
      setFirstName(f);
      setLastName(l);
    } else {
      const s = splitFromName(user.name);
      setFirstName(s.first);
      setLastName(s.last);
    }
    setPhone(user.phone ?? "");
    setBillingAddressLine(user.billingAddressLine ?? "");
    setBillingPostalCode(user.billingPostalCode ?? "");
    setCity(user.city ?? "");
    setCountry(user.country?.trim() || "Turkey");
    setSubmitting(false);
    setApiError("");
  }, [open, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const needName = missing.includes("name");
    if (needName && (!firstName.trim() || !lastName.trim())) {
      setApiError(tr ? "Ad ve soyad gereklidir." : "First and last name are required.");
      return;
    }
    if (missing.includes("phone")) {
      const p = phone.trim();
      if (!p || !isValidPhoneNumber(p)) {
        setApiError(tr ? "Geçerli bir cep telefonu girin." : "Enter a valid mobile number.");
        return;
      }
    }
    if (missing.includes("billingAddressLine") && !billingAddressLine.trim()) {
      setApiError(tr ? "Adres gereklidir." : "Address is required.");
      return;
    }
    if (missing.includes("billingPostalCode") && !billingPostalCode.trim()) {
      setApiError(tr ? "Posta kodu gereklidir." : "Postal code is required.");
      return;
    }
    if (missing.includes("city") && !city.trim()) {
      setApiError(tr ? "Şehir seçin." : "Select a city.");
      return;
    }
    if (missing.includes("country") && !country.trim()) {
      setApiError(tr ? "Ülke gereklidir." : "Country is required.");
      return;
    }
    if (!legalAccepted) {
      setApiError(
        tr
          ? "Devam etmek için Kullanım Koşulları ve KVKK aydınlatma metnini onaylayın."
          : "You must accept the Terms of Use and the privacy disclosure to continue.",
      );
      return;
    }

    const payload: UpdateProfileInput = {
      firstName: needName
        ? firstName.trim()
        : user.firstName?.trim() || splitFromName(user.name).first || "",
      lastName: needName
        ? lastName.trim()
        : user.lastName?.trim() || splitFromName(user.name).last || "",
      phone: missing.includes("phone") ? phone.trim() : (user.phone ?? "").trim(),
      billingAddressLine: missing.includes("billingAddressLine")
        ? billingAddressLine.trim()
        : (user.billingAddressLine ?? "").trim(),
      billingPostalCode: missing.includes("billingPostalCode")
        ? billingPostalCode.trim()
        : (user.billingPostalCode ?? "").trim(),
      city: missing.includes("city") ? city.trim() : (user.city ?? "").trim(),
      country: missing.includes("country")
        ? country.trim()
        : (user.country ?? "").trim() || "Turkey",
    };

    setSubmitting(true);
    setApiError("");
    try {
      const next = await updateProfile(payload);
      if (!next) {
        setApiError(tr ? "Oturum bulunamadı." : "Session not found.");
        setSubmitting(false);
        return;
      }
      await onSavedAndContinue(tier);
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : tr ? "Kaydedilemedi." : "Could not save.";
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  const title = tr ? "Ödeme için eksik bilgiler" : "Complete missing billing details";
  const closeLabel = tr ? "Kapat" : "Close";

  return (
    <div
      className="contact-modal-backdrop z-[120]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        className="contact-modal max-h-[min(92vh,640px)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-completion-modal-title"
        aria-busy={submitting}
      >
        <div className="contact-modal__header">
          <div>
            <h2 id="billing-completion-modal-title">{title}</h2>
            {productHint ? <p className="mt-1 max-w-md text-sm font-normal text-nb-muted">{productHint}</p> : null}
          </div>
          <button
            type="button"
            className="contact-modal__close"
            onClick={() => (!submitting ? onClose() : undefined)}
            disabled={submitting}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>

        <form className="contact-modal__form" onSubmit={(e) => void handleSubmit(e)}>
          <p className="-mt-1 mb-3 text-xs leading-relaxed text-nb-muted">
            {tr
              ? "Ödeme için yalnızca eksik alanları doldurun. Telefon E.164 formatında (+90…) kaydedilir."
              : "Only missing fields are shown. Your phone is saved in E.164 format (+90…)."}
          </p>

          {apiError ? (
            <div
              className="mb-4 rounded-xl border border-rose-500/45 bg-rose-950/50 px-3 py-2.5 text-sm leading-snug text-rose-100"
              role="alert"
            >
              {apiError}
            </div>
          ) : null}

          {missing.includes("name") ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Ad" : "First name"}</span>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  disabled={submitting}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Soyad" : "Last name"}</span>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  disabled={submitting}
                  required
                />
              </label>
            </div>
          ) : null}

          {missing.includes("phone") ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Cep telefonu" : "Mobile phone"}</span>
              <NbPhoneInput
                className="[&_.PhoneInput]:rounded-xl [&_.PhoneInput]:border [&_.PhoneInput]:border-white/[0.08] [&_.PhoneInput]:bg-nb-bg-soft/60 [&_.PhoneInputInput]:rounded-r-xl [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:py-3 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-nb-text"
                value={phone}
                onChange={(v) => setPhone(v)}
                disabled={submitting}
                aria-invalid={apiError ? true : undefined}
              />
            </label>
          ) : null}

          {missing.includes("billingAddressLine") ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Adres satırı" : "Street address"}</span>
              <input
                type="text"
                autoComplete="street-address"
                value={billingAddressLine}
                onChange={(e) => setBillingAddressLine(e.target.value)}
                className={inputClass}
                disabled={submitting}
                required
              />
            </label>
          ) : null}

          {(missing.includes("billingPostalCode") || missing.includes("city")) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {missing.includes("billingPostalCode") ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Posta kodu" : "Postal code"}</span>
                  <input
                    type="text"
                    autoComplete="postal-code"
                    value={billingPostalCode}
                    onChange={(e) => setBillingPostalCode(e.target.value)}
                    className={inputClass}
                    disabled={submitting}
                    required
                  />
                </label>
              ) : null}
              {missing.includes("city") ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Şehir" : "City"}</span>
                  <select
                    value={city}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCity(v);
                      if (missing.includes("country")) {
                        setCountry("Turkey");
                      }
                    }}
                    className={inputClass}
                    disabled={submitting}
                    required
                  >
                    <option value="">{tr ? "Seçin…" : "Choose…"}</option>
                    {TURKISH_PROVINCES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          )}

          {missing.includes("country") ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-nb-muted">{tr ? "Ülke" : "Country"}</span>
              <input
                type="text"
                autoComplete="country-name"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
                disabled={submitting}
                required
              />
            </label>
          ) : null}

          <div className="mt-2 rounded-xl border border-white/[0.08] bg-nb-bg-soft/40 p-3">
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-nb-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-nb-bg-soft accent-nb-primary"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                disabled={submitting}
              />
              <span>
                {tr ? (
                  <>
                    <button
                      type="button"
                      className="text-nb-accent underline decoration-white/20 underline-offset-2 hover:decoration-nb-accent/80"
                      onClick={() => onOpenTerms()}
                    >
                      Kullanım Koşullarını
                    </button>{" "}
                    ve{" "}
                    <button
                      type="button"
                      className="text-nb-accent underline decoration-white/20 underline-offset-2 hover:decoration-nb-accent/80"
                      onClick={() => onOpenKvkk()}
                    >
                      KVKK Aydınlatma Metni
                    </button>
                    &apos;ni okudum, onaylıyorum.
                  </>
                ) : (
                  <>
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      className="text-nb-accent underline decoration-white/20 underline-offset-2 hover:decoration-nb-accent/80"
                      onClick={() => onOpenTerms()}
                    >
                      Terms of Use
                    </button>{" "}
                    and the{" "}
                    <button
                      type="button"
                      className="text-nb-accent underline decoration-white/20 underline-offset-2 hover:decoration-nb-accent/80"
                      onClick={() => onOpenKvkk()}
                    >
                      KVKK disclosure
                    </button>
                    .
                  </>
                )}
              </span>
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
            <div
              className="flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-4 opacity-90 sm:border-t-0 sm:pt-0"
              aria-label={tr ? "Kabul edilen ödeme yöntemleri" : "Accepted payment methods"}
            >
              <span className="text-sm font-bold tracking-tight text-[#00A7E0]">iyzico</span>
              <span className="text-sm font-black italic tracking-tight text-[#1434CB]">VISA</span>
              <svg className="h-7 w-10 shrink-0" viewBox="0 0 32 20" aria-hidden>
                <circle cx="12" cy="10" r="8" fill="#EB001B" />
                <circle cx="20" cy="10" r="8" fill="#F79E1B" />
              </svg>
            </div>

            <button type="submit" className="primary-action w-full shrink-0 sm:max-w-[280px]" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 shrink-0 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {tr ? "Kaydediliyor…" : "Saving…"}
              </span>
            ) : tr ? (
              "Kaydet ve ödemeye geç"
            ) : (
              "Save and continue to payment"
            )}
          </button>
          </div>

          <div className="mt-4 flex gap-3 rounded-xl border border-white/[0.06] bg-nb-bg/40 px-3 py-3 text-xs leading-relaxed text-nb-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
            <p>
              {tr
                ? "Ödemeleriniz İyzico güvencesiyle 256-bit SSL ile şifrelenir. Kart bilgileriniz asla sistemimizde saklanmaz."
                : "Your payments are encrypted with 256-bit SSL via iyzico. Card data is never stored on our systems."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
