import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  User,
  FileOutput,
  FileSearch,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { HeroBackground } from "../landing/HeroBackground";
import { getGoogleOAuthStartUrl } from "../../api/auth";
import { TURKISH_PROVINCES } from "../../lib/trCities";
import { authTranslations, getAuthCopy } from "../../i18n/auth";
import type { Language } from "../../i18n/landing";
import { validateNewPasswordPolicy } from "../../lib/passwordPolicy";
import {
  SESSION_POST_OAUTH_ADMIN_VALUE,
  SESSION_POST_OAUTH_REDIRECT_KEY,
} from "../../lib/oauthRedirect";
import { trackGAEvent } from "../../lib/analytics";

/**
 * Giriş/kayıt ekranının SOL sütunu — marka ve kazanım paneli.
 * Masaüstünde formun yanında durur; dar ekranda gizlenir (form öne çıksın).
 * Metinler abartısızdır: hepsi üründe gerçekten var olan özellikler.
 */
function AuthBenefits({
  mode,
  language,
  adminPortal,
}: {
  mode: AuthMode;
  language: Language;
  adminPortal: boolean;
}) {
  const tr = language === "tr";
  const items: { Icon: LucideIcon; tr: string; en: string }[] = adminPortal
    ? [
        { Icon: ShieldCheck, tr: "Yalnızca yetkili yönetici hesapları", en: "Authorized administrator accounts only" },
        { Icon: FileOutput, tr: "Plan, kupon ve içerik yönetimi", en: "Plans, coupons and content management" },
        { Icon: Sparkles, tr: "Kullanım ve gelir raporları", en: "Usage and revenue reports" },
      ]
    : mode === "register"
      ? [
          { Icon: FileOutput, tr: "Word, Excel ve PowerPoint'e dönüştürme", en: "Convert to Word, Excel and PowerPoint" },
          { Icon: FileSearch, tr: "Taranmış belgeyi aranabilir metne çevirme", en: "Turn scanned documents into searchable text" },
          { Icon: Sparkles, tr: "Yapay zekâ ile özetleme ve veri çıkarma", en: "AI summaries and data extraction" },
          { Icon: ShieldCheck, tr: "Filigransız, reklamsız çıktı — her planda", en: "No watermark, no ads — on every plan" },
        ]
      : [
          { Icon: FileOutput, tr: "Kaldığınız belgeden devam edin", en: "Pick up from the document you left" },
          { Icon: FileSearch, tr: "Kaydettiğiniz taramalar hesabınızda durur", en: "Your saved scans stay in your account" },
          { Icon: Sparkles, tr: "Tüm araçlar tek çalışma alanında", en: "Every tool in one workspace" },
          { Icon: ShieldCheck, tr: "Filigransız, reklamsız çıktı", en: "No watermark, no ads" },
        ];

  return (
    <div className="max-w-[440px]">
      <div className="inline-flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-indigo-500/25 text-cyan-200 ring-1 ring-white/10">
          <FileOutput className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="text-[13px] font-bold uppercase tracking-[0.3em] text-slate-300">
          PDF Platform
        </span>
      </div>

      <h2 className="mt-7 text-[34px] font-extrabold leading-[1.15] tracking-tight text-white">
        {adminPortal
          ? tr ? "Yönetim paneline giriş" : "Sign in to the admin panel"
          : mode === "register"
            ? tr ? "Ücretsiz hesabınızı 30 saniyede açın" : "Open your free account in 30 seconds"
            : tr ? "Tekrar hoş geldiniz" : "Welcome back"}
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
        {adminPortal
          ? tr
            ? "Bu alan yalnızca yetkili hesaplar içindir."
            : "This area is for authorized accounts only."
          : mode === "register"
            ? tr
              ? "Kart istemez, ücret alınmaz. Üyelikle açılan araçları hemen kullanmaya başlayın."
              : "No card, no charge. Start using the tools an account unlocks right away."
            : tr
              ? "Çalışma alanınız, kayıtlı taramalarınız ve planınız sizi bekliyor."
              : "Your workspace, saved scans and plan are waiting for you."}
      </p>

      <ul className="mt-9 space-y-4">
        {items.map((item) => {
          const ItemIcon = item.Icon;
          return (
            <li key={item.en} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-cyan-300 ring-1 ring-white/10">
                <ItemIcon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="pt-1.5 text-[14px] leading-snug text-slate-300">
                {tr ? item.tr : item.en}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-xs leading-snug text-rose-400" role="alert">
      {msg}
    </p>
  );
}

type AuthMode = "login" | "register";

type AuthSubmitPayload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  marketingConsent?: boolean;
};

type AuthPageProps = {
  mode: AuthMode;
  /** Admin-only login route (`/admin-login`): hides registration UI and tags OAuth redirect. */
  purpose?: "default" | "admin";
  language: Language;
  submitting: boolean;
  serverError: string;
  /** Kayıt sonrası giriş sekmesinde gösterilen API başarı metni */
  registrationSuccessBanner?: string | null;
  onDismissRegistrationSuccess?: () => void;
  onBack: () => void;
  /** "Geri" butonu metni (verilmezse landing'e dönüş metni kullanılır). */
  backLabel?: string;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (payload: AuthSubmitPayload) => Promise<void>;
  onForgotPassword?: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenKvkk: () => void;
};

/**
 * FORM ALANLARI — tek bir görünüm dili.
 *  • Her alanın solunda ne istendiğini anlatan bir ikon var.
 *  • Odaklanınca kenar camgöbeğine döner ve etrafında yumuşak bir halka belirir;
 *    kullanıcı klavyeyle gezerken nerede olduğunu her zaman görür.
 *  • Hatalı alan kırmızı kenar + kırmızı halka alır (renk tek başına bırakılmaz,
 *    altında metin de yazar).
 */
const inputBase =
  "w-full rounded-xl border border-white/[0.09] bg-[#070c17]/80 py-3.5 pr-4 text-[15px] leading-snug text-nb-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 ease-out placeholder:text-slate-500 hover:border-white/20 focus:border-nb-primary/60 focus:bg-[#070c17] focus:ring-4 focus:ring-nb-primary/15";

/** İkonlu alanlar için sol boşluk; ikonsuz kullanımda px-4'e düşer. */
const inputClassName = `${inputBase} pl-11`;
const inputPlainClassName = `${inputBase} pl-4`;
const inputErrorClassName = " !border-rose-500/60 focus:!ring-rose-500/15";

/** Alanın solundaki sabit ikon. */
function FieldIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
      <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
    </span>
  );
}

/** Alan etiketi — hepsi aynı ağırlık ve boşlukta. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[13px] font-semibold text-slate-300">
      {children}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthPage({
  mode,
  purpose = "default",
  language,
  submitting,
  serverError,
  registrationSuccessBanner,
  onDismissRegistrationSuccess,
  onBack,
  backLabel,
  onModeChange,
  onSubmit,
  onForgotPassword,
  onOpenTerms,
  onOpenPrivacy,
  onOpenKvkk,
}: AuthPageProps) {
  const adminPortal = purpose === "admin";
  const copy = useMemo(() => getAuthCopy(language, mode), [language, mode]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registerCity, setRegisterCity] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [urlAuthError, setUrlAuthError] = useState("");
  const [urlEmailVerifiedNotice, setUrlEmailVerifiedNotice] = useState(false);

  // Per-field inline errors (local validation)
  const [firstNameErr, setFirstNameErr] = useState("");
  const [lastNameErr, setLastNameErr] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  function clearFieldErrors() {
    setFirstNameErr("");
    setLastNameErr("");
    setEmailErr("");
    setPasswordErr("");
  }

  // Map server error (already translated by parent) to the right field
  const { serverEmailErr, serverPasswordErr, serverGeneralErr } = useMemo(() => {
    if (!serverError) return { serverEmailErr: "", serverPasswordErr: "", serverGeneralErr: "" };
    const lower = serverError.toLowerCase();
    if (
      lower.includes("e-posta veya şifre") ||
      lower.includes("email or password") ||
      lower.includes("invalid email or password")
    ) {
      return { serverEmailErr: "", serverPasswordErr: serverError, serverGeneralErr: "" };
    }
    if (
      lower.includes("zaten var") ||
      lower.includes("already exists") ||
      lower.includes("doğrulayın") ||
      lower.includes("verify your email") ||
      lower.includes("oluşturulamaz") ||
      lower.includes("cannot be used") ||
      lower.includes("google sign-in") ||
      lower.includes("google ile")
    ) {
      return { serverEmailErr: serverError, serverPasswordErr: "", serverGeneralErr: "" };
    }
    return { serverEmailErr: "", serverPasswordErr: "", serverGeneralErr: serverError };
  }, [serverError]);

  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    const err = url.searchParams.get("oauth_error");
    if (err) {
      try {
        setUrlAuthError(decodeURIComponent(err.replace(/\+/g, " ")));
      } catch {
        setUrlAuthError(err);
      }
      url.searchParams.delete("oauth_error");
      changed = true;
    }
    if (url.searchParams.get("email_verified") === "1") {
      setUrlEmailVerifiedNotice(true);
      url.searchParams.delete("email_verified");
      changed = true;
    }
    if (changed) {
      const qs = url.searchParams.toString();
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
      );
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFieldErrors();

    const tr = language === "tr";
    let hasErr = false;

    if (mode === "register") {
      if (!firstName.trim()) {
        setFirstNameErr(tr ? "Ad gereklidir." : "First name is required.");
        hasErr = true;
      }
      if (!lastName.trim()) {
        setLastNameErr(tr ? "Soyad gereklidir." : "Last name is required.");
        hasErr = true;
      }
    }

    if (!email.trim()) {
      setEmailErr(tr ? "E-posta adresi gereklidir." : "Email address is required.");
      hasErr = true;
    }

    if (mode === "register") {
      const policy = validateNewPasswordPolicy(password);
      if (!policy.ok) {
        setPasswordErr(
          tr ? policy.issues.map((i) => i.tr).join(" · ") : policy.issues.map((i) => i.en).join(" · "),
        );
        hasErr = true;
      }
    } else if (password.length < 8) {
      setPasswordErr(tr ? "Şifre en az 8 karakter olmalıdır." : "Password must be at least 8 characters.");
      hasErr = true;
    }

    if (hasErr) return;

    try {
      if (mode === "register") {
        await onSubmit({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email,
          password,
          city: registerCity.trim() || undefined,
          marketingConsent,
        });
        // Kazanım dönüşümü — onSubmit hata fırlatmadıysa kayıt başarılı.
        trackGAEvent("sign_up_completed", { method: "email" });
        setFirstName("");
        setLastName("");
        setRegisterCity("");
        setEmail("");
        setPassword("");
        setMarketingConsent(false);
      } else {
        await onSubmit({ email, password });
      }
    } catch {
      /* Hata üst bileşende serverError prop olarak gelir; serverEmailErr/serverPasswordErr ile alanlara yönlendirilir */
    }
  }

  const generalDisplayError = serverGeneralErr || urlAuthError;

  return (
    <div className="relative min-h-screen font-sans text-nb-text antialiased">
      {/* Karşılama ekranıyla aynı arka plan — pazarlama sayfasından ürüne geçerken
          görsel dil kopmasın. */}
      <HeroBackground />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-12 sm:px-8">
        <div className="mx-auto grid w-full max-w-[980px] items-center gap-12 lg:grid-cols-[minmax(0,440px)_minmax(0,460px)] lg:items-start lg:justify-center lg:gap-16">
          {/* SOL — marka ve kazanım paneli (yalnızca geniş ekran).
              Form uzun olduğunda yanında kayıp gitmesin diye yapışkan ve
              kartla aynı hizadan başlıyor. */}
          <div className="hidden lg:sticky lg:top-24 lg:block lg:pt-[72px]">
            <AuthBenefits mode={mode} language={language} adminPortal={adminPortal} />
          </div>

          {/* SAĞ — form */}
          <div className="mx-auto w-full max-w-[470px]">
        <button
          type="button"
          onClick={onBack}
          className="group mb-6 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm font-semibold text-nb-text shadow-sm transition duration-200 ease-out hover:border-nb-primary/30 hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
          {backLabel ?? copy.shared.backToLanding}
        </button>

        <div className="rounded-[28px] border border-white/[0.08] bg-[#0d1424]/80 p-8 shadow-[0_50px_100px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.05)_inset] backdrop-blur-xl sm:p-10">
          {/* Marka satiri: genis ekranda sol panel zaten markayi tasiyor, tekrar olmasin */}
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.38em] text-cyan-300/90 lg:hidden">
            PDF Platform
          </p>
          {adminPortal ? (
            <>
              <h1 className="mt-5 text-center lg:mt-0 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem] sm:leading-tight">
                {language === "tr"
                  ? "Yönetici girişi"
                  : "Administrator sign-in"}
              </h1>
              <p className="mx-auto mt-3 max-w-[380px] text-center text-sm leading-relaxed text-nb-muted">
                {language === "tr"
                  ? "Bu sayfa yalnızca yetkili yönetici hesapları içindir. Oturum açtıktan sonra yönetim paneline yönlendirilirsiniz."
                  : "This page is for authorized administrator accounts only. After signing in you will be taken to the admin panel."}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-center lg:mt-0 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem] sm:leading-tight">
                {copy.screen.title}
              </h1>
              <p className="mx-auto mt-3 max-w-[340px] text-center text-sm leading-relaxed text-nb-muted">
                {copy.screen.description}
              </p>
            </>
          )}

          {/* Kayıt modunda son-metre kazanım+güven şeridi — değer-anı CTA'sından inen
              misafirin tereddüdünü düşürmek için. Dürüst, somut; uydurma sayı YOK. */}
          {!adminPortal && mode === "register" && (
            <ul className="mx-auto mt-6 flex max-w-[360px] flex-col gap-2 lg:hidden">
              {[
                language === "tr"
                  ? "Word · Excel · PPT'ye çevir, sıkıştır, OCR, AI özetle"
                  : "Convert to Word · Excel · PPT, compress, OCR, AI",
                language === "tr"
                  ? "Kart gerekmez · 30 saniyede hazır · dilediğin an iptal"
                  : "No card · ready in 30 seconds · cancel anytime",
                language === "tr"
                  ? "Yapısal araçlar cihazında çalışır, dosya yüklenmez"
                  : "Structural tools run on your device — no upload",
              ].map((text) => (
                <li key={text} className="flex items-center gap-2.5 text-[13px] text-nb-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          )}

          <a
            href={getGoogleOAuthStartUrl(language)}
            onClick={() => {
              if (adminPortal) {
                sessionStorage.setItem(
                  SESSION_POST_OAUTH_REDIRECT_KEY,
                  SESSION_POST_OAUTH_ADMIN_VALUE,
                );
              }
            }}
            className="mt-8 flex min-h-[3.25rem] w-full items-center justify-center gap-3 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-base font-semibold text-white shadow-sm transition duration-200 hover:border-white/20 hover:bg-white/[0.09]"
          >
            <GoogleMark />
            {copy.shared.continueWithGoogle}
          </a>

          <div className="relative my-8">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-xs font-medium uppercase tracking-wider">
              <span className="rounded-md bg-nb-bg-soft/95 px-3 py-0.5 text-nb-muted">
                {copy.shared.orContinueEmail}
              </span>
            </div>
          </div>

          {adminPortal ? null : (
            <div className="flex rounded-xl border border-white/[0.08] bg-nb-bg-soft/50 p-1">
              <button
                type="button"
                onClick={() => onModeChange("login")}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition duration-200 ease-out ${
                  mode === "login"
                    ? "bg-gradient-to-b from-nb-primary-mid to-nb-primary text-slate-950 shadow-[0_8px_24px_-6px_rgba(34,211,238,0.45)]"
                    : "text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
                }`}
              >
                {getAuthCopy(language, "login").screen.submit}
              </button>
              <button
                type="button"
                onClick={() => onModeChange("register")}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition duration-200 ease-out ${
                  mode === "register"
                    ? "bg-gradient-to-b from-nb-primary-mid to-nb-primary text-slate-950 shadow-[0_8px_24px_-6px_rgba(34,211,238,0.45)]"
                    : "text-nb-muted hover:bg-white/[0.06] hover:text-nb-text"
                }`}
              >
                {getAuthCopy(language, "register").screen.submit}
              </button>
            </div>
          )}

          {mode === "login" && urlEmailVerifiedNotice ? (
            <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.12] px-4 py-3 text-sm text-emerald-50">
              <p>
                <span className="font-semibold">
                  {language === "tr"
                    ? "E-posta doğrulandı. "
                    : "Email verified. "}
                </span>
                {language === "tr"
                  ? "Artık e-posta adresiniz ve şifrenizle giriş yapabilirsiniz."
                  : "You can now sign in with your email and password."}
              </p>
            </div>
          ) : null}

          {mode === "login" && registrationSuccessBanner ? (
            <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.12] px-4 py-3 text-sm text-emerald-50">
              <div className="flex items-start justify-between gap-3">
                <p>
                  <span className="font-semibold">
                    {language === "tr"
                      ? "Kayıt işlemi tamamlandı ✅ "
                      : "Registration successful ✅” "}
                  </span>
                  {registrationSuccessBanner}
                </p>
                {onDismissRegistrationSuccess ? (
                  <button
                    type="button"
                    onClick={onDismissRegistrationSuccess}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-200/90 hover:bg-white/10"
                  >
                    {language === "tr" ? "Kapat" : "Dismiss"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block">
                    <FieldLabel>{copy.shared.firstNameLabel}</FieldLabel>
                    <span className="relative block">
                      <FieldIcon Icon={User} />
                      <input
                        type="text"
                        name="given-name"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => { setFirstName(event.target.value); setFirstNameErr(""); }}
                        className={firstNameErr ? inputClassName + inputErrorClassName : inputClassName}
                        placeholder={language === "tr" ? "Adınız" : "Jane"}
                      />
                    </span>
                  </label>
                  <FieldError msg={firstNameErr} />
                </div>
                <div>
                  <label className="block">
                    <FieldLabel>{copy.shared.lastNameLabel}</FieldLabel>
                    <span className="relative block">
                      <FieldIcon Icon={User} />
                      <input
                        type="text"
                        name="family-name"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => { setLastName(event.target.value); setLastNameErr(""); }}
                        className={lastNameErr ? inputClassName + inputErrorClassName : inputClassName}
                        placeholder={language === "tr" ? "Soyadınız" : "Doe"}
                      />
                    </span>
                  </label>
                  <FieldError msg={lastNameErr} />
                </div>
              </div>
            ) : null}

            {mode === "register" ? (
              <>
                <label className="block">
                  <FieldLabel>
                    {language === "tr" ? "Şehir" : "City"}{" "}
                    <span className="font-normal text-slate-500">
                      ({language === "tr" ? "isteğe bağlı" : "optional"})
                    </span>
                  </FieldLabel>
                  <span className="relative block">
                    <FieldIcon Icon={MapPin} />
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <select
                    value={registerCity}
                    onChange={(event) => setRegisterCity(event.target.value)}
                    className={`${inputClassName} appearance-none pr-10`}
                    disabled={submitting}
                  >
                    <option value="">
                      {language === "tr" ? "— seçin —" : "— choose —"}
                    </option>
                    {TURKISH_PROVINCES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  </span>
                </label>
              </>
            ) : null}

            <div>
              <label className="block">
                <FieldLabel>{copy.shared.emailLabel}</FieldLabel>
                <span className="relative block">
                  <FieldIcon Icon={Mail} />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); setEmailErr(""); }}
                    className={(emailErr || serverEmailErr) ? inputClassName + inputErrorClassName : inputClassName}
                    placeholder="name@company.com"
                  />
                </span>
              </label>
              <FieldError msg={emailErr || serverEmailErr} />
            </div>

            <div>
              {/* Başlık satırı (forgot-password butonu) label'ın DIŞINDA — yoksa
                  buton label'ın ilk labelable elemanı olup boş alana tıklayınca
                  tetikleniyordu. */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="block text-[13px] font-semibold text-slate-300">
                  {copy.shared.passwordLabel}
                </span>
                {mode === "login" && onForgotPassword ? (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs font-semibold text-cyan-300 transition duration-200 hover:text-cyan-200"
                  >
                    {authTranslations[language].login.forgotPassword}
                  </button>
                ) : null}
              </div>
              <div className="relative">
                {/* Etiket metni yukarıda (label DIŞINDA, forgot-password butonu için);
                    input'un erişilebilir adını aria-label ile veriyoruz (a11y + test). */}
                <FieldIcon Icon={Lock} />
                <input
                  type={showPassword ? "text" : "password"}
                  aria-label={copy.shared.passwordLabel}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setPasswordErr(""); }}
                  className={`${(passwordErr || serverPasswordErr) ? inputClassName + inputErrorClassName : inputClassName} pr-12`}
                  placeholder="••••••••••••••"
                />
                {/* Yazdığını görebilme: parola hatalarının en sık sebebi yanlış tuş. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? language === "tr" ? "Şifreyi gizle" : "Hide password"
                      : language === "tr" ? "Şifreyi göster" : "Show password"
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError msg={passwordErr || serverPasswordErr} />
            </div>

            {generalDisplayError ? (
              <p className="text-xs leading-snug text-rose-400" role="alert">
                {generalDisplayError}
              </p>
            ) : null}

            {mode === "register" ? (
              <label className="flex cursor-pointer items-start gap-2.5 text-left">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-cyan-500"
                />
                <span className="text-[12px] leading-relaxed text-slate-400">
                  {language === "tr"
                    ? "Kampanya, ipucu ve yeniliklerden e-posta ile haberdar olmak istiyorum. (İsteğe bağlı — istediğiniz zaman tek tıkla çıkabilirsiniz.)"
                    : "I'd like to receive emails about campaigns, tips and updates. (Optional — you can unsubscribe anytime with one click.)"}
                </span>
              </label>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-6 text-base font-semibold text-slate-950 shadow-[0_16px_40px_-12px_rgba(34,211,238,0.45)] transition duration-200 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && mode === "login" ? (
                <>
                  <span
                    className="h-[1.125rem] w-[1.125rem] shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white"
                    aria-hidden
                  />
                  <span>
                    {language === "tr" ? "Yükleniyor..." : "Loading..."}
                  </span>
                </>
              ) : submitting ? (
                <span>
                  {language === "tr" ? "İşleniyor..." : "Processing..."}
                </span>
              ) : (
                copy.screen.submit
              )}
            </button>
          </form>

          {!adminPortal ? (
            <p className="mt-8 text-center text-sm text-nb-muted">
              {copy.screen.alternatePrompt}{" "}
              <button
                type="button"
                onClick={() =>
                  onModeChange(mode === "login" ? "register" : "login")
                }
                className="font-semibold text-cyan-300 transition duration-200 hover:text-cyan-200"
              >
                {copy.screen.alternateAction}
              </button>
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[0.06] pt-8 text-sm text-nb-muted">
            <button
              type="button"
              onClick={onOpenTerms}
              className="transition duration-200 hover:text-nb-text"
            >
              {language === "tr" ? "Hizmet Şartları" : "Terms of Service"}
            </button>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="transition duration-200 hover:text-nb-text"
            >
              {language === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}
            </button>
            <button
              type="button"
              onClick={onOpenKvkk}
              className="transition duration-200 hover:text-nb-text"
            >
              {language === "tr" ? "KVKK aydınlatma" : "KVKK disclosure"}
            </button>
          </div>
        </div>

        {/* Dar ekranda sol panel gizli olduğu için güven maddeleri formun altında */}
        <div className="mt-10 lg:hidden">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-nb-muted">
            {copy.shared.trustTitle}
          </p>
          <ul className="mx-auto mt-5 max-w-md space-y-3">
            {copy.shared.trustPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[13.5px] leading-relaxed text-nb-muted"
              >
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400/80" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}
