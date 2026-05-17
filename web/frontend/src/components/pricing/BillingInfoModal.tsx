import { useState, useEffect, useCallback } from "react";
import type { Language } from "../../i18n/landing";
import { getSaasApiBase } from "../../api/saasBase";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../../api/auth";

interface BillingFormState {
  invoiceType: "individual" | "corporate";
  firstName: string;
  lastName: string;
  companyName: string;
  tcKimlikNo: string;
  taxId: string;
  taxOffice: string;
  billingAddressLine: string;
  city: string;
  billingCountryCode: string;
  billingPostalCode: string;
  phone: string;
  onBilgilendirmeAccepted: boolean;
  withdrawalWaived: boolean;
}

export interface BillingInfoModalProps {
  open: boolean;
  language: Language;
  accessToken: string;
  onClose: () => void;
  onComplete: () => void;
}

// FIX 2: Tam ISO 3166-1 ülke listesi — Türkiye en başta
const COUNTRIES = [
  { code: "TR", name: "Türkiye" },
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (DRC)" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

const EMPTY_FORM: BillingFormState = {
  invoiceType: "individual",
  firstName: "",
  lastName: "",
  companyName: "",
  tcKimlikNo: "",
  taxId: "",
  taxOffice: "",
  billingAddressLine: "",
  city: "",
  billingCountryCode: "TR",
  billingPostalCode: "",
  phone: "",
  onBilgilendirmeAccepted: false,
  withdrawalWaived: false,
};

function readToken(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? fallback;
}

async function fetchSavedBillingInfo(
  token: string,
): Promise<Partial<BillingFormState> | null> {
  try {
    const t = readToken(token);
    const res = await fetch(`${getSaasApiBase()}/api/billing/info`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    return res.json() as Promise<Partial<BillingFormState>>;
  } catch {
    return null;
  }
}

function parseApiError(raw: string, tr: boolean): string {
  try {
    const obj = JSON.parse(raw) as {
      detail?: string;
      message?: string;
      error?: string;
    };
    const msg = obj.detail ?? obj.message ?? obj.error ?? "";
    if (msg) return msg;
  } catch {
    /* not JSON */
  }
  if (raw.toLowerCase().includes("not found")) {
    return tr
      ? "Servis bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin."
      : "Service not found. Please refresh and try again.";
  }
  if (
    raw.toLowerCase().includes("unauthorized") ||
    raw.toLowerCase().includes("401")
  ) {
    return tr
      ? "Oturum süreniz dolmuş olabilir. Lütfen yeniden giriş yapın."
      : "Your session may have expired. Please log in again.";
  }
  return tr
    ? "Bir hata oluştu. Lütfen tekrar deneyin."
    : "An error occurred. Please try again.";
}

async function saveBillingInfoApi(
  token: string,
  data: Omit<
    BillingFormState,
    "onBilgilendirmeAccepted" | "withdrawalWaived"
  > & {
    distanceSalesConsented: boolean;
    withdrawalWaived: boolean;
  },
  tr: boolean,
): Promise<void> {
  const t = readToken(token);
  const res = await fetch(`${getSaasApiBase()}/api/billing/info`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiError(text, tr));
  }
}

export function BillingInfoModal({
  open,
  language,
  accessToken,
  onClose,
  onComplete,
}: BillingInfoModalProps) {
  const tr = language === "tr";
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BillingFormState>(EMPTY_FORM);

  const isTurkish = form.billingCountryCode === "TR";

  // Pre-fill from server on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchSavedBillingInfo(accessToken)
      .then((saved) => {
        if (saved) {
          setForm((prev) => ({
            ...prev,
            invoiceType:
              (saved.invoiceType as "individual" | "corporate") ?? "individual",
            firstName: saved.firstName ?? "",
            lastName: saved.lastName ?? "",
            companyName: saved.companyName ?? "",
            taxId: saved.taxId ?? "",
            taxOffice: saved.taxOffice ?? "",
            billingAddressLine: saved.billingAddressLine ?? "",
            city: saved.city ?? "",
            billingCountryCode: saved.billingCountryCode ?? "TR",
            billingPostalCode: saved.billingPostalCode ?? "",
            phone: saved.phone ?? "",
            // tcKimlikNo sunucudan asla plaintext gelmez, kullanıcı her seferinde girer
            tcKimlikNo: "",
            onBilgilendirmeAccepted: false,
            withdrawalWaived: false,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, accessToken]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSaving(false);
      setForm(EMPTY_FORM);
    }
  }, [open]);

  const isValid = useCallback(() => {
    if (!form.firstName.trim() || !form.lastName.trim()) return false;
    if (!form.billingAddressLine.trim()) return false;
    if (!form.city.trim()) return false;
    if (!form.billingCountryCode) return false;
    if (!form.onBilgilendirmeAccepted || !form.withdrawalWaived) return false;
    if (isTurkish && form.invoiceType === "corporate") {
      if (
        !form.companyName.trim() ||
        !form.taxId.trim() ||
        !form.taxOffice.trim()
      )
        return false;
      if (!/^\d{10}$/.test(form.taxId.trim())) return false;
    }
    if (
      isTurkish &&
      form.invoiceType === "individual" &&
      form.tcKimlikNo.trim()
    ) {
      const tc = form.tcKimlikNo.trim();
      if (!/^\d{11}$/.test(tc) || tc[0] === "0") return false;
    }
    return true;
  }, [form, isTurkish]);

  const handleSubmit = useCallback(async () => {
    if (!isValid()) {
      setError(
        tr
          ? "Lütfen tüm zorunlu alanları doldurun."
          : "Please fill all required fields.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBillingInfoApi(
        accessToken,
        {
          invoiceType: form.invoiceType,
          firstName: form.firstName,
          lastName: form.lastName,
          companyName: form.companyName,
          tcKimlikNo: form.tcKimlikNo,
          taxId: form.taxId,
          taxOffice: form.taxOffice,
          billingAddressLine: form.billingAddressLine,
          city: form.city,
          billingCountryCode: form.billingCountryCode,
          billingPostalCode: form.billingPostalCode,
          phone: form.phone,
          distanceSalesConsented: form.onBilgilendirmeAccepted,
          withdrawalWaived: form.withdrawalWaived,
        },
        tr,
      );
      onComplete();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr
            ? "Bir hata oluştu. Lütfen tekrar deneyin."
            : "An error occurred. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [form, isValid, accessToken, tr, onComplete]);

  if (!open) return null;

  const inp =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/15";
  const lbl =
    "block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1";
  const req = <span className="text-red-400 ml-0.5">*</span>;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1120] to-[#060910] shadow-[0_48px_120px_-40px_rgba(0,0,0,0.85)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.07] px-6 py-5">
          <button
            type="button"
            aria-label={tr ? "Kapat" : "Close"}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]"
            onClick={onClose}
          >
            ×
          </button>
          <h2 className="text-lg font-bold text-white">
            {tr ? "Fatura Bilgileri" : "Billing Information"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {tr
              ? "Yasal e-arşiv fatura düzenlenebilmesi için aşağıdaki bilgiler gerekmektedir."
              : "Required to generate your legal e-invoice."}
          </p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              {tr ? "Yükleniyor…" : "Loading…"}
            </div>
          ) : (
            <>
              {/* FIX 2: Tam ülke listesi */}
              <div>
                <label className={lbl}>
                  {tr ? "Ülke" : "Country"}
                  {req}
                </label>
                <select
                  className={inp + " cursor-pointer bg-[#0d1120] text-white"}
                  value={form.billingCountryCode}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      billingCountryCode: e.target.value,
                    }))
                  }
                >
                  {COUNTRIES.map((c) => (
                    <option
                      key={c.code}
                      value={c.code}
                      style={{
                        backgroundColor: "#0d1120",
                        color: "#ffffff",
                      }}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fatura türü — yalnızca Türk kullanıcılar */}
              {isTurkish && (
                <div>
                  <label className={lbl}>
                    {tr ? "Fatura Türü" : "Invoice Type"}
                  </label>
                  <div className="flex gap-2">
                    {(["individual", "corporate"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${form.invoiceType === type ? "border-blue-500/50 bg-blue-500/15 text-blue-300" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"}`}
                        onClick={() =>
                          setForm((p) => ({ ...p, invoiceType: type }))
                        }
                      >
                        {type === "individual"
                          ? tr
                            ? "Bireysel"
                            : "Individual"
                          : tr
                            ? "Kurumsal"
                            : "Corporate"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ad / Soyad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>
                    {tr ? "Ad" : "First Name"}
                    {req}
                  </label>
                  <input
                    className={inp}
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    placeholder={tr ? "Adınız" : "First name"}
                  />
                </div>
                <div>
                  <label className={lbl}>
                    {tr ? "Soyad" : "Last Name"}
                    {req}
                  </label>
                  <input
                    className={inp}
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                    placeholder={tr ? "Soyadınız" : "Last name"}
                  />
                </div>
              </div>

              {/* FIX 5: TC No — "isteğe bağlı" ifadesi kaldırıldı, AES-256 güvenlik mesajı eklendi */}
              {isTurkish && form.invoiceType === "individual" && (
                <div>
                  <label className={lbl}>TC Kimlik No</label>
                  <input
                    className={inp}
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.tcKimlikNo}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tcKimlikNo: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="11 haneli TC Kimlik No"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {tr
                      ? "TC Kimlik No'nuz AES-256-GCM şifrelemesiyle güvenle saklanır ve yalnızca yasal e-arşiv fatura düzenlenmesi amacıyla kullanılır."
                      : "Your national ID is encrypted with AES-256-GCM and used solely for legal e-invoice generation."}
                  </p>
                </div>
              )}

              {/* Kurumsal alanlar */}
              {isTurkish && form.invoiceType === "corporate" && (
                <>
                  <div>
                    <label className={lbl}>
                      {tr ? "Şirket Ünvanı" : "Company Name"}
                      {req}
                    </label>
                    <input
                      className={inp}
                      type="text"
                      value={form.companyName}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, companyName: e.target.value }))
                      }
                      placeholder={tr ? "Şirket ünvanı" : "Company name"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>
                        {tr ? "Vergi Kimlik No" : "Tax ID"}
                        {req}
                      </label>
                      <input
                        className={inp}
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.taxId}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            taxId: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder="10 haneli VKN"
                      />
                    </div>
                    <div>
                      <label className={lbl}>
                        {tr ? "Vergi Dairesi" : "Tax Office"}
                        {req}
                      </label>
                      <input
                        className={inp}
                        type="text"
                        value={form.taxOffice}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, taxOffice: e.target.value }))
                        }
                        placeholder={tr ? "Vergi dairesi" : "Tax office"}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Adres */}
              <div>
                <label className={lbl}>
                  {tr ? "Açık Adres" : "Address"}
                  {req}
                </label>
                <input
                  className={inp}
                  type="text"
                  value={form.billingAddressLine}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      billingAddressLine: e.target.value,
                    }))
                  }
                  placeholder={
                    tr ? "Sokak, mahalle, bina no" : "Street address"
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>
                    {tr ? "Şehir" : "City"}
                    {req}
                  </label>
                  <input
                    className={inp}
                    type="text"
                    value={form.city}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, city: e.target.value }))
                    }
                    placeholder={tr ? "Şehir" : "City"}
                  />
                </div>
                <div>
                  <label className={lbl}>
                    {tr ? "Posta Kodu" : "Postal Code"}
                  </label>
                  <input
                    className={inp}
                    type="text"
                    value={form.billingPostalCode}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        billingPostalCode: e.target.value,
                      }))
                    }
                    placeholder="34000"
                  />
                </div>
              </div>

              {/* Telefon */}
              <div>
                <label className={lbl}>{tr ? "Telefon" : "Phone"}</label>
                <input
                  className={inp}
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder={
                    isTurkish ? "+90 5XX XXX XXXX" : "+1 234 567 8900"
                  }
                />
              </div>

              {/* FIX 4: Geliştirilmiş KVKK bilgi metni */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-500">
                {tr ? (
                  <>
                    Kişisel verileriniz,{" "}
                    <strong className="text-slate-400">KVKK Madde 5/2-ç</strong>{" "}
                    (kanuni yükümlülük) kapsamında e-arşiv fatura düzenlenmesi
                    amacıyla işlenmekte ve{" "}
                    <strong className="text-slate-400">VUK Madde 253</strong>{" "}
                    gereği 10 yıl süreyle güvenle saklanmaktadır. TC Kimlik No
                    dahil hassas veriler{" "}
                    <strong className="text-slate-400">AES-256-GCM</strong>{" "}
                    şifrelemesiyle korunmaktadır. Verileriniz hiçbir koşulda
                    üçüncü taraflarla ticari amaçla paylaşılmaz.
                  </>
                ) : (
                  <>
                    Your personal data is processed for e-invoice generation
                    under{" "}
                    <strong className="text-slate-400">KVKK Art. 5/2-ç</strong>{" "}
                    (legal obligation) and retained for 10 years per{" "}
                    <strong className="text-slate-400">Tax Law Art. 253</strong>
                    . Sensitive fields including national ID are protected with{" "}
                    <strong className="text-slate-400">AES-256-GCM</strong>{" "}
                    encryption. Your data is never shared with third parties for
                    commercial purposes.
                  </>
                )}
              </div>

              {/* FIX 3: Cayma hakkı — 3 blok yapısı */}
              <div className="space-y-3">
                {/* Blok A: Yasal uyarı (bilgi) */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[11px] leading-relaxed text-slate-400">
                  <p className="mb-1 font-semibold text-amber-400/80">
                    {tr
                      ? "⚠ Yasal Cayma Hakkı Bildirimi"
                      : "⚠ Legal Withdrawal Notice"}
                  </p>
                  {tr
                    ? "Mesafeli Sözleşmeler Yönetmeliği Madde 15/1-ğ uyarınca, dijital içerik ve abonelik hizmetlerinde ifaya başlandıktan sonra cayma hakkı kullanılamaz."
                    : "Under Distance Contracts Regulation Art. 15/1-ğ, the right of withdrawal cannot be exercised once performance of a digital content or subscription service has begun."}
                </div>

                {/* Blok B: Gönüllü iade garantisi (bilgi) */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-[11px] leading-relaxed text-slate-400">
                  <p className="mb-1 font-semibold text-emerald-400/80">
                    {tr
                      ? "✓ 7 Günlük Koşulsuz İade Garantisi"
                      : "✓ 7-Day Unconditional Refund Guarantee"}
                  </p>
                  {tr
                    ? "Yasal zorunluluk olmaksızın, memnun kalmamanız halinde ilk 7 gün içinde destek ekibimize başvurarak tam iade talep edebilirsiniz. Bu gönüllü taahhüdümüzdür."
                    : "As a voluntary commitment beyond legal requirements, if you are not satisfied you may request a full refund within the first 7 days by contacting our support team."}
                </div>

                {/* Ön bilgilendirme onayı */}
                <label className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left text-[12px] leading-relaxed text-slate-400">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-nb-bg-soft accent-nb-primary"
                    checked={form.onBilgilendirmeAccepted}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        onBilgilendirmeAccepted: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {tr ? (
                      <>
                        <a
                          href="/legal/on-bilgilendirme"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nb-accent underline underline-offset-2"
                        >
                          Ön Bilgilendirme Formu
                        </a>
                        'nu okudum ve onaylıyorum.{" "}
                        <span className="text-red-400">*</span>
                      </>
                    ) : (
                      <>
                        I have read and accept the{" "}
                        <a
                          href="/legal/on-bilgilendirme"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nb-accent underline underline-offset-2"
                        >
                          Pre-Purchase Information Form
                        </a>
                        . <span className="text-red-400">*</span>
                      </>
                    )}
                  </span>
                </label>

                {/* Blok C: Cayma hakkı feragati (zorunlu onay) */}
                <label className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left text-[12px] leading-relaxed text-slate-400">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-nb-bg-soft accent-nb-primary"
                    checked={form.withdrawalWaived}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        withdrawalWaived: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {tr ? (
                      <>
                        Yukarıdaki bilgileri okudum; dijital hizmetin ifasına
                        hemen başlanmasını talep ettiğimi ve yasal cayma
                        hakkımın bu nedenle geçerli olmayacağını anladım ve
                        kabul ediyorum. <span className="text-red-400">*</span>
                      </>
                    ) : (
                      <>
                        I have read the above information; I request that
                        performance of the digital service begins immediately
                        and understand that my statutory right of withdrawal
                        will therefore not apply.{" "}
                        <span className="text-red-400">*</span>
                      </>
                    )}
                  </span>
                </label>
              </div>

              {error && <p className="text-[12px] text-red-400">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] bg-gradient-to-t from-[#060910]/95 to-[#0d1120]/90 px-6 py-4">
          <button
            type="button"
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-[1.05rem] text-[16px] font-bold text-white shadow-[0_16px_40px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
            disabled={saving || loading || !isValid()}
            onClick={() => void handleSubmit()}
          >
            {saving
              ? tr
                ? "Kaydediliyor…"
                : "Saving…"
              : tr
                ? "Devam Et ve Öde →"
                : "Continue to Payment →"}
          </button>
        </div>
      </div>
    </div>
  );
}
