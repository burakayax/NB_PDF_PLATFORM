import type { Language } from "./landing";

const T = {
  // ─── Section labels ──────────────────────────────────────────────────────
  sectionProfile:        { tr: "Profil",       en: "Profile" },
  sectionSubscription:   { tr: "Abonelik",     en: "Subscription" },
  sectionSecurity:       { tr: "Güvenlik",     en: "Security" },
  sectionDangerZone:     { tr: "Tehlikeli Alan", en: "Danger Zone" },

  // ─── Personal details ────────────────────────────────────────────────────
  headPersonal:     { tr: "Kişisel bilgiler",  en: "Personal details" },
  fieldFirstName:   { tr: "Ad",                en: "First name" },
  fieldLastName:    { tr: "Soyad",             en: "Last name" },
  fieldEmail:       { tr: "E-posta",           en: "Email" },
  emailReadOnly:    { tr: "E-posta değiştirilemez.", en: "Email cannot be changed here." },
  btnSaving:        { tr: "Kaydediliyor…",     en: "Saving…" },
  btnUpdateName:    { tr: "Adı güncelle",      en: "Update name" },

  // ─── Subscription ────────────────────────────────────────────────────────
  headPlanRenewal:       { tr: "Plan ve yenileme",        en: "Plan and renewal" },
  labelCurrentPlan:      { tr: "Mevcut plan",             en: "Current plan" },
  labelPeriodStart:      { tr: "Dönem başlangıcı",        en: "Period start" },
  labelNextRenewal:      { tr: "Dönem yenilenme tarihi",  en: "Next renewal date" },
  autoRenewNote:         { tr: "Aboneliğiniz bu tarihte otomatik olarak yenilenir.", en: "Your subscription will automatically renew on this date." },
  upgradeNote:           { tr: "Ücretli bir plana geçerek tüm araçlara sınırsız erişin.", en: "Upgrade to a paid plan for unlimited access to all tools." },
  cancelBtn:             { tr: "Aboneliği İptal Et",             en: "Cancel Subscription" },
  cancelRefundBtn:       { tr: "İptal Et ve Tam İade Al",        en: "Cancel & Get Full Refund" },
  cancelConfirmRefund:   { tr: "Aboneliğinizi iptal edip tam iade almak istediğinize emin misiniz?", en: "Are you sure you want to cancel and get a full refund?" },
  cancelConfirmNoRefund: { tr: "Aboneliğinizi iptal etmek istediğinize emin misiniz?",              en: "Are you sure you want to cancel your subscription?" },
  cancelNoteRefund:      { tr: "Ücretiniz iade edilecek ve planınız hemen Ücretsiz plana düşürülecektir.",     en: "Your payment will be refunded and your plan will immediately downgrade to Free." },
  cancelNoteNoRefund:    { tr: "Mevcut dönem sonunda planınız Ücretsiz plana düşürülecektir.",                 en: "Your plan will downgrade to Free at the end of the current period." },
  btnProcessing:         { tr: "İşleniyor…", en: "Processing…" },
  btnYesCancel:          { tr: "Evet, İptal Et", en: "Yes, Cancel" },
  btnGoBack:             { tr: "Geri Dön",       en: "Go Back" },

  // ─── Team member ─────────────────────────────────────────────────────────
  teamMemberLabel:         { tr: "Ekip Üyesi",   en: "Team Member" },
  teamRoleManager:         { tr: "Yönetici rolüyle ekibe dahilsiniz.", en: "You are a manager in this team." },
  teamRoleMember:          { tr: "Üye olarak ekibe dahilsiniz.",       en: "You are a member of this team." },
  teamManagedByOwner:      { tr: "Bu hesabınız bir Business ekibine dahil edilmiştir. Abonelik yönetimi (yenileme, iptal, plan değişikliği) ekip sahibinin sorumluluğundadır.", en: "This account is part of a Business team. Subscription management (renewal, cancellation, plan changes) is handled by the team owner." },

  // ─── Password ────────────────────────────────────────────────────────────
  headChangePassword: { tr: "Şifre değiştir",  en: "Change password" },
  headSetPassword:    { tr: "Şifre belirle",   en: "Set password" },
  googlePasswordNote: { tr: "Google ile giriş yaptınız; isteğe bağlı olarak bu e-posta için bir hesap şifresi belirleyebilirsiniz.", en: "You signed in with Google. Optionally set a password for this email to sign in with email and password as well." },
  fieldNewPassword:     { tr: "Yeni şifre",            en: "New password" },
  fieldConfirmPassword: { tr: "Yeni şifre (tekrar)",   en: "Confirm new password" },
  btnSavePassword:      { tr: "Şifreyi kaydet",        en: "Save password" },
  hasPasswordNote:      { tr: "Hesap şifrenizi güncellemek için aşağıdaki düğmeyi kullanın.", en: "Use the button below to update your account password." },
  btnChangePassword:    { tr: "Şifre değiştir",        en: "Change password" },

  // ─── Danger zone ─────────────────────────────────────────────────────────
  headDeleteAccount:         { tr: "Hesabı sil",  en: "Delete account" },
  deleteAccountWarning:      { tr: "Bu işlem geri alınamaz. Tüm verileriniz (profil, geçmiş, abonelik) kalıcı olarak silinir. GDPR Madde 17 kapsamında talep edilen veri silme hakkınızı kullanıyorsunuz.", en: "This action is permanent and cannot be undone. All your data (profile, history, subscription) will be permanently removed. You are exercising your right to erasure under GDPR Article 17." },
  btnPermanentDelete:        { tr: "Hesabımı kalıcı olarak sil",  en: "Permanently delete my account" },
  fieldEnterPassword:        { tr: "Hesap şifrenizi girin",       en: "Enter your account password" },
  deleteConfirmPhrase:       { tr: "hesabımı sil",                en: "delete my account" },
  btnDeleting:               { tr: "Siliniyor…",                  en: "Deleting…" },
  btnDeleteAccount:          { tr: "Hesabı sil",                  en: "Delete account" },
  btnCancel:                 { tr: "İptal",                       en: "Cancel" },

  // ─── Toast messages ──────────────────────────────────────────────────────
  toastAccountDeleted:       { tr: "Hesap silindi",               en: "Account deleted" },
  toastAccountDeletedDetail: { tr: "Tüm verileriniz silindi. Güle güle!", en: "All your data has been removed. Goodbye!" },
  toastDeleteError:          { tr: "Hata",  en: "Error" },
  toastDeleteErrorDetail:    { tr: "Hesap silinirken bir hata oluştu. Şifrenizi kontrol edin.", en: "Could not delete account. Please check your password." },
  toastPasswordStrength:     { tr: "Şifre gücü",   en: "Password strength" },
  toastPassword:             { tr: "Şifre",         en: "Password" },
  toastPasswordMismatch:     { tr: "Şifreler eşleşmiyor.",             en: "Passwords do not match." },
  toastSessionNotFound:      { tr: "Oturum bulunamadı; yeniden giriş yapın.", en: "Session not found; please sign in again." },
  toastPasswordSaved:        { tr: "Hesap şifreniz kaydedildi; e-posta ve şifre ile de giriş yapabilirsiniz.", en: "Your account password is set; you can also sign in with email and password." },
  toastPasswordFailed:       { tr: "Şifre kaydedilemedi.",        en: "Could not save password." },
  toastProfile:              { tr: "Profil",                      en: "Profile" },
  toastFirstNameRequired:    { tr: "Ad gereklidir.",              en: "First name is required." },
  toastLastNameRequired:     { tr: "Soyad gereklidir.",           en: "Last name is required." },
  toastProfileUpdated:       { tr: "Ad ve soyadınız güncellendi.", en: "Your name was updated." },
  toastProfileFailed:        { tr: "Güncellenemedi.",             en: "Update failed." },
  toastCancelLabel:          { tr: "İptal",  en: "Cancel" },
  toastCancelFailed:         { tr: "İşlem başarısız.",            en: "Operation failed." },
  toastCancelError:          { tr: "Bir hata oluştu. Lütfen tekrar deneyin.", en: "An error occurred. Please try again." },
  toastCancelledRefund:      { tr: "Abonelik iptal edildi ve iade yapıldı", en: "Subscription cancelled with refund" },
  toastCancelled:            { tr: "Abonelik iptal edildi",       en: "Subscription cancelled" },
} as const;

export type ProfileStringKey = keyof typeof T;

/** Profil paneli için çeviri helper'ı. */
export function p(key: ProfileStringKey, lang: Language): string {
  return T[key][lang];
}
