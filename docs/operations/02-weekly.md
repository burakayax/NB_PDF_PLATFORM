# Haftalık Operasyonlar

> **Ne zaman:** Her Pazartesi sabahı, yaklaşık 30-45 dakika.
> **Neden:** Haftalık kontrol trendleri görmeyi sağlar. Tek günlük veri yanıltıcı olabilir.

> 💻 **Platform Notu:**
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda
> `npm`, `pip`, `git`, `npx` komutları her iki platformda aynı çalışır.

---

## 📋 Haftalık Kontrol Listesi

### 1. Bağımlılık Güvenlik Taraması (Yerel Makineden — Her İki Platformda Aynı)

> **Bağımlılık (dependency) nedir?** Projenizin kullandığı başka kütüphaneler. Zaman zaman güvenlik açıkları bulunur.

```bash
# 🍎 Mac / Linux ve 🪟 Windows (PowerShell) — AYNI KOMUTLAR:

# Node.js API:
cd web/api
npm audit
npm audit fix --only=prod   # sadece kritik/yüksek olanları düzelt

# Python:
cd web/backend

# 🍎 Mac / Linux — venv aktive et:
source ../.venv/bin/activate
pip-audit --requirement requirements.txt

# 🪟 Windows (PowerShell) — venv aktive et:
# ..\.venv\Scripts\Activate.ps1
# pip-audit --requirement requirements.txt

# Frontend:
cd web/frontend
npm audit
```

**Ne yapmalısın?**
- `critical` → Aynı gün düzelt
- `high` → Bu hafta içinde düzelt
- `moderate` → Önümüzdeki haftaya planla
- `low` → Aylık güncelleme döngüsüne ekle

---

### 2. Hata Trendleri Analizi (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda:

# Bu hafta günlük hata sayıları (Linux - date -d çalışır):
for day in $(seq 6 -1 0); do
  date_str=$(date -d "$day days ago" +%Y-%m-%d)
  count=$(grep '"level":"error"' /var/log/nb-pdf-platform/api.log | grep "$date_str" | wc -l)
  echo "$date_str: $count hata"
done

# Bu hafta en çok hata veren endpoint'ler:
grep '"level":"error"' /var/log/nb-pdf-platform/api.log | \
  python3 -c "
import sys, json
from collections import Counter
paths = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        paths.append(d.get('path', 'unknown'))
    except: pass
for path, count in Counter(paths).most_common(10):
    print(f'{count:5d}  {path}')
"
```

> **Yerel makinende** hata trendini görmek istersen veritabanı sorgusunu kullan (her iki platformda npx çalışır):

```bash
# 🍎 Mac / Linux ve 🪟 Windows:
npx prisma db execute --stdin <<'SQL'
SELECT DATE(created_at) as gun, COUNT(*) as hata_sayisi
FROM payment_events
WHERE event_type LIKE '%failed%' OR event_type LIKE '%error%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY gun
ORDER BY gun DESC;
SQL
```

---

### 3. Ödeme Mutabakatı (Her İki Platformda — npx ile)

> **Mutabakat nedir?** Sistemindeki kayıtlarla gerçek ödeme sağlayıcısı kayıtlarının eşleşip eşleşmediğini kontrol etmek.

```bash
# 🍎 Mac / Linux ve 🪟 Windows — npx her iki platformda çalışır:

# Bu hafta tamamlanan ödemeler:
npx prisma db execute --stdin <<'SQL'
SELECT 
  DATE(completed_at) as gun,
  plan,
  COUNT(*) as adet,
  SUM(amount_paid) as toplam_tl
FROM payment_checkouts
WHERE status = 'COMPLETED'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY gun, plan
ORDER BY gun DESC, plan;
SQL

# 2+ saatdir PENDING olan ödemeler (sorunlu olabilir):
npx prisma db execute --stdin <<'SQL'
SELECT 
  conversation_id,
  user_id,
  plan,
  amount_expected,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as saat_gecti
