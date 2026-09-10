/**
 * UYGULAMA EKRAN TÜRLERİ — hangi ekranlar var, çalışma alanında hangi paneller açılır.
 *
 * Bu türler ana uygulama dosyasının içinde tanımlıydı. Yönlendirme mantığı ayrı
 * bir modüle taşınırken oradan içe aktarılamıyordu (iki dosya birbirini çağırır
 * ve döngü oluşurdu). Ortak bir yerde durmaları bu döngüyü engelliyor ve
 * ekranlara yeni bir sayfa eklerken tek bakılacak yer olmasını sağlıyor.
 */

/** Yasal metin dışındaki tüm üst düzey ekranlar. */
export type NonLegalView =
  | "landing"
  | "login"
  | "register"
  | "forgot_password"
  | "web"
  | "admin"
  | "admin_login"
  | "team_invite"
  | "about";

/** Sözleşme / politika sayfaları. */
export type LegalView =
  | "terms"
  | "privacy"
  | "kvkk"
  | "on-bilgilendirme"
  | "mesafeli-satis";

export type AppView = NonLegalView | LegalView;

export type ToastType = "success" | "error" | "loading" | "info";

/** Çalışma alanında sağ tarafta açılan panel. */
export type ContentPanel =
  | "tool"
  | "subscription"
  | "profile"
  | "pricing"
  | "home"
  | "team"
  | "ai"
  | "editor"
  | "sign"
  | "annotate"
  | "crop"
  | "compress-image"
  | "resize-image"
  | "snip"
  | "searchable"
  | "scanner"
  | "scans"
  | "api";
