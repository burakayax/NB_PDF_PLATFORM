# Ticari E-posta Uyumu ve İYS Kaydı

Bu belge iki şeyi anlatır: sistemin ticari e-posta konusunda **şu an ne yaptığını**, ve
senin **elle yapman gereken** İYS kaydını.

Son güncelleme: 22 Eylül 2026

---

## 1. Hangi e-posta ticari, hangisi değil?

Bu ayrım her şeyin temeli. Yanlış sınıflandırma doğrudan para cezası demek.

**Ticari ileti** = içinde tanıtım, kampanya, indirim veya satın almaya özendirme olan
her e-posta. Gönderebilmek için **önceden onay** şart.

**İşlem e-postası** = hizmetin işleyişinin parçası olan bildirim. Onay gerekmez.
**Ama içine tek bir tanıtım cümlesi girerse ticari iletiye dönüşür.** Mevzuat bu
konuda net: devam eden üyelik, tahsilat, teslimat bildirimlerinde "hiçbir mal veya
hizmet özendirilemez".

### Sistemdeki e-postaların sınıflandırması

| E-posta | Sınıf | İzin kapısı |
|---|---|---|
| Hoş geldin | İşlem | Gerekmez |
| E-posta doğrulama, parola sıfırlama | İşlem | Gerekmez |
| Fatura / makbuz | İşlem | Gerekmez |
| Abonelik yenileme hatırlatması | İşlem | Gerekmez |
| İmza talebi, takım daveti | İşlem | Gerekmez |
| Destek / iletişim yanıtı | İşlem | Gerekmez |
| Yaşam döngüsü kampanyaları (ipucu, yükseltme, geri kazanım) | **Ticari** | Var |
| Yarım kalan ödemeyi tamamlama | **Ticari** | Var |
| "Aylık hakkın doldu" | **Ticari** | Var |
| Yönetim panelinden toplu duyuru | **Ticari** | Var |

> **Not:** Yarım kalan ödeme e-postası kodda uzun süre "işlem e-postası" sayılıyordu.
> Yanlıştı — içinde "yükselttiğinde yapay zekâ araçları açılır" gibi özendirme var.
> 22 Eylül 2026'da ticari ileti olarak yeniden sınıflandırıldı.

---

## 2. Sistem şu an ne yapıyor?

### Tek izin kapısı

Ticari e-posta göndermenin tek yolu `web/api/src/lib/commercial-email-gate.ts`
dosyasındaki kapıdan geçmek. Kapı üç şeyi birden kontrol eder:

1. Kullanıcı pazarlama iznini vermiş mi?
2. Listeden çıkmamış mı?
3. E-posta adresi doğrulanmış mı?

Üçü de sağlanmıyorsa gönderim yapılmaz.

**Neden tek kapı:** Kural daha önce beş ayrı yerde elle yazılmıştı. Dördü doğruydu,
biri (yönetim panelinden toplu duyuru) unutulmuştu ve izni olmayan, hatta listeden
çıkmış kullanıcılara ticari e-posta gönderiyordu. Artık kural tek yerde.

### Yeni bir toplu gönderim yazarken

İki şeyi de yap:

```ts
// 1) Liste sorgusunda
where: { ...commercialRecipientWhere(), /* diğer koşullar */ }

// 2) Gönderim anında (kapı ikinci savunma)
await assertCommercialConsent(userId);
```

### Onay kanıtı

Her onay ve her ret `marketing_consent_logs` tablosuna yazılır: tarih, kanal,
kullanıcıya o an gösterilen metin, bağlantı bilgileri. Mevzuat onayın ispatını
gönderenden istiyor — "izni vardı" demek yetmiyor, gösterilebilmesi gerekiyor.

Kayıtlar 3 yıl saklanır, sonra otomatik silinir.

> **Dikkat:** Kayıt formundaki onay metnini değiştirirsen,
> `marketing-consent.service.ts` içindeki `SIGNUP_CONSENT_TEXT` sabitini de
> güncelle ve sürüm numarasını artır (`v1` → `v2`). Yoksa kanıt, kullanıcının
> hiç görmediği bir metni saklar ve değerini kaybeder.

### Ret (listeden çıkış)

Her ticari e-postada tek tıkla çıkış bağlantısı ve tek-tık çıkış başlığı var.
Ret **anında** işlenir. Mevzuat 3 iş günü sınırı koyuyor; beklemenin bir faydası yok.

---

## 3. Senin yapman gerekenler

### 3.1 COMPANY_* ayarlarını doldur — ACİL

Tanıtım e-postalarının içinde şunlar **zorunlu**:

- Şirketsen: **ticaret unvanı + MERSİS numarası**
- Şahıs işletmesi/esnafsan: **ad soyad + T.C. kimlik numarası**
- Telefon veya e-posta adresinden **en az biri**

