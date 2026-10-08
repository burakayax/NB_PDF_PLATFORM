# 🎁 PDF Sıkıştır — Misafir Hakkı ve Üyeliğe Dönüşüm

## Bu belge ne anlatıyor?

PDF Sıkıştırma aracını **üye olmayan ziyaretçiye de açtık**, ama bilerek çok dar bir kapıdan: günde **1 deneme**.
Amaç ziyaretçinin kayıt olmadan değeri **bir kez görmesi**, ardından üyeliğe geçmesi. Bu belge kararı, ayarları,
nasıl geri alınacağını, neye bakacağını ve sıradaki dönüşüm işlerini anlatır.

> Kısaca: **Üye olmayan 1 hak · Ücretsiz üye 3 hak · Paket alan paketinin hakkı (ek ücret yok).**

---

## 1) Karar (hangi kullanıcı ne alır?)

| Kim | Günlük PDF sıkıştırma hakkı | Not |
|---|---|---|
| **Üye olmayan ziyaretçi** | **1** | Cihaz/ağ başına sayılır. Gece yarısı (İstanbul saati) yenilenir. |
| **Ücretsiz üye** | **3** | Sayaç **ortaktır**: sıkıştırma, PDF kilidi açma ve PDF→metin aynı 3 hakkı paylaşır. |
| **Starter** | 25 | Paketin günlük hakkı. |
| **Plus / Pro / Business** | Sınırsız (günlük) | Aylık planın kendi sınırı geçerlidir. |

- Paket alanlar için **ayrıca bir şey yapılmadı**: sıkıştırma zaten paketlerin içinde. Satın alan kullanıcı bunun için ek ücret ödemez.
- **Neden sunucu araçlarına hak veriyoruz?** Sıkıştırma dosyayı sunucuda işler (bize maliyeti var). Tarayıcıda çalışan araçlar
  (birleştir, böl, döndür…) zaten üyeliksiz ve sınırsız. Sunucu aracında "bedava ama dar" kapı, ziyaretçiyi üyeliğe taşımanın
  en dürüst yolu.

---

## 2) Ziyaretçi ne görüyor? (adım adım)

1. `pdfplatform.app/tools/compress` sayfasını açar. Üstte yeşil bir şeritte yazar:
   **"Üye olmadan günde 1 ücretsiz PDF sıkıştırma hakkın var · Ücretsiz üyelikle günde 3 işlem · Ücretsiz üye ol"**.
2. PDF'i seçer (en fazla **20 MB**). Hak, dosya seçmeden **önce** gösterilir — sürpriz yok.
3. **Ya kaliteye göre ya hedef boyuta göre** seçer (ikisi birlikte seçilemez; hedef boyut seçilince kaliteyi araç belirler).
4. "PDF'i sıkıştır" der. Sonuç ekranında İndir / Aç (destekleyen cihazda Paylaş) çıkar.
5. Sonuç ekranının altında **somut davet** vardır: "Beğendin mi? Üye olunca günde 3 işlem seninle" + "Ücretsiz üye ol" +
   "Paketlere bak".
6. Aynı gün ikinci kez denerse **kapı** çıkar: "Bugünkü ücretsiz hakkını kullandın" → "Ücretsiz üye ol / Giriş yap".
   Altta dürüst bir yönlendirme: birleştir/böl/döndür gibi araçlar üyeliksiz ve sınırsız.

> **Dosya sunucuya gidiyor mu?** Evet. Sıkıştırma sunucuda yapılır; dosya şifreli aktarılır ve işlem sonrası silinir.
> Ekranda bunu açıkça yazdık ("cihazından çıkmaz" **demiyoruz**).

---

## 3) Nasıl çalışıyor? (sade anlatım)

