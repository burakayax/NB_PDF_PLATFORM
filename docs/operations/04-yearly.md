# Yıllık Operasyonlar

> **Ne zaman:** Yılın başı (Ocak) ve ortası (Temmuz) olmak üzere yılda 2 kez, yaklaşık yarım gün.
> **Neden:** Yıllık bakış, büyük mimari kararları, altyapı değişikliklerini ve stratejik yönelimi gözden geçirir.

---

## 📋 Yıllık Kontrol Listesi

### 1. Domain (Alan Adı) Yenileme

> **Domain nedir?** "siteadın.com" gibi internet adresi. Yıllık (bazen 2 yıllık) kiralanır. Süresi dolarsa site erişilemez hale gelir.

```
[ ] Domain ne zaman sona eriyor?
    → Registrar panelinden kontrol et (GoDaddy, Namecheap, vb.)
[ ] Otomatik yenileme açık mı?
    → Kredi kartı geçerli mi?
[ ] Domain için hangi e-posta adresi kayıtlı?
    → Bu e-posta aktif ve erişilebilir mi?
[ ] Alt domainler (alt.siteadın.com) de güncel mi?
```

```bash
# Domain süresini terminalde kontrol et:
whois siteadın.com | grep -i "expir\|renew"
```

**Kritik öneri:** Domaini en az 2 yıl önceden yenile. "Dolan günde bak" stratejisi çok riskli.

---

### 2. SSL/TLS Sertifika Stratejisi Gözden Geçirme

```bash
# Tüm SSL sertifikaların bitiş tarihleri:
for domain in siteadın.com api.siteadın.com; do
  echo -n "$domain: "
  echo | openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | \
    openssl x509 -noout -enddate | cut -d= -f2
done

# Let's Encrypt otomatik yenileme çalışıyor mu?
certbot renew --dry-run
# "Congratulations, all renewals succeeded" görmelisin
```

**Soru:** SSL sertifikan otomatik mı yenileniyor?
- Let's Encrypt + Certbot → 90 günlük sertifika, otomatik yenileme
- Manuel sertifika → Yıllık manuel yenileme gerekir

---

### 3. Altyapı Maliyet ve Mimari İncelemesi

```
YIL BOYUNCA MALİYET ANALİZİ:
[ ] Toplam hosting maliyeti ne kadar?
[ ] Kullanıcı başına ortalama maliyet (COGS)?
    Formül: Toplam Maliyet / Toplam Kullanıcı
[ ] En pahalı bileşen hangisi?
    - Sunucu boyutu doğru seçilmiş mi?
    - Gereksiz büyük sunucu var mı?
    - Kullanılmayan servis var mı?

KARAR NOKTALARI:
[ ] Bu yıl ölçeklenme ihtiyacı yaşandı mı?
[ ] Darboğaz (bottleneck) nerede oluştu?
    - PDF işleme CPU'su mu?
    - Database bağlantısı mı?
    - Disk I/O mu?
[ ] Bir sonraki yıl için kapasite planı yapıldı mı?
```

---

### 4. Güvenlik Açığı Kapsamlı Tarama

```bash
# Tüm Node.js bağımlılıkları (kapsamlı):
cd web/api && npm audit --audit-level=low 2>&1 | tee /tmp/audit-api-$(date +%Y).txt
cd web/frontend && npm audit --audit-level=low 2>&1 | tee /tmp/audit-frontend-$(date +%Y).txt

# Python bağımlılıkları:
pip-audit --requirement web/backend/requirements.txt 2>&1 | \
  tee /tmp/audit-python-$(date +%Y).txt

# Sistem paketleri (Ubuntu/Debian):
sudo apt-get update
apt list --upgradable 2>/dev/null | grep -i "security"

# Açık portlar dış dünyadan:
nmap -sV -O -p 1-65535 localhost 2>/dev/null | grep "open"
# Sadece 22, 80, 443 açık olmalı (5432, 4000, 8000 kapalı olmalı)
```

---

### 5. Gizli Anahtar (Secret) Rotasyonu

> **Secret rotation (gizli anahtar rotasyonu) nedir?** Şifreleri, API anahtarlarını periyodik olarak değiştirmek. Eski anahtar sızdırılmış olsa bile zarar sınırlı kalır.

**Her yıl mutlaka değiştirilmeli:**

