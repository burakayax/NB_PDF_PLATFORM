import { useEffect, useRef, useState, type FormEvent } from "react";
import { userEffectiveHasPassword, type AuthUser, type UpdateProfileInput, AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../../api/auth";
import { validateNewPasswordPolicy } from "../../lib/passwordPolicy";
import type { PlanName } from "../../api/entitlement";
import { localizedPlanDisplayName } from "../../i18n/plans";
import type { Language } from "../../i18n/landing";
import { getSaasApiBase } from "../../api/saasBase";

type ToastType = "success" | "error" | "loading" | "info";

type UserProfilePanelProps = {
  user: AuthUser;
  language: Language;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser | null>;
  showToast: (type: ToastType, title: string, detail: string) => void;
  onOpenChangePassword: () => void;
  setInitialPassword: (newPassword: string) => Promise<AuthUser | null>;
  onSubscriptionCancelled?: () => void;
  subscriptionExpiry?: string | null;
  subscriptionStartedAt?: string | null;
};

const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/60 px-4 py-3 text-sm text-nb-text outline-none transition duration-200 ease-out placeholder:text-nb-muted focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12";

/** Debounce gecikmesi (ms) — kullanıcı yazmayı bıraktıktan bu süre sonra buton aktif olur. */
const PROFILE_DIRTY_DELAY_MS = 600;

function planNameFromUser(plan: string): PlanName {
  if (plan === "FREE" || plan === "STARTER" || plan === "PLUS" || plan === "PRO" || plan === "BUSINESS") return plan;
  return "FREE";
}

function formatDate(iso: string | null | undefined, language: Language): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", { dateStyle: "long" });
}

