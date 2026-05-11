# Aylık Operasyonlar

> **Ne zaman:** Her ayın ilk haftası, yaklaşık 2-3 saat.
> **Neden:** Aylık bakış, haftalık kontrolde görünmeyen trendleri ortaya çıkarır. Büyüme, maliyet, güvenlik açıkları burada görünür.

---

## 📋 Aylık Kontrol Listesi

### 1. Altyapı Maliyet İncelemesi

> **Neden önemli?** PDF SaaS'ın en büyük gizli giderleri depolama ve bant genişliğidir. Kullanım arttıkça maliyet katlanır.

```
[ ] Hosting maliyeti bu ay kaç TL/USD oldu?
[ ] Geçen aya göre artış var mı? Neden?
[ ] En büyük maliyet kalemi hangisi?
    - Sunucu (CPU/RAM)?
    - Depolama?
    - Bant genişliği (bandwidth)?
    - Database?
[ ] Kullanılmayan kaynak var mı? (eski snapshot'lar, kullanılmayan server'lar)
```

Tipik maliyet tuzakları:
- Eski server snapshot'ları (anlık yedek görüntüler) silinmeden birikir
- Log dosyaları sıkıştırılmazsa devasa büyür
- PDF geçici dosyaları temizlenmeden depolanır

---

### 2. Sunucu Performans Raporu

```bash
# Bu ayın CPU ortalama kullanımı (eğer uptime monitoring varsa):
# UptimeRobot'tan ya da Grafana'dan al

# Bellek trend analizi:
# Servis ne zaman yeniden başlatıldı (restart memory leak göstergesi):
journalctl -u nb-api --no-pager | grep "Started\|Starting" | tail -20
journalctl -u nb-pdf-api --no-pager | grep "Started\|Starting" | tail -20

# Kaç kez restart olmuş:
journalctl -u nb-api --no-pager | grep "Started nb" | wc -l
# Bir ayda 5'ten fazla restart varsa memory leak veya crash döngüsü var
```

---

### 3. Kullanıcı Büyüme ve Churn Analizi

> **Churn nedir?** Aboneliğini iptal eden veya ödeme yapmayan kullanıcı oranı. SaaS'ın sağlığının en önemli göstergesi.

```bash
npx prisma db execute --stdin <<'SQL'
-- Bu ay kayıt olan ve doğrulayan kullanıcılar:
SELECT 
  COUNT(*) as toplam_kayit,
  COUNT(CASE WHEN is_verified THEN 1 END) as dogrulanan,
  COUNT(CASE WHEN plan != 'FREE' THEN 1 END) as odeme_yapan
FROM users
WHERE created_at >= DATE_TRUNC('month', NOW());

-- Bu ay aboneliği biten kullanıcılar:
SELECT COUNT(*) as abonelik_biten
FROM users
WHERE subscription_expiry BETWEEN DATE_TRUNC('month', NOW()) 
  AND DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  AND plan = 'FREE';  -- plan FREE'ye düşmüş = ödeme yapmamış

-- İade istekleri bu ay:
SELECT COUNT(*) as iade_sayisi
FROM payment_checkouts
WHERE status = 'refunded'
  AND refunded_at >= DATE_TRUNC('month', NOW());
SQL
```

---

### 4. PDF İşlem Başarı/Başarısız Oranı

```bash
# Bu ayın PDF işlem istatistikleri:
grep "pdf_api_incoming" /var/log/nb-pdf-platform/pdf-api.log | \
  grep $(date +%Y-%m) | wc -l  # Toplam işlem

grep -E "status_code.*[45][0-9][0-9]" /var/log/nb-pdf-platform/pdf-api.log | \
  grep $(date +%Y-%m) | wc -l  # Başarısız işlem

# Hangi araç en çok kullanılıyor:
grep "pdf_api_incoming POST /api/" /var/log/nb-pdf-platform/pdf-api.log | \
  grep $(date +%Y-%m) | \
  sed 's/.*POST \(\/api\/[^"?]*\).*/\1/' | \
  sort | uniq -c | sort -rn | head -10

# En çok hata veren araç:
grep -E "ERROR.*tool_route" /var/log/nb-pdf-platform/pdf-api.log | \
  grep $(date +%Y-%m) | \
  sed 's/.*\(\/api\/[^ ]*\).*/\1/' | \
  sort | uniq -c | sort -rn | head -10
```

---

### 5. Güvenlik Sertleştirme İncelemesi

> **Hardening (sertleştirme) nedir?** Sistemi saldırılara karşı daha dirençli hale getirme işlemi. Saldırı yüzeyini azaltmak.

```bash
# Açık portlar — sadece gereken portlar açık olmalı:
ss -tlnp
# Beklenen: 22 (SSH), 80, 443 (web), 5432 (PostgreSQL, sadece localhost)
# 4000 ve 8000 portları dışarıya açık OLMAMALI (nginx proxy arkasında olmalı)

# Güvenlik duvarı kuralları:
sudo ufw status verbose

# Son ayda başarısız SSH giriş denemeleri:
grep "Failed password\|Invalid user" /var/log/auth.log | \
  grep $(date +%Y-%m) | wc -l

# Root ile SSH giriş denemeleri:
grep "Invalid user root\|Failed password for root" /var/log/auth.log | \
  grep $(date +%Y-%m) | wc -l
```