FROM payment_checkouts
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '2 hours'
ORDER BY created_at;
SQL
```

**iyzico panel ile karşılaştır:**
```
iyzico merchant panel → Raporlar → İşlem Listesi → Bu hafta filtrele
Başarılı işlem sayısı = Bizim COMPLETED sayımız olmalı
Farklıysa → RB-12 veya RB-14 runbook'unu incele
```

---

### 4. Disk Büyüme Trendi (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda:
df -h
du -sh /var/log/nb-pdf-platform/
du -sh /var/lib/postgresql/
du -sh /tmp/nbpdf-* 2>/dev/null || echo "Geçici dosya yok"

# Bir hafta içinde log büyümesi (yaklaşık):
ls -lh /var/log/nb-pdf-platform/*.log
```

**Alarm eşiği:** Disk %75 üzerindeyse temizlik planla. %85 üzerindeyse hemen müdahale et.

---

### 5. Performans Trend Analizi (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda:

# Node.js ortalama response süresi (log'dan):
grep "$(date -d '1 week ago' +%Y-%m-%d)" /var/log/nb-pdf-platform/api.log | \
  grep -o '"duration_ms":[0-9]*' | \
  awk -F: '{sum+=$2; count++} END {printf "Ortalama: %.0f ms\n", sum/count}'

# En yavaş endpoint'ler:
grep '"duration_ms"' /var/log/nb-pdf-platform/api.log | \
  grep "$(date +%Y-%m)" | \
  python3 -c "
import sys, json
from collections import defaultdict
times = defaultdict(list)
for line in sys.stdin:
    try:
        d = json.loads(line)
        if 'duration_ms' in d and 'path' in d:
            times[d['path']].append(d['duration_ms'])
    except: pass
for path, ms in sorted(times.items(), key=lambda x: -sum(x)/len(x))[:10]:
    print(f'{sum(ms)/len(ms):7.0f}ms ortalama  {path}')
"
```

---

### 6. Kullanıcı ve Abonelik Durumu (Her İki Platformda — npx ile)

```bash
# 🍎 Mac / Linux ve 🪟 Windows:
npx prisma db execute --stdin <<'SQL'
SELECT 
  plan,
  COUNT(*) as kullanici_sayisi,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as bu_hafta_yeni
FROM users
GROUP BY plan
ORDER BY kullanici_sayisi DESC;
SQL
```

---

### 7. Yedek Doğrulama (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda:

# Son yedek ne zaman alındı?
ls -lht /var/backups/nb-pdf-platform/ | head -5

# Yedek boyutu mantıklı mı? (çok küçükse sorun var)
ls -lh /var/backups/nb-pdf-platform/ | tail -3

# Cron çalışıyor mu?
grep "nb-backup-db" /var/log/nb-pdf-platform/backup.log | tail -5
```

---

### 8. Güvenlik Log Analizi (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda:

# Bu hafta iyzico imza hataları:
grep "iyzico_signature_mismatch" /var/log/nb-pdf-platform/api.log | wc -l

# Bu hafta rate limit aşımları:
grep "rate_limit_exceeded\|429" /var/log/nb-pdf-platform/api.log | wc -l

# Bu hafta admin paneline yetkisiz erişim:
grep '"status":403' /var/log/nb-pdf-platform/api.log | \
  grep '/api/admin' | wc -l
```

---

### 9. Güvenli Bağımlılık Güncelleme Ritüeli (Yerel Makineden — Her İki Platformda)

```bash
# 🍎 Mac / Linux ve 🪟 Windows — AYNI KOMUTLAR:

# 1. Güncel branch'ten başla:
git pull origin master

# 2. Mevcut durumu kaydet:
git stash

# 3. Sadece patch güncellemeleri yap (X.Y.Z → X.Y.Z+1):
cd web/api && npm update --save

# 4. Test et:
npm run build  # TypeScript hata yok mu?

# 5. Commit et:
git add package-lock.json package.json
git commit -m "chore: weekly dependency updates"
```
