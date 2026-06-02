import { useEffect, useRef, useState, type FormEvent } from "react";
import { userEffectiveHasPassword, type AuthUser, type UpdateProfileInput, AUTH_ACCESS_TOKEN_STORAGE_KEY, deleteMyAccount } from "../../api/auth";
import { validateNewPasswordPolicy } from "../../lib/passwordPolicy";
import type { PlanName } from "../../api/entitlement";
import { localizedPlanDisplayName } from "../../i18n/plans";
import type { Language } from "../../i18n/landing";
import { p } from "../../i18n/profile";
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
  onLogout?: () => void;
};

const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/60 px-4 py-3 text-sm text-nb-text outline-none transition duration-200 ease-out placeholder:text-nb-muted focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12";

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

export function UserProfilePanel({ user, language, updateProfile, showToast, onOpenChangePassword, setInitialPassword, onSubscriptionCancelled, subscriptionExpiry, subscriptionStartedAt, onLogout }: UserProfilePanelProps) {
  const lang = language;

  // ─── Danger zone: hesap silme ─────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const DELETE_CONFIRM_PHRASE = p("deleteConfirmPhrase", lang);

  const handleDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText !== DELETE_CONFIRM_PHRASE) return;
    const token = localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
    if (!token) return;
    setDeleteSubmitting(true);
    try {
      await deleteMyAccount(token, deletePassword);
      showToast("success", p("toastAccountDeleted", lang), p("toastAccountDeletedDetail", lang));
      onLogout?.();
    } catch {
      showToast("error", p("toastDeleteError", lang), p("toastDeleteErrorDetail", lang));
      setDeleteSubmitting(false);
    }
  };

  // ─── Profile form state ───────────────────────────────────────────────────
  const [savedFirst, setSavedFirst] = useState("");
  const [savedLast, setSavedLast] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [setPwdNew, setSetPwdNew] = useState("");
  const [setPwdConfirm, setSetPwdConfirm] = useState("");
  const [setPwdSubmitting, setSetPwdSubmitting] = useState(false);

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
    setProfileDirty(false);
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = setTimeout(() => {
      setProfileDirty(first.trim() !== savedFirst || last.trim() !== savedLast);
    }, PROFILE_DIRTY_DELAY_MS);
  }

  const hasPassword = userEffectiveHasPassword(user);

  async function handleSetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasPassword || setPwdSubmitting) return;
    const policy = validateNewPasswordPolicy(setPwdNew);
    if (!policy.ok) {
      const msg = lang === "tr"
        ? policy.issues.map((i) => i.tr).join(" · ")
        : policy.issues.map((i) => i.en).join(" · ");
      showToast("error", p("toastPasswordStrength", lang), msg);
      return;
    }
    if (setPwdNew !== setPwdConfirm) {
      showToast("error", p("toastPassword", lang), p("toastPasswordMismatch", lang));
      return;
    }
    setSetPwdSubmitting(true);
    try {
      const next = await setInitialPassword(setPwdNew);
      if (!next) {
        showToast("error", p("toastPassword", lang), p("toastSessionNotFound", lang));
        return;
      }
      setSetPwdNew("");
      setSetPwdConfirm("");
      showToast("success", p("toastPassword", lang), p("toastPasswordSaved", lang));
    } catch (error) {
      showToast("error", p("toastPassword", lang), error instanceof Error ? error.message : p("toastPasswordFailed", lang));
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
        showToast("error", p("toastCancelLabel", lang), data.message ?? data.error ?? p("toastCancelFailed", lang));
        return;
      }
      setCancelConfirm(false);
      const toastTitle = data.action === "refunded"
        ? p("toastCancelledRefund", lang)
        : p("toastCancelled", lang);
      showToast("success", toastTitle, data.message ?? "");
      onSubscriptionCancelled?.();
    } catch {
      showToast("error", p("toastCancelLabel", lang), p("toastCancelError", lang));
    } finally {
      setCancelling(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDirty || profileSubmitting) return;
    if (!firstName.trim()) {
      showToast("error", p("toastProfile", lang), p("toastFirstNameRequired", lang));
      return;
    }
    if (!lastName.trim()) {
      showToast("error", p("toastProfile", lang), p("toastLastNameRequired", lang));
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
        showToast("success", p("toastProfile", lang), p("toastProfileUpdated", lang));
      }
    } catch (error) {
      showToast("error", p("toastProfile", lang), error instanceof Error ? error.message : p("toastProfileFailed", lang));
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{p("sectionProfile", lang)}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">{p("headPersonal", lang)}</h2>

        <form className="mt-6 space-y-4" onSubmit={(e) => void handleProfileSubmit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="profile-first-name">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{p("fieldFirstName", lang)}</span>
              <input
                id="profile-first-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                className={inputClass}
                disabled={profileSubmitting}
                aria-label={p("fieldFirstName", lang)}
              />
            </label>
            <label className="block" htmlFor="profile-last-name">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{p("fieldLastName", lang)}</span>
              <input
                id="profile-last-name"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                className={inputClass}
                disabled={profileSubmitting}
                aria-label={p("fieldLastName", lang)}
              />
            </label>
          </div>

          <label className="block" htmlFor="profile-email">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{p("fieldEmail", lang)}</span>
            <input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              className={`${inputClass} cursor-not-allowed opacity-60`}
              aria-label={p("fieldEmail", lang)}
              aria-readonly="true"
            />
            <span className="mt-1.5 block text-xs text-slate-500">{p("emailReadOnly", lang)}</span>
          </label>

          <button
            type="submit"
            disabled={!profileDirty || profileSubmitting}
            className="rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_-10px_rgba(34,211,238,0.45)] transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {profileSubmitting ? p("btnSaving", lang) : p("btnUpdateName", lang)}
          </button>
        </form>
      </section>

      {/* ── Plan ve yenileme / Ekip üyeliği ─────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{p("sectionSubscription", lang)}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">{p("headPlanRenewal", lang)}</h2>

        {user.isTeamMember ? (
          <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl" aria-hidden="true">👥</span>
              <div>
                <p className="text-sm font-semibold text-cyan-200">{p("teamMemberLabel", lang)}</p>
                <p className="text-xs text-slate-400">
                  {user.teamMemberRole === "MANAGER"
                    ? p("teamRoleManager", lang)
                    : p("teamRoleMember", lang)}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{p("teamManagedByOwner", lang)}</p>
          </div>
        ) : (
          <>
            <dl className="mt-6 space-y-0 text-sm divide-y divide-white/[0.06]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <dt className="text-slate-400">{p("labelCurrentPlan", lang)}</dt>
                <dd className="font-semibold text-nb-text">{localizedPlanDisplayName(planName, language)}</dd>
              </div>

              {isPaidPlan && startedAtDate !== "—" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <dt className="text-slate-400">{p("labelPeriodStart", lang)}</dt>
                  <dd className="font-semibold text-nb-text">{startedAtDate}</dd>
                </div>
              )}

              {isPaidPlan && renewalDate !== "—" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <dt className="text-slate-400">{p("labelNextRenewal", lang)}</dt>
                  <dd className="font-semibold text-nb-text">{renewalDate}</dd>
                </div>
              )}
            </dl>

            {isPaidPlan && renewalDate !== "—" && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{p("autoRenewNote", lang)}</p>
            )}

            {!isPaidPlan && (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{p("upgradeNote", lang)}</p>
            )}

            {isPaidPlan && (
              <div className="mt-5 border-t border-white/[0.06] pt-5">
                {!cancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setCancelConfirm(true)}
                    className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/[0.12]"
                  >
                    {maybeRefundEligible ? p("cancelRefundBtn", lang) : p("cancelBtn", lang)}
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-4 text-sm">
                    <p className="font-semibold text-red-300">
                      {maybeRefundEligible ? p("cancelConfirmRefund", lang) : p("cancelConfirmNoRefund", lang)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {maybeRefundEligible ? p("cancelNoteRefund", lang) : p("cancelNoteNoRefund", lang)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={() => void handleCancelSubscription()}
                        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                      >
                        {cancelling ? p("btnProcessing", lang) : p("btnYesCancel", lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(false)}
                        className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08]"
                      >
                        {p("btnGoBack", lang)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── GDPR Madde 20: Verileri Dışa Aktar ──────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/40 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nb-primary/70">
          {lang === "tr" ? "Veri Taşınabilirliği (GDPR Madde 20)" : "Data Portability (GDPR Article 20)"}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">
          {lang === "tr" ? "Verilerimi Dışa Aktar" : "Export My Data"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {lang === "tr"
            ? "Profil bilgileri, işlem geçmişi ve indirme kayıtlarınızı makine tarafından okunabilir JSON formatında indirin."
            : "Download your profile information, operation history and download records in machine-readable JSON format."}
        </p>
        <a
          href={`${getSaasApiBase()}/api/auth/export-my-data`}
          download
          className="mt-5 inline-block rounded-xl border border-nb-primary/30 bg-nb-primary/10 px-5 py-2.5 text-sm font-semibold text-nb-primary transition hover:bg-nb-primary/20"
        >
          {lang === "tr" ? "JSON Olarak İndir" : "Download as JSON"}
        </a>
      </section>

      {/* ── Tehlikeli Alan: Hesap Silme (GDPR Madde 17) ──────── */}
      <section
        id="profile-danger-zone"
        className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        aria-labelledby="danger-zone-heading"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-400">{p("sectionDangerZone", lang)}</p>
        <h2 id="danger-zone-heading" className="mt-1 text-xl font-semibold tracking-tight text-nb-text">
          {p("headDeleteAccount", lang)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{p("deleteAccountWarning", lang)}</p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            {p("btnPermanentDelete", lang)}
          </button>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(e) => void handleDeleteAccount(e)}>
            {user.authProvider !== "google" && (
              <label className="block" htmlFor="delete-account-password">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">
                  {p("fieldEnterPassword", lang)}
                </span>
                <input
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  className={inputClass}
                  disabled={deleteSubmitting}
                  aria-label={p("fieldEnterPassword", lang)}
                />
              </label>
            )}
            <label className="block" htmlFor="delete-account-confirm">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">
                {lang === "tr"
                  ? <><strong className="text-red-300">"{DELETE_CONFIRM_PHRASE}"</strong> yazarak onaylayın</>
                  : <>Type <strong className="text-red-300">"{DELETE_CONFIRM_PHRASE}"</strong> to confirm</>}
              </span>
              <input
                id="delete-account-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRM_PHRASE}
                className={inputClass}
                disabled={deleteSubmitting}
                aria-label={lang === "tr" ? `Onay metni: ${DELETE_CONFIRM_PHRASE}` : `Confirmation text: ${DELETE_CONFIRM_PHRASE}`}
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={deleteSubmitting || deleteConfirmText !== DELETE_CONFIRM_PHRASE}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteSubmitting ? p("btnDeleting", lang) : p("btnDeleteAccount", lang)}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteConfirmText(""); }}
                className="rounded-xl border border-white/[0.1] bg-nb-panel/70 px-5 py-2.5 text-sm font-semibold text-nb-muted transition hover:text-nb-text"
                disabled={deleteSubmitting}
              >
                {p("btnCancel", lang)}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Güvenlik / Şifre ─────────────────────────────────── */}
      <section
        id="profile-password-section"
        className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{p("sectionSecurity", lang)}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-nb-text">
          {hasPassword ? p("headChangePassword", lang) : p("headSetPassword", lang)}
        </h2>

        {!hasPassword ? (
          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSetPasswordSubmit(e)}>
            <p className="text-sm leading-relaxed text-slate-400">{p("googlePasswordNote", lang)}</p>
            <label className="block" htmlFor="set-password-new">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{p("fieldNewPassword", lang)}</span>
              <input
                id="set-password-new"
                type="password"
                autoComplete="new-password"
                value={setPwdNew}
                onChange={(e) => setSetPwdNew(e.target.value)}
                className={inputClass}
                disabled={setPwdSubmitting}
                aria-label={p("fieldNewPassword", lang)}
              />
            </label>
            <label className="block" htmlFor="set-password-confirm">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">{p("fieldConfirmPassword", lang)}</span>
              <input
                id="set-password-confirm"
                type="password"
                autoComplete="new-password"
                value={setPwdConfirm}
                onChange={(e) => setSetPwdConfirm(e.target.value)}
                className={inputClass}
                disabled={setPwdSubmitting}
                aria-label={p("fieldConfirmPassword", lang)}
              />
            </label>
            <button
              type="submit"
              disabled={setPwdSubmitting}
              className="rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_-10px_rgba(34,211,238,0.45)] transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {setPwdSubmitting ? p("btnSaving", lang) : p("btnSavePassword", lang)}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <p className="text-sm leading-relaxed text-slate-400">{p("hasPasswordNote", lang)}</p>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="nb-transition mt-4 rounded-xl border border-white/[0.1] bg-nb-panel/70 px-5 py-2.5 text-sm font-semibold text-nb-text hover:border-nb-primary/35 hover:bg-nb-panel"
            >
              {p("btnChangePassword", lang)}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
