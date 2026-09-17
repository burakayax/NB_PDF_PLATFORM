/**
 * Erişim anahtarının tek saklandığı yer: BELLEK.
 *
 * NEDEN TARAYICI DEPOSU DEĞİL: Anahtar `localStorage`'da tutulduğunda sayfada
 * çalışan HERHANGİ bir betik onu okuyabilir — kendi kodumuzdaki bir açık, bir
 * bağımlılığın ele geçirilmesi ya da bir tarayıcı eklentisi yeter. Anahtarı ele
 * geçiren kişi, süresi dolana kadar kullanıcının hesabını kullanabilir. Bellekte
 * tutulan bir değer sayfa kapanınca kaybolur ve depoyu tarayan betiklere
 * görünmez.
 *
 * SAYFA YENİLENİNCE NE OLUYOR: Anahtar gider ama oturum kaybolmaz. Tarayıcıda
 * HttpOnly yenileme çerezi duruyor (JavaScript okuyamaz); açılışta `nb_session_hint`
 * işareti varsa uygulama sessizce yeni anahtar alır. Yani kullanıcı için değişen
 * bir şey yok, saldırgan için okunacak bir şey kalmıyor.
 *
 * SEKMELER ARASI: Her sekme kendi anahtarını yenileme çerezinden alır; ortak
 * depoya gerek yok.
 */

let bellektekiAnahtar: string | null = null;

/** Anahtar değişince haber verilecek dinleyiciler (aynı sekme içinde). */
const dinleyiciler = new Set<(token: string | null) => void>();

export function readAccessToken(): string | null {
  return bellektekiAnahtar;
}

export function writeAccessToken(token: string | null): void {
  bellektekiAnahtar = token && token.trim() ? token.trim() : null;
  for (const d of dinleyiciler) {
    try {
      d(bellektekiAnahtar);
    } catch {
      // Bir dinleyicinin hatası diğerlerini ve oturumu etkilemesin.
    }
  }
}

export function clearAccessToken(): void {
  writeAccessToken(null);
}

export function subscribeAccessToken(dinleyici: (token: string | null) => void): () => void {
  dinleyiciler.add(dinleyici);
  return () => dinleyiciler.delete(dinleyici);
}