- Ziyaretçi kimliği olarak **IP adresinin tuzlanmış özeti** tutulur. Düz IP saklanmaz.
- **Sayaç ve ayarlar veritabanında** tutulur (kalıcı; yeniden dağıtımda ve yeniden başlatmada sıfırlanmaz, birden fazla sunucu örneğinde ortaktır). PDF servisi bunlara ana (auth) sunucu üzerinden ulaşır.
- Hak, işlem **başlarken** düşer (sunucu maliyeti o an doğar). İşlem **hata verirse hak iade edilir**
  (parola korumalı/bozuk dosya vb.). Yanlış dosya yüzünden hak yanmaz.
- Sonucu yalnızca işlemi başlatan görebilir/indirebilir (ona özel rastgele anahtarla). İndirince sunucudan silinir.
- **İki üst sınır** vardır: kişi başı günde 1 ve **toplam günlük kapasite** (varsayılan 400). Biri IP değiştirip sunucuyu
  bedavaya yormaya çalışsa bile toplam sınır korur. Kapasite dolarsa ziyaretçiye "üye olarak devam edebilirsin" denir.
- Ek korumalar: dosya boyutu sınırı, PDF doğrulama, dakikada en fazla 8 başlatma.

Kod nerede (geliştirici için): PDF servisi `web/backend/app/api/guest_compress_routes.py` + `web/backend/app/core/guest_daily_limit.py` (köprü ve yerel yedek);
ana sunucu `web/api/src/modules/guest-compress/` (ayar, sayaç, dahili uçlar, yönetici uçları); panel `web/frontend/src/admin/GuestCompressSettings.tsx`;
sayfa `web/frontend/src/components/tools/GuestCompressTool.tsx`, bağlantı `App.tsx` (`seoSlug === "compress" && !isAuthenticated`).

---

## 4) Ayarlar ve acil kapatma — YÖNETİM PANELİNDEN

