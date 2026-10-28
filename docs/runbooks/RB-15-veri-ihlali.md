# RB-15 — Kişisel veri ihlali (siteye saldırı / veri sızması şüphesi)

> Bu belge bir **ilk müdahale rehberidir**, hukuki görüş değildir. Gerçek bir olayda bildirim metnini
> bir avukata gösterin. Şirket kurulunca (bkz. `project_company_formation_todo`) veri sorumlusu bilgisi buraya işlenmeli.

## Neden önemli (kısaca)
- **KVKK md. 12/5:** Kişisel veriler hukuka aykırı biçimde başkalarının eline geçerse veri sorumlusu bunu
  **ilgili kişilere en kısa sürede** ve **Kişisel Verileri Koruma Kurulu'na (KVKK) ihlali öğrendiği andan
  itibaren en geç 72 saat içinde** bildirmek zorundadır (Kurul'un ihlal bildirim kararı).
- **GDPR md. 33/34:** Avrupa'dan kullanıcılarımız varsa aynı şekilde 72 saat kuralı geçerlidir.
- Ceza, ihlalin kendisinden çok **bildirmemekten / geç bildirmekten** doğar. Sakladığımız veriyi korumak ve
  olayı hızlı yönetmek hukuki riski azaltır.

## Sistemde ne, nasıl saklanıyor (olay anında neyin sızmış olabileceğini bilmek için)
| Veri | Saklanma |
|---|---|
| Açık adres, telefon, TC kimlik no, vergi no | **Şifreli** (AES-256-GCM). Anahtar `BILLING_ENCRYPTION_KEY`, veritabanında değil sunucu ayarında. |
| Ad, soyad, e-posta, şehir, ilçe, posta kodu, ülke | Şifresiz (arama/fatura için gerekli) |
| Parola | Tek yönlü özet (hash); düz parola yok |
| Kart numarası | **Hiçbir yerde yok** — PayTR'de kalır |
| Taranan belgeler (Belge Tarayıcı) | Veritabanında dosya olarak; hesap silinince silinir |
| Ödeme/fatura kayıtları | Hesap silinse de yasal saklama arşivinde (10 yıl) |

Veritabanı tek başına sızarsa: ad/e-posta/şehir görünür; adres, telefon, TC **okunamaz**.
Veritabanı **ve** `BILLING_ENCRYPTION_KEY` birlikte sızarsa şifreli alanlar da okunabilir → daha ağır olay.

## İlk 1 saat — durdur ve koru
1. Olayı not edin: ne zaman fark edildi, kim fark etti, nasıl (saat/tarih kritik: 72 saat bu andan başlar).
2. Şüpheli erişimi kes: Render panelinden servisi geçici durdurun veya yönetici oturumlarını kapatın.
3. Sırları döndürün (yeni değer üretin, eskisini geçersiz kılın): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   veritabanı parolası, `PAYTR_MERCHANT_KEY`/`SALT` (PayTR panelinden), e-posta uygulama parolası, bulut anahtarları.
   > `BILLING_ENCRYPTION_KEY` **hemen değiştirilmez** — değiştirirsek mevcut şifreli veriler okunamaz hale gelir.
   > Önce şifreli verileri yeni anahtarla yeniden şifreleme planı yapın.
4. Kanıtı koruyun: günlükleri (Render logları, Sentry) silmeyin, kopyasını alın.

## İlk 24 saat — kapsamı belirle
- Hangi tablolar / kaç kullanıcı etkilendi? Hangi alanlar (yukarıdaki tabloya bakın)?
- Veri sadece görüldü mü, indirildi mi? Şifreleme anahtarı da sızdı mı?
- Açığın kapatıldığından emin olun (yama, erişim kuralı) ve tekrar denemeye karşı izleyin.

## 72 saat içinde — bildir
1. **KVKK Kurulu:** kvkk.gov.tr üzerindeki "Veri İhlali Bildirim Formu" ile bildirin. Bilgi tamamlanamıyorsa eldeki ile
   bildirin, kalanını sonradan ekleyin.
2. **Etkilenen kullanıcılar:** e-posta ile, sade dille: ne oldu, hangi veriler, ne yapmaları gerekir (şüpheli e-postalara
   dikkat, parola değişimi), bizimle iletişim. Etkilenenlerin dili (TR/EN) kullanılsın.
3. Avrupa'dan kullanıcı etkilendiyse ilgili ülke denetim otoritesine GDPR bildirimi için avukata danışın.
4. **PayTR** ve ilgili hizmet sağlayıcıları, ödeme verisi etkilendiyse bilgilendirin.

## Sonrası
- Olay raporu yazın (zaman çizelgesi, kök neden, alınan önlemler) ve saklayın — denetimde gösterilir.
- Kalıcı önlem: kök nedeni kapatın; gerekirse şifreleme anahtarı döndürme (yeniden şifreleme) planlayın.
- Bu rehberi olaydan çıkan derslerle güncelleyin.

## Önleyici iyi pratikler (yapılabilecekler)
- Veritabanı ve şifreleme anahtarı **farklı yerlerde** dursun (anahtar bir gizli kasada / ayrı hizmette).
- Gereksiz kişisel veriyi toplamayın ve işi bitince silin (hesap silme akışı bunu yapar; bkz. `lib/account-purge.ts`).
- Yönetici hesaplarında iki adımlı doğrulama açık olsun.
- Veritabanı yedekleri şifreli ve erişimi kısıtlı olsun.
