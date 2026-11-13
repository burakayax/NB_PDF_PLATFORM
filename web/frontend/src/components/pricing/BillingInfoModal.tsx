import { useState, useEffect, useCallback } from "react";
import { User, Building2, MapPin, Phone, ShieldCheck, Lock, ArrowRight, ReceiptText } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getSaasApiBase } from "../../api/saasBase";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../../api/auth";
import { NbPhoneInput } from "../common/NbPhoneInput";
import { DISTANCE_SALES_DOCS_VERSION } from "../../content/legalVersion";
import { readAccessToken } from "../../lib/accessTokenStore";
import { getCountryCode } from "../../lib/geoCountry";
import { isValidPhoneNumber } from "libphonenumber-js";
import { validateCorporateTaxId } from "../../lib/taxId";
import { addressLineProblem, trLocationProblem, canonicalCity, canonicalDistrict } from "../../lib/addressCheck";
import { TR_LOCATIONS } from "../../lib/trLocations";

interface BillingFormState {
  invoiceType: "individual" | "corporate";
  firstName: string;
  lastName: string;
  companyName: string;
  tcKimlikNo: string;
  taxId: string;
  taxOffice: string;
  billingAddressLine: string;
  billingDistrict: string;
  city: string;
  billingCountryCode: string;
  billingPostalCode: string;
  phone: string;
  onBilgilendirmeAccepted: boolean;
  contractAccepted: boolean;
  withdrawalWaived: boolean;
  guardianDeclared: boolean;
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
  billingDistrict: "",
  city: "",
  billingCountryCode: "TR",
  billingPostalCode: "",
  phone: "",
  onBilgilendirmeAccepted: false,
  contractAccepted: false,
  withdrawalWaived: false,
  guardianDeclared: false,
};