**Yönetim paneli → Sistem kontrol → "Misafir PDF Sıkıştır hakkı"** (Render'a girmene gerek yok).

| Alan | Varsayılan | Ne yapar |
|---|---|---|
| **Acil kapat / Yeniden aç** düğmesi | Açık | Tek tıkla misafir kullanımını durdurur; ziyaretçiler "üye ol" kapısını görür. |
| Kişi başı günlük hak | `1` | Bir cihaz/ağın bir günde yapabileceği sıkıştırma. `0` = kapalı. |
| Toplam günlük kapasite | `400` | Tüm misafirlerin toplamı (maliyet üst sınırı). `0` = kapalı. |
| En büyük dosya (MB) | `20` | Misafir için en büyük PDF. |

- Değişiklik veritabanına yazılır; PDF servisi **yaklaşık 30 saniyede** alır. Yeniden dağıtım gerekmez.
- **Acil kapatma ne işe yarar?** Bir suistimal ya da sunucu yükü fark edersen kod değiştirmeden ve yeniden dağıtmadan misafir
  kullanımını anında durdurur. **Üyelerin hakkı (günde 3) ve paket sahipleri etkilenmez.** İstediğin an yeniden açabilirsin.
- `0` yazmak **sınırsız değil, KAPALI** demektir. Misafir erişimini "sınırsız" yapan hiçbir ayar yoktur; değerler güvenli aralığa
  zorlanır (kişi başı en çok 20, kapasite en çok 100.000, dosya en çok 100 MB).
- Panelde ayrıca **bugünkü kullanım** (kaç işlem, kaç farklı ziyaretçi, kapasitenin yüzde kaçı) ve **sayaç durumu** görünür.
- Misafir hakkını ücretsiz üye hakkına (3) eşit ya da büyük yazarsan panel uyarır (üyelik avantajı kalmaz).

### Sayaç durumu (panelde renkli kutu)

| Kutu | Anlamı | Ne yap |
|---|---|---|
| 🟢 "Sayaç veritabanında tutuluyor (kalıcı)" | Her şey yolunda; PDF servisi ana sunucuya ulaşıyor. | Bir şey yapma. |
| 🟡 "Ortak anahtar tanımlı, ama PDF servisi henüz ulaşmadı" | Sunucu yeni başlamış olabilir. | Bir ziyaretçi sıkıştırdıktan sonra tekrar bak. Yeşile dönmezse iki sunucudaki anahtarın **aynı** olduğunu kontrol et. |
| 🔴 "Sayaç geçici diskte tutuluyor" | `INTERNAL_SERVICE_SECRET` tanımlı değil. Sayaç PDF servisinin geçici diskinde; **her yeniden başlatmada sıfırlanır.** | Render'da **nb-pdf-api VE nb-auth-api**'ye **aynı** uzun rastgele değeri `INTERNAL_SERVICE_SECRET` olarak ekle (bu anahtar yalnızca iki sunucu arasında kullanılır; PDF Düzenle de aynısını kullanır). |

### Render'da kalan (yedek / güvenlik) ayarlar — nb-pdf-api

| Ayar | Varsayılan | Ne zaman gerekir |
|---|---|---|
| `INTERNAL_SERVICE_SECRET` | — | **Gerekli** (iki serviste aynı): sayaç ve panel ayarının köprüsü. |
| `GUEST_TRUSTED_PROXY_HOPS` | `1` | PDF servisinin önündeki güvenilir ara sunucu sayısı (yalnız Render = 1, Cloudflare + Render = 2). IP, adres listesinin **sağından** bu kadar geriden alınır; istemcinin yazdığı sahte değerler sayılmaz. Altyapıya bağlı olduğu için panelde **yok**. |
| `GUEST_TRUST_CF_HEADER` | kapalı | `1` ise Cloudflare'in `CF-Connecting-IP` başlığına güvenilir. Yalnız PDF servisine **sadece** Cloudflare üzerinden erişiliyorsa aç; aksi halde istemci o başlığı da taklit edebilir. |
| `GUEST_COMPRESS_DAILY_LIMIT` / `…_GLOBAL_DAILY_LIMIT` / `…_MAX_MB` | 1 / 400 / 20 | **Yalnız yedek:** panelle bağlantı hiç kurulamazsa (anahtar yok ya da ana sunucu kapalı) geçerli olur. Panel erişilebilirken panel kazanır. |
| `GUEST_LIMIT_DB` | `tmp/guest_daily_limit.db` | Yalnız yedek sayaç dosyası (köprü çalışırken kullanılmaz). |

> **Güvenli yedek davranışı:** Ana sunucuya bir an ulaşılamazsa PDF servisi **son bilinen panel ayarını** kullanır. Yani kapıyı
> kapattıysan, kısa bir kesinti kapıyı yeniden **açmaz**.

---

## 5) Eski duruma dönmek (geri alma)

- **Hızlı (önerilen):** Panelde **Acil kapat** → misafirler artık sıkıştıramaz, üyelik kapısı görür. Kod değişmez, ~30 sn'de etkili olur.
- **Tam:** geliştiriciye şunu söyle: *"App.tsx'teki `seoSlug === "compress" && !isAuthenticated` bloğunu sil, `main.py`'deki
  `guest_compress_router` satırını kaldır."* Sayfa eski "Ücretsiz Kullan → giriş" akışına döner.
- Üye (3 hak) ve paket davranışı bu işten **etkilenmez**.

---

## 6) Bilinen sınırlar (dürüstçe)

1. **Ortak ağ:** Okul, ofis, kafe, mobil operatör gibi aynı IP'yi paylaşan kişiler **tek hakkı** paylaşır. Bazı gerçek
   kullanıcılar "hakkım yok" görebilir; üye olmak bunu çözer. Şikâyet gelirse önce hakkı 2 yapmayı düşün.
2. **Köprü anahtarı şart:** `INTERNAL_SERVICE_SECRET` iki serviste de tanımlı değilse sayaç geçici diske düşer ve her yeniden
   başlatmada sıfırlanır (panel bunu kırmızı kutuyla gösterir).
3. **IP tespiti ayarına bağlı:** Doğru ara-sunucu sayısı girilmezse ya aynı ağdaki herkes tek hak paylaşır ya da hak taklide açılır
   (bkz. ayar tablosu). Dağıtımdan sonra topolojiyi değiştirirsen bu ayarı da güncelle.
4. **Bot koruması yok:** CAPTCHA/Turnstile yok. Koruma = kişi başı 1 + toplam kapasite + dakikalık sınır + 20 MB.
5. **IP döndürme:** Kararlı biri her seferinde yeni IP ile 1'er hak alabilir; toplam kapasite maliyeti sınırlar.
6. **Tek dosya:** Misafir toplu işlem yapamaz (toplu işlem zaten Pro).
7. **"Kaliteli" seçeneği** misafirde yok (üyelikte ücretsiz planda da kilitli; Plus ve üstü).

---

## 7) Neye bakacağız? (ölçüm)

**Yönetim paneli → Kullanıcı Yolculuğu** sekmesinde misafir hikâyesi satır satır görünür:
- "**PDF Sıkıştır** işlemini başarıyla tamamladı → üye olma ekranı gösterildi" (sonuç ekranındaki davet gösterildi)
- "“Ücretsiz hesap aç” butonuna tıkladı" (davet/kapı/şerit tıklaması)
- "Günlük kullanım hakkı bitti" (misafir kapıya çarptı)
- "Kayıt oldu 🎉"

Ölçüm adları (geliştirici için): `sign_up_cta_shown` (kaynak `compress_success`), `sign_up_cta_click` (kaynak `compress_banner`,
`compress_success`, `compress_gate`), `quota_wall_hit` (kaynak `compress_guest`). Google Analytics'te ayrıca
`guest_compress_started` ve `guest_compress_done` (`saved_pct`, `mode`).

**Takip edilecek 4 sayı** (uydurma hedef koymadım; ilk 2 haftada **tabanı** gör, sonra karar ver):
1. Günde kaç misafir sıkıştırma yaptı?
2. Sonuç ekranını görenlerin kaçı "Ücretsiz üye ol"a tıkladı?
3. Kapıya çarpanların kaçı kayıt oldu?
4. Bu yoldan gelen kayıtların kaçı sonra ücretli pakete geçti?

> En az **~100 tamamlanmış işlem** birikmeden oranlardan karar çıkarma; küçük sayıda oranlar yanıltır.

---

## 8) Dönüşüm çalışması — yapılanlar ve sıradakiler

**Yapıldı (bu iş):**
- Misafire hak, yüklemeden **önce** ve açıkça gösteriliyor (şerit).
- Sonuç ekranında **somut** davet: "günde 3 işlem, kart gerekmez" + paketlere bağlantı.
- Hak bitince **kapı**: tek bir net eylem (Ücretsiz üye ol), ikincil: Giriş yap, Paketlere bak.
- Kapıda **cihazda çalışan araçlara dürüst yönlendirme** (üyeliksiz, sınırsız) → ziyaretçiyi hayal kırıklığıyla göndermiyoruz.
- Arama sonuçlarında (SEO) "Üye olmadan kullanabilir miyim?" sorusu eklendi (TR+EN).
- Yönetici yolculuk ekranında araç adı görünüyor ("PDF Sıkıştır").

**Sıradaki fikirler (öncelik sırasıyla, hiçbiri yapılmadı):**
1. **Kayıt sonrası kaldığı yerden devam:** Kayıt olan kişi aynı dosyayı yeniden yüklemek zorunda kalıyor. Dosyayı tarayıcıda
   geçici saklayıp kayıttan sonra "Sıkıştırmaya devam et" demek kaybı azaltır.
2. **Fiyat/paket sayfasına karşılaştırma satırı:** "PDF sıkıştırma: Misafir 1/gün · Üye 3/gün · Paket: plan hakkı".
3. **Üye için "kalan hak" göstergesi** çalışma alanında zaten var (QuotaWidget); hak 1'e düşünce nazik bir paket daveti.
4. **Metin denemeleri (A/B):** kapı başlığı ("Bugünkü hakkını kullandın" / "Beğendin mi? Devam etmek için üye ol"), davetin zamanlaması.
5. **Hak sayısı denemesi:** misafir 1 ↔ 2; üye 3 ↔ 5 (ancak üye değişikliği tüm sunucu araçlarını etkiler; önce ölçüm).
6. **Terk e-postası YOK:** Misafirden e-posta toplamadık; ticari e-posta için izin/İYS düzeni önce oturmalı (bkz. e-posta uyumu notları).
7. **Sosyal medya videosu:** PDF Sıkıştırma tanıtım videosu hazır (proje kökünde `pdf-sikistirma-reels.mp4`); video sonunda
   "Bağlantı profilde" diyor. Videoda artık misafir hakkından da söz edilebilir ("üyeliksiz dene").

---

## 9) Yayına alırken kontrol listesi

- [ ] **Panel → Sistem kontrol → Misafir PDF Sıkıştır hakkı** kutusunu aç: durum **AÇIK**, sayaç kutusu 🟢 olmalı. 🔴 ise `INTERNAL_SERVICE_SECRET`'ı iki servise ekle (bkz. bölüm 4).
- [ ] Yeni uçlar (`/api/guest-compress/*`) **ayrı yönlendirme istemez**: üretimde arayüz PDF servisine `VITE_API_BASE` adresiyle gider ve
      yeni uçlar da aynı adresi kullanır. Kolay test: gizli pencerede `pdfplatform.app/tools/compress` → üstte yeşil şerit
      görünmeli; görünmüyorsa PDF servisi kapalı ya da `VITE_API_BASE` yanlıştır.
- [ ] **IP ayarı:** PDF servisi yalnız Render önündeyse varsayılan doğrudur (`GUEST_TRUSTED_PROXY_HOPS=1`). İleride önüne Cloudflare gelirse
      `GUEST_TRUSTED_PROXY_HOPS=2` yap; yanlış ayar ya herkesi tek IP gibi sayar (hak paylaşılır) ya da taklide açık bırakır.
- [ ] Derleme `prebuild` ile arama sayfalarını yeniden üretir (yeni SSS oraya yansır); elle bir şey yapma.
- [ ] **Test:** gizli pencere → PDF yükle → sıkıştır → sonuç + davet → sayfayı yenile → **kapı** görünmeli.
- [ ] **Test:** giriş yap → `/tools/compress` → çalışma alanı açılmalı (misafir sayfası **görünmemeli**).
- [ ] Ertesi gün aynı cihazla tekrar dene: hak yenilenmiş olmalı.

---

## 10) Sorun giderme

| Belirti | Olası neden | Ne yap |
|---|---|---|
| "Hakkım bitmedi ama kapı çıkıyor" | Aynı ağdaki biri kullandı | Üye ol; ya da hakkı 2 yap |
| Yeşil şerit görünmüyor | PDF servisi kapalı ya da `VITE_API_BASE` yanlış | PDF servisinin `/api/health` adresini ve `VITE_API_BASE`'i kontrol et |
| "Bugünkü misafir kapasitesi doldu" | Toplam kapasite doldu | Bu iyi bir işaret olabilir; sınırı artırmadan önce kayıt oranına bak |
| Sıkıştırma "başarısız" | Parola korumalı/bozuk PDF | Hak iade edilir; üye akışı parola destekler |
| Deploy sonrası hak yenilendi | Sayaç geçici diskte (köprü yok) | Panelde sayaç kutusu 🔴 ise `INTERNAL_SERVICE_SECRET`'ı ekle |
| Panelde değiştirdim ama etkisi yok | PDF servisi ayarı 30 sn önbellekte tutar | 30–60 sn bekle; olmazsa sayaç kutusunu kontrol et |