**Kontrol soruları:**
```
[ ] Tüm admin işlemleri audit log'da görünüyor mu?
[ ] Beklenmedik admin hesabı var mı? (sadece sen olmalısın)
[ ] API key'ler (iyzico, SMTP) rotasyona ihtiyaç var mı? (6 ayda bir önerilir)
[ ] JWT secret'lar en az 64 karakter mi?
[ ] .env dosyası git'e commit edilmemiş mi? (git log kontrolü)
```

```bash
# .env'nin git'e commit edilip edilmediğini kontrol:
git log --all --full-history -- "**/.env" -- "*.env"
# Hiçbir şey çıkmamalı
```

---

### 6. Log Temizleme

```bash
# 90 günden eski sıkıştırılmış logları sil:
find /var/log/nb-pdf-platform/ -name "*.log.gz" -mtime +90 -delete

# Boyut kontrolü:
du -sh /var/log/nb-pdf-platform/
ls -lhrt /var/log/nb-pdf-platform/ | tail -10
```

---

### 7. Depolama Temizleme

```bash
# TTL süresi dolmuş result store dosyaları:
find /path/to/nb-result-store/ -mindepth 1 -maxdepth 1 -type d | while read dir; do
  meta="$dir/meta.json"
  if [ -f "$meta" ]; then
    created=$(python3 -c "import json; d=json.load(open('$meta')); print(d.get('created_at', 0))")
    now=$(date +%s)
    age=$((now - created))
    if [ $age -gt 3600 ]; then  # 1 saatten eski
      echo "Eski: $dir (${age}s)"
    fi
  fi
done

# 2 saatten eski geçici PDF dosyaları:
find /tmp -name "nbpdf-*" -mmin +120 -exec rm -rf {} + 2>/dev/null
echo "Temizlik tamamlandı"
```

---

### 8. Veritabanı Bakımı

> **VACUUM nedir?** PostgreSQL'in "süpürme" işlemi. Silinen verilerin bıraktığı boşlukları temizler. Düzenli yapılmazsa veritabanı şişer ve yavaşlar.

```bash
# PostgreSQL VACUUM (bakım):
psql -U postgres -d your_db_name -c "VACUUM ANALYZE;"

# En büyük tablolar:
psql -U postgres -d your_db_name -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as boyut
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;"

# İndeks sağlığı:
psql -U postgres -d your_db_name -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;"
```

---

### 9. Felaket Kurtarma Testi (Disaster Recovery Drill)

> **DR Test nedir?** Gerçek kriz olmadan kurtarma prosedürlerini prova etmek. Tıpkı yangın tatbikatı gibi. Bu olmadan, gerçek kriz anında prosedür bozuk çıkabilir.

**Bu ay için basit test:**

```bash
# 1. Test veritabanı oluştur:
createdb -U postgres test_restore_$(date +%Y%m%d)

# 2. Son yedeği bu veritabanına geri yükle:
gunzip -c /var/backups/nb-pdf-platform/db-$(date +%Y-%m-%d).sql.gz | \
  psql -U postgres -d test_restore_$(date +%Y%m%d)

# 3. Kritik tablo sayısını kontrol et:
psql -U postgres -d test_restore_$(date +%Y%m%d) -c "
SELECT 
  (SELECT COUNT(*) FROM users) as kullanici_sayisi,
  (SELECT COUNT(*) FROM payment_checkouts) as odeme_sayisi,
  (SELECT COUNT(*) FROM refresh_tokens) as token_sayisi;"

# 4. Test veritabanını sil:
dropdb -U postgres test_restore_$(date +%Y%m%d)
echo "DR testi başarılı"
```

---

### 10. Bağımlılık Major Güncelleme Planlaması

```bash
# Outdated paketler:
cd web/api && npm outdated
cd web/frontend && npm outdated

# Python paketleri:
cd web/backend && pip list --outdated
```

**Kural:**
- Patch ve minor (x.y.Z, x.Y.z) → Bu ay güncelle
- Major (X.y.z → Y.y.z) → Test branch'inde dene, bir sonraki ay deploy et

---

## 📊 Aylık Sağlık Skoru

Her ay bu soruları cevapla (1-5 arası puan):

| Kriter | Puan | Notlar |
|--------|------|--------|
| Site uptime | /5 | UptimeRobot'tan al |
| Ortalama yanıt süresi | /5 | < 500ms = 5 puan |
| Hata oranı | /5 | < %1 = 5 puan |
| Disk kullanımı | /5 | < %70 = 5 puan |
| Güvenlik açıkları | /5 | 0 = 5 puan |
| Yedek başarısı | /5 | Restore test geçti mi? |
| **Toplam** | **/30** | |

> 25+ puan → Üretim sağlıklı
> 20-25 → İzlemede tut, önlem al
> 20 altı → Acil müdahale gerekiyor