function splitFromName(name: string | null | undefined): { first: string; last: string } {
  const t = name?.trim() ?? "";
  if (!t) return { first: "", last: "" };
  const i = t.indexOf(" ");
  if (i <= 0) return { first: t, last: "" };
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

export function UserProfilePanel({ user, language, updateProfile, showToast, onOpenChangePassword, setInitialPassword, onSubscriptionCancelled, subscriptionExpiry, subscriptionStartedAt }: UserProfilePanelProps) {
  const tr = language === "tr";

  // Saved baseline — güncelleme başarılı olunca burası da güncellenir
  const [savedFirst, setSavedFirst] = useState("");
  const [savedLast, setSavedLast] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Debounced "dirty" state — değişimden PROFILE_DIRTY_DELAY_MS sonra true olur
  const [profileDirty, setProfileDirty] = useState(false);
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [setPwdNew, setSetPwdNew] = useState("");
  const [setPwdConfirm, setSetPwdConfirm] = useState("");
  const [setPwdSubmitting, setSetPwdSubmitting] = useState(false);

  // Kullanıcı değiştiğinde başlangıç değerlerini ayarla
  useEffect(() => {
    const f = user.firstName?.trim() ?? "";
    const l = user.lastName?.trim() ?? "";
    const first = f || splitFromName(user.name).first;
    const last = l || splitFromName(user.name).last;
    setFirstName(first);
    setLastName(last);
    setSavedFirst(first);
    setSavedLast(last);
    setProfileDirty(false);
  }, [user.id, user.firstName, user.lastName, user.name]);

  // Temizle timer unmount'ta
  useEffect(() => () => { if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current); }, []);

  function handleFirstNameChange(value: string) {
    setFirstName(value);
    scheduleDirtyCheck(value, lastName);
  }

  function handleLastNameChange(value: string) {
    setLastName(value);
    scheduleDirtyCheck(firstName, value);
  }

  function scheduleDirtyCheck(first: string, last: string) {
    setProfileDirty(false); // gecikmeli yeniden değerlendir
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = setTimeout(() => {
      const changed = first.trim() !== savedFirst || last.trim() !== savedLast;
      setProfileDirty(changed);
    }, PROFILE_DIRTY_DELAY_MS);
  }

  const hasPassword = userEffectiveHasPassword(user);

  async function handleSetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasPassword || setPwdSubmitting) return;
    const policy = validateNewPasswordPolicy(setPwdNew);
    if (!policy.ok) {
      const msg = tr ? policy.issues.map((i) => i.tr).join(" · ") : policy.issues.map((i) => i.en).join(" · ");
      showToast("error", tr ? "Şifre gücü" : "Password strength", msg);
      return;
    }
    if (setPwdNew !== setPwdConfirm) {
      showToast("error", tr ? "Şifre" : "Password", tr ? "Şifreler eşleşmiyor." : "Passwords do not match.");
      return;
    }
    setSetPwdSubmitting(true);
    try {
      const next = await setInitialPassword(setPwdNew);
      if (!next) {
        showToast("error", tr ? "Şifre" : "Password", tr ? "Oturum bulunamadı; yeniden giriş yapın." : "Session not found; please sign in again.");
        return;
      }
      setSetPwdNew("");
      setSetPwdConfirm("");
      showToast("success", tr ? "Şifre" : "Password",
        tr ? "Hesap şifreniz kaydedildi; e-posta ve şifre ile de giriş yapabilirsiniz."
           : "Your account password is set; you can also sign in with email and password.");
    } catch (error) {
      showToast("error", tr ? "Şifre" : "Password", error instanceof Error ? error.message : tr ? "Şifre kaydedilemedi." : "Could not save password.");
    } finally {
      setSetPwdSubmitting(false);
    }
  }

  const maybeRefundEligible = user.refundEligible === true;

  async function handleCancelSubscription() {
    setCancelling(true);
    try {
      const token = window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY) ?? "";
      const res = await fetch(`${getSaasApiBase()}/api/subscription/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; action?: string; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        showToast("error", tr ? "İptal" : "Cancel", data.message ?? data.error ?? (tr ? "İşlem başarısız." : "Operation failed."));
        return;
      }
      setCancelConfirm(false);
      const toastTitle = data.action === "refunded"
        ? (tr ? "Abonelik iptal edildi ve iade yapıldı" : "Subscription cancelled with refund")
        : (tr ? "Abonelik iptal edildi" : "Subscription cancelled");
      showToast("success", toastTitle, data.message ?? "");
      onSubscriptionCancelled?.();
    } catch {
      showToast("error", tr ? "İptal" : "Cancel", tr ? "Bir hata oluştu. Lütfen tekrar deneyin." : "An error occurred. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDirty || profileSubmitting) return;
    if (!firstName.trim()) {
      showToast("error", tr ? "Profil" : "Profile", tr ? "Ad gereklidir." : "First name is required.");
      return;
    }
    if (!lastName.trim()) {
      showToast("error", tr ? "Profil" : "Profile", tr ? "Soyad gereklidir." : "Last name is required.");
      return;
    }

    setProfileSubmitting(true);
    try {
      const next = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      if (next) {
        const newFirst = next.firstName?.trim() || firstName.trim();
        const newLast = next.lastName?.trim() || lastName.trim();
        setSavedFirst(newFirst);
        setSavedLast(newLast);
        setProfileDirty(false);
        showToast("success", tr ? "Profil" : "Profile", tr ? "Ad ve soyadınız güncellendi." : "Your name was updated.");
      }
    } catch (error) {
      showToast("error", tr ? "Profil" : "Profile", error instanceof Error ? error.message : tr ? "Güncellenemedi." : "Update failed.");
    } finally {
      setProfileSubmitting(false);
    }
  }

  const planName = planNameFromUser(user.plan);
  const isPaidPlan = planName !== "FREE";
  const effectiveExpiry = subscriptionExpiry ?? user.subscription_expiry;
  const renewalDate = formatDate(effectiveExpiry, language);
  const startedAtDate = formatDate(subscriptionStartedAt, language);

  return (
    <div className="space-y-8">
      {/* ── Kişisel bilgiler ─────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{tr ? "Profil" : "Profile"}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">{tr ? "Kişisel bilgiler" : "Personal details"}</h2>

        <form className="mt-6 space-y-4" onSubmit={(e) => void handleProfileSubmit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{tr ? "Ad" : "First name"}</span>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                className={inputClass}
                disabled={profileSubmitting}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{tr ? "Soyad" : "Last name"}</span>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                className={inputClass}
                disabled={profileSubmitting}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{tr ? "E-posta" : "Email"}</span>
            <input type="email" value={user.email} readOnly className={`${inputClass} cursor-not-allowed opacity-60`} />
            <span className="mt-1.5 block text-xs text-slate-500">{tr ? "E-posta değiştirilemez." : "Email cannot be changed here."}</span>
          </label>

          <button
            type="submit"
            disabled={!profileDirty || profileSubmitting}
            className="rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_-10px_rgba(34,211,238,0.45)] transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {profileSubmitting ? (tr ? "Kaydediliyor…" : "Saving…") : tr ? "Adı güncelle" : "Update name"}
          </button>
        </form>
      </section>

      {/* ── Plan ve yenileme / Ekip üyeliği ─────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{tr ? "Abonelik" : "Subscription"}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">{tr ? "Plan ve yenileme" : "Plan and renewal"}</h2>

        {user.isTeamMember ? (
          <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">👥</span>
              <div>
                <p className="text-sm font-semibold text-cyan-200">{tr ? "Ekip Üyesi" : "Team Member"}</p>
                <p className="text-xs text-slate-400">
                  {user.teamMemberRole === "MANAGER"
                    ? (tr ? "Yönetici rolüyle ekibe dahilsiniz." : "You are a manager in this team.")
                    : (tr ? "Üye olarak ekibe dahilsiniz." : "You are a member of this team.")}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              {tr
                ? "Bu hesabınız bir Business ekibine dahil edilmiştir. Abonelik yönetimi (yenileme, iptal, plan değişikliği) ekip sahibinin sorumluluğundadır."
                : "This account is part of a Business team. Subscription management (renewal, cancellation, plan changes) is handled by the team owner."}
            </p>
          </div>
        ) : (
          <>
            <dl className="mt-6 space-y-0 text-sm divide-y divide-white/[0.06]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <dt className="text-slate-400">{tr ? "Mevcut plan" : "Current plan"}</dt>
                <dd className="font-semibold text-nb-text">{localizedPlanDisplayName(planName, language)}</dd>
              </div>

              {isPaidPlan && startedAtDate !== "—" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <dt className="text-slate-400">{tr ? "Dönem başlangıcı" : "Period start"}</dt>
                  <dd className="font-semibold text-nb-text">{startedAtDate}</dd>
                </div>
              )}

              {isPaidPlan && renewalDate !== "—" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <dt className="text-slate-400">{tr ? "Dönem yenilenme tarihi" : "Next renewal date"}</dt>
                  <dd className="font-semibold text-nb-text">{renewalDate}</dd>
                </div>
              )}
            </dl>

            {isPaidPlan && renewalDate !== "—" && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {tr
                  ? "Aboneliğiniz bu tarihte otomatik olarak yenilenir."
                  : "Your subscription will automatically renew on this date."}
              </p>
            )}

            {!isPaidPlan && (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {tr
                  ? "Ücretli bir plana geçerek tüm araçlara sınırsız erişin."
                  : "Upgrade to a paid plan for unlimited access to all tools."}
              </p>
            )}

            {isPaidPlan && (
              <div className="mt-5 border-t border-white/[0.06] pt-5">
                {/* İptal / iade butonu */}
                {!cancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setCancelConfirm(true)}
                    className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/[0.12]"
                  >
                    {maybeRefundEligible
                      ? (tr ? "İptal Et ve Tam İade Al" : "Cancel & Get Full Refund")
                      : (tr ? "Aboneliği İptal Et" : "Cancel Subscription")}
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-4 text-sm">
                    <p className="font-semibold text-red-300">
                      {maybeRefundEligible
                        ? (tr ? "Aboneliğinizi iptal edip tam iade almak istediğinize emin misiniz?" : "Are you sure you want to cancel and get a full refund?")
                        : (tr ? "Aboneliğinizi iptal etmek istediğinize emin misiniz?" : "Are you sure you want to cancel your subscription?")}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {maybeRefundEligible
                        ? (tr ? "Ücretiniz iade edilecek ve planınız hemen Ücretsiz plana düşürülecektir." : "Your payment will be refunded and your plan will immediately downgrade to Free.")
                        : (tr ? "Mevcut dönem sonunda planınız Ücretsiz plana düşürülecektir." : "Your plan will downgrade to Free at the end of the current period.")}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={() => void handleCancelSubscription()}
                        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                      >
                        {cancelling ? (tr ? "İşleniyor…" : "Processing…") : (tr ? "Evet, İptal Et" : "Yes, Cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(false)}
                        className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08]"
                      >
                        {tr ? "Geri Dön" : "Go Back"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Güvenlik / Şifre ─────────────────────────────────── */}
      <section
        id="profile-password-section"
        className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{tr ? "Güvenlik" : "Security"}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">
          {hasPassword ? (tr ? "Şifre değiştir" : "Change password") : tr ? "Şifre belirle" : "Set password"}
        </h2>

        {!hasPassword ? (
          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSetPasswordSubmit(e)}>
            <p className="text-sm leading-relaxed text-slate-400">
              {tr
                ? "Google ile giriş yaptınız; isteğe bağlı olarak bu e-posta için bir hesap şifresi belirleyebilirsiniz."
                : "You signed in with Google. Optionally set a password for this email to sign in with email and password as well."}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{tr ? "Yeni şifre" : "New password"}</span>
              <input type="password" autoComplete="new-password" value={setPwdNew} onChange={(e) => setSetPwdNew(e.target.value)} className={inputClass} disabled={setPwdSubmitting} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{tr ? "Yeni şifre (tekrar)" : "Confirm new password"}</span>
              <input type="password" autoComplete="new-password" value={setPwdConfirm} onChange={(e) => setSetPwdConfirm(e.target.value)} className={inputClass} disabled={setPwdSubmitting} />
            </label>
            <button
              type="submit"
              disabled={setPwdSubmitting}
              className="rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_-10px_rgba(34,211,238,0.45)] transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {setPwdSubmitting ? (tr ? "Kaydediliyor…" : "Saving…") : tr ? "Şifreyi kaydet" : "Save password"}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <p className="text-sm leading-relaxed text-slate-400">
              {tr
                ? "Hesap şifrenizi güncellemek için aşağıdaki düğmeyi kullanın."
                : "Use the button below to update your account password."}
            </p>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="nb-transition mt-4 rounded-xl border border-white/[0.1] bg-nb-panel/70 px-5 py-2.5 text-sm font-semibold text-nb-text hover:border-nb-primary/35 hover:bg-nb-panel"
            >
              {tr ? "Şifre değiştir" : "Change password"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
