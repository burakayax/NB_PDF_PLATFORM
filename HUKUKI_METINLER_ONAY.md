# Hukuki Metinler — Onay Bekliyor

Bu dosya `web/frontend/src/content/petitionTemplates.ts` dosyasından üretilmiştir. Dilekçe şablonlarındaki TÜM sabit metinler aşağıdadır. **Onaylamadan önce canlıya alınmamalıdır.** Düzeltme için bu dosyada işaretleyip bana iletin; metinler tek dosyadan değişir.

Siteye eklenen genel uyarı (her şablon sayfasında ve sonuç ekranında):
> Şablonlar genel bilgilendirme amaçlıdır, hukuki danışmanlık değildir; kendi durumunuza uyarlayın, gerekirse bir avukata danışın.

UDF çıktısında ek olarak:
> Bu araç resmi bir UYAP hizmeti değildir. E-imzalı belgelerin imzası dönüştürülen kopyaya taşınmaz; resmi gönderimlerde orijinal imzalı belgeyi kullanın.

Ortak alanlar: Ad Soyad, T.C. Kimlik No, Adres, Telefon, Tarih.

**Özellikle kontrol edilmesi gereken hukuki atıflar:** 4982 sayılı Bilgi Edinme Hakkı Kanunu (Bilgi Edinme), 6502 sayılı Tüketicinin Korunması Hakkında Kanun (İade Talebi). Başka madde numarası veya süre iddiası bilerek YAZILMADI.

## 1. Genel Dilekçe

- Açıklama: Herhangi bir kuruma yazılacak başvuru dilekçesi.
- Makam satırı: {{kurum}} MAKAMINA
- Konu: {{konu}}
- Doldurulacak alanlar: Başvurulan kurum, Konu, Açıklama, Talebiniz

Gövde:

> {{aciklama}}
>
> Yukarıda arz ve izah edilen nedenlerle; {{talep}}
>
> Gereğini saygılarımla arz ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

## 2. Bilgi Edinme Başvurusu

- Açıklama: Bir kurumdan bilgi veya belge talebi.
- Makam satırı: {{kurum}} MAKAMINA
- Konu: Bilgi edinme talebi
- Doldurulacak alanlar: Başvurulan kurum, İstenen bilgi veya belge

Gövde:

> 4982 sayılı Bilgi Edinme Hakkı Kanunu kapsamında, aşağıda belirtilen bilgi ve/veya belgelerin tarafıma verilmesini talep ediyorum.
>
> İstenen bilgi/belge: {{bilgi}}
>
> Talebimin kanunda öngörülen süre içinde cevaplandırılmasını ve cevabın yukarıdaki adresime/iletişim bilgilerime gönderilmesini arz ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

## 3. İstifa Dilekçesi

- Açıklama: İşten ayrılma bildirimi.
- Makam satırı: {{isyeri}} İNSAN KAYNAKLARI MÜDÜRLÜĞÜNE
- Konu: İstifa bildirimi
- Doldurulacak alanlar: İşyeri adı, Göreviniz / unvanınız, Ayrılış tarihi

Gövde:

> {{gorev}} olarak yürüttüğüm görevimden {{istifaTarihi}} tarihi itibarıyla kendi isteğimle ayrılıyorum.
>
> Bugüne kadar gösterilen ilgi ve destek için teşekkür eder, işbu istifa dilekçemin işleme alınmasını arz ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

## 4. Ürün İade / Bedel İadesi Talebi

- Açıklama: Satıcıya yazılı iade talebi.
- Makam satırı: {{satici}}'NE
- Konu: Ürün iadesi ve bedel iadesi talebi
- Doldurulacak alanlar: Satıcı / firma adı, Ürün adı, Sipariş tarihi, Sipariş numarası (isteğe bağlı), İade nedeni

Gövde:

> {{siparisTarihi}} tarihinde sipariş ettiğim, {{siparisNo}} sipariş numaralı "{{urun}}" ürününe ilişkin olarak iade talebimi bildiriyorum.
>
> İade nedenim: {{neden}}
>
> 6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan haklarım saklı kalmak kaydıyla, ürünün iadesi karşılığında ödediğim bedelin tarafıma iade edilmesini talep ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

## 5. Abonelik İptal Talebi

- Açıklama: Abonelik veya hizmeti sonlandırma bildirimi.
- Makam satırı: {{firma}}'YA
- Konu: Abonelik iptal talebi
- Doldurulacak alanlar: Firma adı, Abonelik / müşteri numarası, İptal tarihi

Gövde:

> {{abonelikNo}} numaralı aboneliğimi/hizmetimi {{iptalTarihi}} tarihi itibarıyla sonlandırmak istiyorum.
>
> Bu tarihten sonra tarafımdan ücret tahsil edilmemesini ve iptal işleminin yazılı olarak teyit edilmesini arz ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

## 6. Kiracı Tahliye Bildirimi

- Açıklama: Kiralanan yeri boşaltacağınızı bildirme.
- Makam satırı: SAYIN {{kiralayan}}'A
- Konu: Kiralanan taşınmazın tahliyesi
- Doldurulacak alanlar: Kiralayanın (ev sahibinin) adı, Kiralanan taşınmazın adresi, Tahliye tarihi

Gövde:

> {{tasinmaz}} adresindeki taşınmazı kiracı sıfatıyla kullanmaktayım.
>
> Kira ilişkisini {{tahliyeTarihi}} tarihi itibarıyla sona erdirerek taşınmazı bu tarihte tahliye edeceğimi bildiririm.
>
> Taşınmazın teslimi ve depozitonun iadesi konusunda iletişime geçilmesini arz ederim.
>

- [ ] Onaylıyorum  - [ ] Değişiklik istiyorum: ........