```bash
# Yeni JWT secret oluştur (en az 64 karakter):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Bu değeri web/api/.env'e yaz:
# JWT_ACCESS_SECRET=yeni_değer_buraya
# JWT_REFRESH_SECRET=farklı_yeni_değer_buraya

# ÖNEMLI: JWT secret değişince tüm aktif oturumlar geçersiz olur!
# Kullanıcılar yeniden giriş yapmak zorunda kalır.
# Bunu Pazar gece yarısı gibi düşük trafik anında yap.
```

**iyzico API Key rotasyonu:**
1. iyzico paneline gir
2. Yeni API key oluştur
3. .env'de güncelle
4. Servisi yeniden başlat
5. Birkaç test ödemesi yap
6. Eski key'i devre dışı bırak

---

### 6. Felaket Kurtarma Planı Güncellemesi

```
Şu soruları yıllık olarak cevapla:

SENARYO 1: Sunucu tamamen çöktü ve geri getirilemez.
Q: Yeni sunucuyu sıfırdan kaç saatte ayağa kaldırabilirsin?
Q: Son yedeğin tarihi nedir?
Q: Kurulum adımları belgelenmiş mi?

SENARYO 2: Veritabanı bozuldu.
Q: Son veritabanı yedeği ne zaman?
Q: Yedeği restore etmeyi dene ettın mi? (Yıllık test!)
Q: Point-in-time recovery (belirli bir ana geri dönme) mümkün mü?

SENARYO 3: Hesabın ele geçirildi.
Q: Sunucu erişimini nasıl iptal edersin?
Q: Kullanıcılara nasıl haber verirsin?
Q: Hasarı nasıl değerlendirirsin?

SENARYO 4: Ödeme sağlayıcın kapandı (iyzico).
Q: Yedek ödeme sağlayıcın var mı?
Q: Mevcut abonelere nasıl davranırsın?
```

---

### 7. Mimari Darboğaz İncelemesi

```
BU YIL YAŞANAN SORUNLAR:
[ ] Hangi bileşen en çok hata verdi?
[ ] Hangi bileşen en yavaş çalıştı?
[ ] Hangi bileşen en çok bakım gerektirdi?

GELECEK YIL İÇİN SORULAR:
[ ] Thread pool yeterli mi? (PDF_CPU_MAX_IN_FLIGHT)
[ ] SQLite'den PostgreSQL'e geçildi mi? (MUTLAKA geçilmeli üretimde)
[ ] Result store disk tabanlı mı? (100+ kullanıcıda S3'e taşınmalı)
[ ] Rate limiting tek sunucu bazlı mı? (Çoklu sunucuda Redis gerekir)
[ ] Monitoring kurulu mu? (Grafana/Prometheus veya benzeri)
```

---

### 8. Veri Tutma (Data Retention) Politikası Gözden Geçirme

> **GDPR nedir?** Avrupa'nın veri koruma kanunu. Küresel kullanıcıların olduğunda uymanız gerekir. Kullanıcı verisini gereğinden uzun tutmak yasal risk yaratır.

```
[ ] Kullanıcı verileri ne kadar süre saklanıyor?
[ ] Silinen hesapların verileri gerçekten siliniyor mu?
[ ] Upload edilen PDF'ler ne kadar süre tutuluyor?
    → Result store: 30 dakika (uygun)
    → Upload geçicisi: İşlem sonrası hemen siliniyor mu?
[ ] Log dosyaları ne kadar süre tutuluyor?
    → Önerilen: 90 gün üretim, 30 gün geliştirme
[ ] IP adresleri loglarda ne kadar kalıyor?
    → AB kullanıcıları için hassas veri sayılabilir
[ ] KVKK/GDPR uyumu için hukuki danışman gerekiyor mu?
```

---

## 📅 Yıllık Takvim Özeti

```
OCAK:
  - Yıllık büyük güvenlik taraması
  - Secret rotasyonu
  - Yıllık maliyet raporu

ŞUBAT:
  - Domain yenileme kontrolü
  - DR planı güncellemesi

TEMMUZ (Yarı yıl gözden geçirme):
  - Mimari darboğaz analizi
  - Ölçekleme planı güncellemesi
  - Secret rotasyonu (ikinci kez)

ARALIK:
  - Yıl sonu yedek arşivi
  - Gelecek yıl altyapı planı
  - Veri tutma politikası gözden geçirme
```