function readToken(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return readAccessToken() ?? fallback;
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
    "onBilgilendirmeAccepted" | "contractAccepted" | "withdrawalWaived" | "guardianDeclared"
  > & {
    distanceSalesConsented: boolean;
    withdrawalWaived: boolean;
    guardianDeclared: boolean;
    documentVersion: string;
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
  /** Alan bazlı hata: kırmızı çerçeve + alanın hemen altında mesaj. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<BillingFormState>(EMPTY_FORM);

  const isTurkish = form.billingCountryCode === "TR";

  // Pre-fill from server on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
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
            billingDistrict:
              (saved.billingCountryCode ?? "TR") === "TR"
                ? canonicalDistrict(saved.city ?? "", saved.billingDistrict ?? "") ?? ""
                : saved.billingDistrict ?? "",
            city:
              (saved.billingCountryCode ?? "TR") === "TR"
                ? canonicalCity(saved.city ?? "") ?? ""
                : saved.city ?? "",
            // Kayıtlı ülke yoksa aşağıda IP'den tahmin edilir (yurt dışından gelen "Türkiye" ile başlamasın).
            billingCountryCode: saved.billingCountryCode ?? "TR",
            billingPostalCode: saved.billingPostalCode ?? "",
            phone: saved.phone ?? "",
            // tcKimlikNo sunucudan asla plaintext gelmez, kullanıcı her seferinde girer
            tcKimlikNo: "",
            onBilgilendirmeAccepted: false,
            contractAccepted: false,
            withdrawalWaived: false,
            guardianDeclared: false,
          }));
        }
        return saved;
      })
      .then(async (saved) => {
        if (saved?.billingCountryCode) return;
        // İlk kez dolduran: ülkeyi bağlantı konumundan öner (kullanıcı değiştirebilir).
        const cc = (await getCountryCode().catch(() => null))?.toUpperCase();
        if (cc && COUNTRIES.some((c) => c.code === cc)) {
          setForm((p) => (p.billingCountryCode === "TR" && !p.billingAddressLine ? { ...p, billingCountryCode: cc } : p));
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

  // Yazdıkça hata temizlenir; vergi numarası 10/11 hane olunca anında doğrulanıp kırmızı gösterilir.
  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(prev)) {
        if (k !== "taxId" && String((form as unknown as Record<string, unknown>)[k] ?? "").trim()) delete next[k];
      }
      if (form.invoiceType === "corporate" && /^\d{10,11}$/.test(form.taxId)) {
        const m = validateCorporateTaxId(form.taxId);
        if (m) next.taxId = m;
        else delete next.taxId;
      } else if (prev.taxId && form.taxId.trim() && !/^\d{10,11}$/.test(form.taxId)) {
        delete next.taxId;
      }
      // Telefon: dolu ve geçersizse anında kırmızı (boş bırakılabilir).
      if (form.phone.trim() && !isValidPhoneNumber(form.phone)) next.phone = tr ? "Telefon numarası geçersiz. Ülke kodunu seçip numarayı kontrol edin (örn. Türkiye: 0532 123 45 67)." : "Invalid phone number. Check the country and number.";
      else delete next.phone;
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [form, tr]);

  const isValid = useCallback(() => {
    if (!form.firstName.trim() || !form.lastName.trim()) return false;
    if (!form.billingAddressLine.trim()) return false;
    if (!form.city.trim()) return false;
    // Yurt içi alıcıda ilçe zorunlu (VUK md. 230: eksiksiz adres). Yurt dışında ilçe kavramı ülkeye göre değişir.
    if (isTurkish && !form.billingDistrict.trim()) return false;
    if (!form.billingCountryCode) return false;
    if (addressLineProblem(form.billingAddressLine, form.billingCountryCode)) return false;
    if (isTurkish && trLocationProblem(form.city, form.billingDistrict)) return false;
    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) return false;
    if (!form.onBilgilendirmeAccepted || !form.contractAccepted || !form.withdrawalWaived || !form.guardianDeclared) return false;
    if (isTurkish && form.invoiceType === "corporate") {
      if (
        !form.companyName.trim() ||
        !form.taxId.trim() ||
        !form.taxOffice.trim()
      )
        return false;
      if (validateCorporateTaxId(form.taxId) !== null) return false;
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
      const fe: Record<string, string> = {};
      const need = tr ? "Bu alan zorunlu." : "This field is required.";
      if (!form.firstName.trim()) fe.firstName = need;
      if (!form.lastName.trim()) fe.lastName = need;
      if (!form.billingAddressLine.trim()) fe.billingAddressLine = need;
      if (!form.city.trim()) fe.city = need;
      if (form.billingAddressLine.trim()) {
        const ap = addressLineProblem(form.billingAddressLine, form.billingCountryCode);
        if (ap) fe.billingAddressLine = ap;
      }
      if (isTurkish && form.city.trim() && form.billingDistrict.trim()) {
        const lp = trLocationProblem(form.city, form.billingDistrict);
        if (lp?.city) fe.city = lp.city;
        if (lp?.district) fe.billingDistrict = lp.district;
      }
      if (form.phone.trim() && !isValidPhoneNumber(form.phone)) fe.phone = tr ? "Telefon numarası geçersiz. Ülke kodunu seçip numarayı kontrol edin (örn. Türkiye: 0532 123 45 67)." : "Invalid phone number. Check the country and number.";
      if (isTurkish && !form.billingDistrict.trim()) fe.billingDistrict = need;
      if (isTurkish && form.invoiceType === "corporate") {
        if (!form.companyName.trim()) fe.companyName = need;
        if (!form.taxOffice.trim()) fe.taxOffice = need;
        if (!form.taxId.trim()) fe.taxId = need;
        else {
          const m = validateCorporateTaxId(form.taxId);
          if (m) fe.taxId = m;
        }
      }
      setFieldErrors(fe);
      setError(
        tr
          ? "Lütfen tüm zorunlu alanları doldurun."
          : "Please fill all required fields.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
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
          billingDistrict: form.billingDistrict,
          city: form.city,
          billingCountryCode: form.billingCountryCode,
          billingPostalCode: form.billingPostalCode,
          phone: form.phone,
          // Hem ön bilgilendirme hem sözleşme ayrı ayrı onaylanmadan kayıt oluşmaz.
          distanceSalesConsented: form.onBilgilendirmeAccepted && form.contractAccepted,
          withdrawalWaived: form.withdrawalWaived,
          guardianDeclared: form.guardianDeclared,
          documentVersion: DISTANCE_SALES_DOCS_VERSION,
        },
        tr,
      );
      onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Sunucu vergi numarasını reddettiyse hata ilgili alanda gösterilsin.
      if (/açık adres|address looks/i.test(msg)) {
        setFieldErrors({ billingAddressLine: msg });
        setSaving(false);
        return;
      }
      if (/listeden bir il/i.test(msg)) {
        setFieldErrors({ city: msg });
        setSaving(false);
        return;
      }
      if (/ilçe seçin/i.test(msg)) {
        setFieldErrors({ billingDistrict: msg });
        setSaving(false);
        return;
      }
      if (/telefon|phone/i.test(msg)) {
        setFieldErrors({ phone: msg });
        setSaving(false);
        return;
      }
      if (/vergi|t\.c\. kimlik|tax/i.test(msg) && form.invoiceType === "corporate") {
        setFieldErrors({ taxId: msg });
        setSaving(false);
        return;
      }
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
    "w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder-slate-600 outline-none transition duration-150 hover:border-white/[0.16] hover:bg-white/[0.05] focus:border-indigo-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-indigo-500/10";
  const lbl =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";
  const sec = (icon: React.ReactNode, text: string) => (
    <div className="flex items-center gap-2.5 pt-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/25 to-blue-500/10 text-indigo-200 ring-1 ring-indigo-400/20">
        {icon}
      </span>
      <h3 className="text-[13px] font-bold tracking-wide text-slate-100">{text}</h3>
      <span className="h-px flex-1 bg-gradient-to-r from-white/[0.12] to-transparent" aria-hidden />
    </div>
  );
  const req = <span className="text-red-400 ml-0.5">*</span>;
  const bad = " !border-red-500/70 !bg-red-500/[0.06] focus:!border-red-500 focus:!ring-red-500/30";
  const fieldMsg = (k: string) =>
    fieldErrors[k] ? (
      <p role="alert" className="mt-1 text-[12px] font-medium text-red-400">
        {fieldErrors[k]}
      </p>
    ) : null;
  const clearErr = (k: string) =>
    setFieldErrors((e) => {
      if (!e[k]) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/[0.09] bg-gradient-to-b from-[#0e1326] via-[#0a0e1d] to-[#060910] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(99,102,241,0.08)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/[0.07] px-6 pb-5 pt-6 sm:px-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
          <button
            type="button"
            aria-label={tr ? "Kapat" : "Close"}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-slate-400 transition hover:bg-white/[0.12] hover:text-white"
            onClick={onClose}
          >
            ×
          </button>
          {/* Adım göstergesi */}
          <ol className="relative mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]" aria-label={tr ? "Adımlar" : "Steps"}>
            <li className="flex items-center gap-2 text-white" aria-current="step">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-[11px] shadow-[0_6px_16px_-4px_rgba(79,70,229,0.7)]">1</span>
              {tr ? "Fatura bilgileri" : "Billing details"}
            </li>
            <span className="h-px w-8 bg-white/15 sm:w-14" aria-hidden />
            <li className="flex items-center gap-2 text-slate-500">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[11px]">2</span>
              {tr ? "Ödeme" : "Payment"}
            </li>
          </ol>
          <h2 className="relative bg-gradient-to-r from-white to-slate-300 bg-clip-text text-[22px] font-extrabold tracking-tight text-transparent sm:text-2xl">
            {tr ? "Fatura Bilgileri" : "Billing Information"}
          </h2>
          <p className="relative mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-400">
            {tr
              ? "Yasal e-arşiv fatura düzenlenebilmesi için aşağıdaki bilgiler gerekmektedir."
              : "Required to generate your legal e-invoice."}
          </p>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-9">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {tr ? "Yükleniyor…" : "Loading…"}
            </div>
          ) : (
            <>
              {sec(<ReceiptText className="h-3.5 w-3.5" aria-hidden />, tr ? "Fatura türü ve kimlik" : "Invoice type & identity")}
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
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.08] bg-black/25 p-1.5" role="radiogroup">
                    {(["individual", "corporate"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={form.invoiceType === type}
                        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-150 ${form.invoiceType === type ? "bg-gradient-to-br from-indigo-500/90 to-blue-600/90 text-white shadow-[0_8px_22px_-8px_rgba(79,70,229,0.8)] ring-1 ring-white/15" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"}`}
                        onClick={() =>
                          setForm((p) => ({ ...p, invoiceType: type }))
                        }
                      >
                        {type === "individual" ? <User className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
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
                    className={inp + (fieldErrors.firstName ? bad : "")}
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    placeholder={tr ? "Adınız" : "First name"}
                  />
{fieldMsg("firstName")}
                </div>
                <div>
                  <label className={lbl}>
                    {tr ? "Soyad" : "Last Name"}
                    {req}
                  </label>
                  <input
                    className={inp + (fieldErrors.lastName ? bad : "")}
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                    placeholder={tr ? "Soyadınız" : "Last name"}
                  />
{fieldMsg("lastName")}
                </div>
              </div>

              {/* TC No — bireysel kullanıcı için opsiyonel; boş bırakılırsa fatura GİB standart 11111111111 ile kesilir */}
              {isTurkish && form.invoiceType === "individual" && (
                <div>
                  <label className={lbl}>
                    TC Kimlik No{" "}
                    <span className="font-normal text-slate-400">
                      {tr ? "(opsiyonel)" : "(optional)"}
                    </span>
                  </label>
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
                    placeholder={tr ? "11 haneli TC Kimlik No (boş bırakabilirsiniz)" : "11-digit national ID (optional)"}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[12px] text-slate-400">
                    {tr
                      ? "İsteğe bağlıdır — boş bırakırsanız faturanız yasal olarak nihai tüketici (11111111111) adına düzenlenir. Girerseniz AES-256-GCM ile şifrelenir ve yalnızca e-arşiv fatura için kullanılır."
                      : "Optional — if left blank, your invoice is issued to a final consumer (11111111111) as permitted by law. If provided, it is encrypted with AES-256-GCM and used solely for e-invoice generation."}
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
                      className={inp + (fieldErrors.companyName ? bad : "")}
                      type="text"
                      value={form.companyName}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, companyName: e.target.value }))
                      }
                      placeholder={tr ? "Şirket ünvanı" : "Company name"}
                    />
{fieldMsg("companyName")}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>
                        {tr ? "Vergi Kimlik No" : "Tax ID"}
                        {req}
                      </label>
                      <input
                        className={inp + (fieldErrors.taxId ? bad : "")}
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={form.taxId}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            taxId: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        placeholder={tr ? "10 haneli VKN (şahıs işletmesi: 11 haneli T.C. Kimlik No)" : "10-digit tax ID (sole proprietors: 11-digit national ID)"}
                      />
{fieldMsg("taxId")}
                    </div>
                    <div>
                      <label className={lbl}>
                        {tr ? "Vergi Dairesi" : "Tax Office"}
                        {req}
                      </label>
                      <input
                        className={inp + (fieldErrors.taxOffice ? bad : "")}
                        type="text"
                        value={form.taxOffice}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, taxOffice: e.target.value }))
                        }
                        placeholder={tr ? "Vergi dairesi" : "Tax office"}
                      />
{fieldMsg("taxOffice")}
                    </div>
                  </div>
                </>
              )}

              {sec(<MapPin className="h-3.5 w-3.5" aria-hidden />, tr ? "Fatura adresi" : "Billing address")}
              {/* Adres */}
              <div>
                <label className={lbl}>
                  {tr ? "Açık Adres" : "Address"}
                  {req}
                </label>
                <input
                  className={inp + (fieldErrors.billingAddressLine ? bad : "")}
                  type="text"
                  value={form.billingAddressLine}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      billingAddressLine: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    // Alandan çıkınca anlamsız adres (asdfsd gibi) hemen kırmızı gösterilir.
                    const ap = form.billingAddressLine.trim() ? addressLineProblem(form.billingAddressLine, form.billingCountryCode) : null;
                    setFieldErrors((e) => {
                      const next = { ...e };
                      if (ap) next.billingAddressLine = ap;
                      else delete next.billingAddressLine;
                      return next;
                    });
                  }}
                  placeholder={
                    tr ? "Mahalle, sokak/cadde, bina ve daire no" : "Street address and number"
                  }
                />
                {fieldMsg("billingAddressLine")}
              </div>
              <div className={`grid gap-3 ${isTurkish ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <div>
                  <label className={lbl}>
                    {tr ? "Şehir" : "City"}
                    {req}
                  </label>
                  {isTurkish ? (
                    <select
                      className={inp + " cursor-pointer bg-[#0d1120] text-white [color-scheme:dark]" + (fieldErrors.city ? bad : "")}
                      value={form.city}
                      autoComplete="address-level1"
                      onChange={(e) => {
                        const v = e.target.value;
                        // İl değişince ilçe sıfırlanır (ilçe seçili ile ait olmalı).
                        setForm((p) => ({ ...p, city: v, billingDistrict: "" }));
                        setFieldErrors((er) => {
                          const { city: _c, billingDistrict: _d, ...rest } = er;
                          return rest;
                        });
                      }}
                    >
                      <option value="" style={{ backgroundColor: "#0d1120", color: "#ffffff" }}>
                        {tr ? "İl seçin" : "Select province"}
                      </option>
                      {Object.keys(TR_LOCATIONS).map((c) => (
                        <option key={c} value={c} style={{ backgroundColor: "#0d1120", color: "#ffffff" }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inp + (fieldErrors.city ? bad : "")}
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder={tr ? "Şehir" : "City"}
                    />
                  )}
                  {fieldMsg("city")}
                </div>
                {isTurkish && (
                  <div>
                    <label className={lbl}>
                      {tr ? "İlçe" : "District"}
                      {req}
                    </label>
                    <select
                      className={inp + " cursor-pointer bg-[#0d1120] text-white [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-50" + (fieldErrors.billingDistrict ? bad : "")}
                      value={form.billingDistrict}
                      disabled={!form.city}
                      autoComplete="address-level2"
                      onChange={(e) => setForm((p) => ({ ...p, billingDistrict: e.target.value }))}
                    >
                      <option value="" style={{ backgroundColor: "#0d1120", color: "#ffffff" }}>
                        {form.city ? (tr ? "İlçe seçin" : "Select district") : (tr ? "Önce il seçin" : "Select province first")}
                      </option>
                      {(TR_LOCATIONS[form.city] ?? []).map((d) => (
                        <option key={d} value={d} style={{ backgroundColor: "#0d1120", color: "#ffffff" }}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {fieldMsg("billingDistrict")}
                  </div>
                )}
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
              <p className="-mt-1 text-[12px] leading-relaxed text-slate-400">
                {tr
                  ? isTurkish
                    ? "Neden istiyoruz? Vergi Usul Kanunu (md. 230) gereği faturada alıcının adı-soyadı ve adresi bulunmak zorundadır. Adresinizi ilçe ve il bilgisiyle birlikte eksiksiz yazmanız faturanızın geçerli olmasını sağlar. Bu bilgi yalnızca fatura düzenlemek için kullanılır, şifreli saklanır ve üçüncü kişilerle pazarlama amacıyla paylaşılmaz."
                    : "Neden istiyoruz? Hizmeti Türkiye'den sattığımız için Türk vergi mevzuatı gereği faturada alıcının adı-soyadı ve adresi bulunmak zorundadır. Bu bilgi yalnızca fatura düzenlemek için kullanılır, şifreli saklanır ve pazarlama amacıyla paylaşılmaz."
                  : isTurkish
                    ? "Why we ask: Turkish tax law (VUK art. 230) requires the buyer's name and address, including district and city, on every invoice. It is used only to issue your invoice, stored encrypted, and never shared for marketing."
                    : "Why we ask: because we sell from Turkey, Turkish tax law requires the buyer's name and address on every invoice. It is used only to issue your invoice, stored encrypted, and never shared for marketing."}
              </p>

              {sec(<Phone className="h-3.5 w-3.5" aria-hidden />, tr ? "İletişim" : "Contact")}
              {/* Telefon — ülke kodu bayraklı açılır menüden seçilir, IP'den otomatik tespit edilir */}
              <div>
                <label className={lbl}>{tr ? "Telefon" : "Phone"}</label>
                <NbPhoneInput
                  language={language}
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                />
                {fieldMsg("phone")}
              </div>

              {sec(<ShieldCheck className="h-3.5 w-3.5" aria-hidden />, tr ? "Onaylar" : "Consents")}
              {/* FIX 4: Geliştirilmiş KVKK bilgi metni */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] leading-relaxed text-slate-400">
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
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] leading-relaxed text-slate-400">
                  <p className="mb-1 font-semibold text-amber-400/80">
                    {tr
                      ? "⚠ Yasal Cayma Hakkı Bildirimi"
                      : "⚠ Legal Withdrawal Notice"}
                  </p>
                  {tr
                    ? "Mesafeli Sözleşmeler Yönetmeliği uyarınca 14 gün içinde cayma hakkınız vardır. Ancak abonelik hizmeti ödemeyle birlikte hemen başladığı için, elektronik ortamda anında ifa edilen hizmetler ile onayınızla ifasına başlanan hizmetlerde cayma hakkı kullanılamaz (Yönetmelik madde 15/1-ğ ve 15/1-h). Aşağıdaki onayı vererek bu durumu kabul etmiş olursunuz."
                    : "Under the Distance Contracts Regulation you have a 14-day right of withdrawal. However, because the subscription starts immediately upon payment, the right cannot be exercised for services performed instantly in electronic form or services started with your consent (Regulation Art. 15/1-ğ and 15/1-h). By giving the approval below you accept this."}
                </div>

                {/* Blok B: Gönüllü iade garantisi (bilgi) */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-[12px] leading-relaxed text-slate-400">
                  <p className="mb-1 font-semibold text-emerald-400/80">
                    {tr
                      ? "✓ 7 Günlük İade Garantisi"
                      : "✓ 7-Day Refund Guarantee"}
                  </p>
                  {tr
                    ? "Yasal zorunluluk olmaksızın, memnun kalmamanız halinde ilk 7 gün içinde destek ekibimize başvurarak tam iade talep edebilirsiniz. Bu gönüllü taahhüdümüzdür."
                    : "As a voluntary commitment beyond legal requirements, if you are not satisfied you may request a full refund within the first 7 days by contacting our support team."}
                </div>

                {/* Ön bilgilendirme onayı */}
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left text-[12px] leading-relaxed text-slate-400 transition duration-150 hover:border-white/[0.16] has-[:checked]:border-indigo-400/40 has-[:checked]:bg-indigo-500/[0.07]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-white/20 bg-nb-bg-soft accent-indigo-500"
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

                {/* Mesafeli Satış Sözleşmesi — ön bilgilendirmeden AYRI onay (Yönetmelik: sözleşme ayrıca onaya sunulur) */}
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left text-[12px] leading-relaxed text-slate-400 transition duration-150 hover:border-white/[0.16] has-[:checked]:border-indigo-400/40 has-[:checked]:bg-indigo-500/[0.07]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-white/20 bg-nb-bg-soft accent-indigo-500"
                    checked={form.contractAccepted}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contractAccepted: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {tr ? (
                      <>
                        <a
                          href="/legal/mesafeli-satis"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nb-accent underline underline-offset-2"
                        >
                          Mesafeli Satış Sözleşmesi
                        </a>
                        'ni okudum ve onaylıyorum.{" "}
                        <span className="text-red-400">*</span>
                      </>
                    ) : (
                      <>
                        I have read and accept the{" "}
                        <a
                          href="/legal/mesafeli-satis"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nb-accent underline underline-offset-2"
                        >
                          Distance Sales Agreement
                        </a>
                        . <span className="text-red-400">*</span>
                      </>
                    )}
                  </span>
                </label>

                {/* Blok C: Cayma hakkı feragati (zorunlu onay) */}
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left text-[12px] leading-relaxed text-slate-400 transition duration-150 hover:border-white/[0.16] has-[:checked]:border-indigo-400/40 has-[:checked]:bg-indigo-500/[0.07]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-white/20 bg-nb-bg-soft accent-indigo-500"
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

                {/* Blok D: Reşit olma / yasal temsilci beyanı (TMK md. 16) */}
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-left text-[12px] leading-relaxed text-slate-400 transition duration-150 hover:border-white/[0.16] has-[:checked]:border-indigo-400/40 has-[:checked]:bg-indigo-500/[0.07]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-white/20 bg-nb-bg-soft accent-indigo-500"
                    checked={form.guardianDeclared}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        guardianDeclared: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {tr ? (
                      <>
                        18 yaşını doldurduğumu veya 18 yaşından küçükse bu
                        satın alma için yasal temsilcimin (anne/baba/vasi)
                        onayının bulunduğunu beyan ederim.{" "}
                        <span className="text-red-400">*</span>
                      </>
                    ) : (
                      <>
                        I declare that I am at least 18 years old or, if I am
                        under 18, that my legal guardian (parent/guardian) has
                        approved this purchase.{" "}
                        <span className="text-red-400">*</span>
                      </>
                    )}
                  </span>
                </label>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[12.5px] font-medium text-red-300">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.08] bg-gradient-to-t from-[#05070d] to-[#0b0f1f]/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-9">
          <button
            type="button"
            className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-[1.05rem] text-[16px] font-bold tracking-tight text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/10 transition duration-200 hover:-translate-y-px hover:shadow-[0_22px_52px_-12px_rgba(99,102,241,0.9),inset_0_1px_0_rgba(255,255,255,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 active:translate-y-0 disabled:pointer-events-none disabled:opacity-40"
            disabled={saving || loading || !isValid()}
            onClick={() => void handleSubmit()}
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition duration-700 group-hover:left-full group-hover:opacity-100" aria-hidden />
            {saving ? (
              <>{tr ? "Kaydediliyor…" : "Saving…"}</>
            ) : (
              <>
                {tr ? "Devam Et ve Öde" : "Continue to Payment"}
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </>
            )}
          </button>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-slate-500">
            <Lock className="h-3 w-3" aria-hidden />
            {tr ? "Kart bilgileriniz sitemizde saklanmaz." : "Your card details are never stored on our servers."}
          </p>
        </div>
      </div>
    </div>
  );
}