`web/api/.env` dosyasına gir:

```
COMPANY_LEGAL_NAME=
COMPANY_MERSIS_NO=      # şirketsen
COMPANY_TCKN=           # şahıs işletmesiysen (MERSİS'i boş bırak)
COMPANY_PHONE=
COMPANY_CONTACT_EMAIL=
```

Eksikse sunucu açılışta uyarı verir ama gönderimi durdurmaz. Bu bilgiler olmadan
gönderilen her tanıtım e-postası Yönetmelik md.7'ye aykırıdır.

### 3.2 İYS kaydı — ZORUNLU

Ticari e-posta gönderen herkes kapsamda. İşletme büyüklüğüne göre muafiyet yok.

**Adımlar:**

1. **Hazırlık.** Yetkilinin e-Devlet girişi hazır olsun. Bazı adımlarda e-imza veya
   mobil imza isteniyor. Şahıs firması olarak da kaydolabilirsin; şirket kurmuş
   olman gerekmiyor.

2. **Başvuru.** `iys.org.tr` → "Hizmet Sağlayıcı Girişi". Firma unvanı, vergi/MERSİS
   bilgileri, yetkili kişi bilgileri ve **marka** tanımlanır.
   *Buradaki "marka" TÜRKPATENT tescili değil* — İYS içinde gönderim yapacağın ad,
   yani "PDF Platform". Marka tescili şart değil.

3. **Sözleşme.** İYS'nin elektronik sözleşmesi imzalanır, inceleme sonrası hesap açılır.

4. **Erişim yolu seç.** İletişim adresi sayısı 250.000'in altında olan işletmeler
   verilerini sisteme **doğrudan aktaramıyor**. İki seçenek:
   - İYS web panelinden manuel/toplu yükleme (az sayıda izin varsa yeterli)
   - Bir entegratör firma yetkilendirmek (otomatik aktarım — site otomatik e-posta
     gönderdiği için uzun vadede bu gerekli)

5. **Mevcut izinleri yükle.** Bugüne kadar kayıt sırasında pazarlama izni vermiş
   kullanıcıların izinleri sisteme yüklenmeli. Sistem dışında alınan onaylar
   **3 iş günü içinde** İYS'ye bildirilmeli; bildirilmeyen onay geçersiz sayılıyor.

**Kayıt tamamlandıktan sonra kalıcı işleyiş:**

- Her yeni izin 3 iş günü içinde İYS'ye gidecek
- Her gönderimden önce İYS kontrolü yapılacak
- Her ret 3 iş günü içinde İYS'ye bildirilecek
- Ret **kanal bazlıdır**: e-postadan çıkan kişi SMS iznini kaybetmez

> **Kod tarafı hazır:** İzin kapısı (`commercial-email-gate.ts`) İYS sorgusunun
> ekleneceği yer olarak tasarlandı. Entegratör seçildikten sonra sorgu
> `checkCommercialConsent` içine eklenecek; başka hiçbir yeri değiştirmek
> gerekmeyecek.

### 3.3 Yurt dışına veri aktarımı bildirimi

Sunucu barındırma, e-posta gönderimi, hata izleme ve yapay zekâ sağlayıcısı yurt
dışında. Yeterlilik kararı bulunmayan ülkelere düzenli aktarım için **standart
sözleşme** imzalanması ve **5 iş günü içinde** Kurum'a bildirilmesi gerekiyor.

Bunun yapılıp yapılmadığı teyit edilmeli.

### 3.4 VERBİS — muafsın

2026 eşikleri: 50'den az çalışan **ve** yıllık bilanço 100 milyon TL altı **ve** ana
faaliyeti özel nitelikli veri işleme olmayan işletmeler VERBİS kaydından muaf.
Muafiyet yalnızca sicile kayıt içindir; diğer KVKK yükümlülükleri aynen devam eder.

---

## 4. Geri alma talimatı

Bu değişikliklerin herhangi biri geri alınmak istenirse:

- **Konu satırındaki `[Tanıtım]` ibaresi:** `email-layout.ts` içindeki
  `commercialSubject` fonksiyonu etiketi ekliyor. Kaldırılırsa, iletinin ticari
  niteliğinin içerikten *açıkça* anlaşıldığı her konu başlığı için tek tek karar
  vermek gerekir — Yönetmelik md.7 bunu şart koşuyor.
- **Doğrulanmamış adres kontrolü:** `commercialRecipientWhere` içindeki
  `isVerified: true`. Kaldırılırsa, kayıt formuna başkasının adresini yazmış
  kişilere ticari e-posta gidebilir.
- **Toplu duyurudaki izin filtresi:** Kaldırılmamalı. Bu, 22 Eylül 2026'da kapatılan
  açığın ta kendisi.
