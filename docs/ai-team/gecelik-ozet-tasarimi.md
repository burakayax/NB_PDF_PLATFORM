# Gecelik özet belgesi — tasarım (onay bekliyor, kod yazılmadı)

## Amaç
Yapay zekâ görevlerinin (ve sizin) sabah tek bir yerden **doğru, işe yarar özet sayıları** okuyabilmesi. Sisteme erişim vermeden, yalnızca önceden hesaplanmış bir belge okunur.

## Nasıl çalışır (öneri)
1. Her gece (örn. 03:00 TR saati) küçük bir iş çalışır ve dünün sayılarını hesaplar.
2. Sonuç tek bir belge olarak yazılır: `ozet-YYYY-AA-GG` (okunur metin + makine okunur JSON).
3. Sayılar panelin zaten kullandığı hesap fonksiyonlarından alınır (panel ile aynı kaynak).
4. Doğrulama kontrolü çalışır (aşağıda). Tutmazsa belgenin en üstüne **UYARI** yazılır.
5. Belge, yapay zekâ görevlerinin okuyabileceği ama başka bir şey yapamayacağı bir yere konur.

## İçereceği sayılar (kişisel veri YOK)
**Kullanıcılar:** yeni üye (dün), toplam üye, aktif üye (giriş yapan), misafir ziyaretçi.
**Satış (panelin "Satışlar" ekranıyla aynı):** başarılı ödeme sayısı ve toplamı (TL), iade sayısı ve toplamı, net toplam, yurt dışı ödeme sayısı, yeni/iptal edilen abonelik, plan başına abone sayısı.
**Kullanım:** toplam işlem, araç başına işlem (ilk 10), günlük limite takılan kullanıcı sayısı, misafir→üye dönüşüm oranı.
**Sağlık:** son 24 saatte hizmet durumu (kesinti dakikası), hata sayısı (Sentry/hata analizi), başarısız ödeme sayısı.
**Not:** 5'ten küçük sayılar tek tek kişiyi tanıtabilir; bunlar "<5" yazılır. E-posta, isim, IP, dosya adı hiçbir yerde yok.

## Doğrulama kontrolü ("sayılar doğru mu?")
Her sayı **iki ayrı yoldan** hesaplanır ve karşılaştırılır:
- **Yol 1:** panelin kullandığı hesap fonksiyonu (örn. ödeme özeti, ziyaretçi/satış özeti).
- **Yol 2:** aynı aralık için ham kayıtlardan bağımsız bir sayım sorgusu.
Kurallar:
- Fark sıfırsa sayı "doğrulandı ✓" işaretlenir.
- Fark varsa belgeye "TUTMUYOR: panel X, ham sayım Y" yazılır; ajan o sayıya güvenmez.
- Bir haftalık gerçek ziyaretçi/satış hareketine kıyasla, ilk 7 gece sizin elle panelden kıyaslamanız istenir (ilk kurulumda güven kazanmak için).
- Para toplamlarında TL/USD ayrı tutulur; kur dönüşümü yapılmaz.

## Nerede saklanır (seçenekler)
| Seçenek | Artı | Eksi |
|---|---|---|
| **A. Ayrı küçük depolama kovası (Cloudflare R2)** + yalnız bu kovayı okuyan ayrı anahtar | Sisteme/veritabanına hiç erişim yok; anahtar iptali kolay; veritabanı şeması değişmez | Yeni kova ve anahtar kurulumu (R2 ücretsiz kotası içinde, ek ücret beklenmez) |
| B. Ayarlar kaydı (`SiteSetting`) + panelde "Gecelik özet" sayfası | Yeni tablo gerekmez, şema değişmez | Ajanın okuması için ayrıca bir erişim yolu gerekir |
| C. Sahibe e-posta | Basit | Ajan okuyamaz; arşiv zor |

**Öneri:** A (belge) + B (panelde sizin için görünüm). Yeni **veritabanı tablosu gerekmiyor**; bu yüzden şema onayı gerekmez. Yeni R2 kovası/anahtarı oluşturmak için **sizin onayınız** gerekir (şu an hiçbir şey kurulmadı).

## Riskler
- Yanlış sayı yanlış karar yaptırır → doğrulama kontrolü ve ilk hafta elle kıyaslama bunun için.
- İş çalışmazsa belge eskir → belgeye "oluşturulma zamanı" yazılır; 26 saatten eskiyse ajan "bayat" der.
- Gece işi Render'da çalışır; ayrı bir cron servisi ücretlidir (ücretsiz planda cron yok). Mevcut `nb-auth-api` içinde zamanlanmış iş olarak çalıştırmak ek maliyet çıkarmaz.

## Onay beklenenler
1. Sayı listesi uygun mu?
2. Saklama: A + B önerisi uygun mu? R2'de ayrı kova ve salt okunur anahtar oluşturmayı onaylıyor musunuz?
3. Hangi saatte çalışsın?
