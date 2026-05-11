# İlk 1000 Kullanıcı Hayatta Kalma Rehberi

> **Gerçek:** İlk 1000 kullanıcı en zorlu dönemdir. Ürün ham, altyapı test edilmemiş, sen yorgunsun. Bu rehber o dönemi hayatta geçirmeni sağlar.

---

## 🎯 Genel Strateji: Faz Bazlı Düşün

```
0–10 kullanıcı    → El ile takip et. Her birini tanı. Her şikayeti dinle.
10–100 kullanıcı  → Tekrarlayan sorunları tespit et. Kritik eksikleri kapat.
100–500 kullanıcı → Ölçekleme sorunları başlar. Altyapıyı güçlendir.
500–1000 kullanıcı→ Otomasyona geç. Kendin her şeyi yapamazsın.
```

---

## 👥 0–10 Kullanıcı: Manuel Büyüme Dönemi

### Ne Yapmalısın?

**Her kullanıcıyla bizzat ilgilen:**
- Kayıt olan herkese 24 saat içinde e-posta gönder (elle bile olsa)
- "Nasıl buldunuz?" diye sor
- İlk PDF işlemlerini loglardan takip et — hata var mı?

**Logları manuel izle:**
```bash
# Yeni kayıt olanlar:
grep "user_registered" /var/log/nb-pdf-platform/api.log | tail -20

# PDF işleme başarı/hata:
grep "pdf_processed\|pdf_failed" /var/log/nb-pdf-platform/api.log | tail -20
```

**Kritik sorular:**
- İlk PDF işlediklerinde sorun yaşadılar mı?
- Ödeme yapmaya çalışıp vazgeçtiler mi?
- Hangi araçları en çok kullandılar?

### Altyapı Kontrolleri (10 kullanıcıda)

```
[ ] Günlük disk büyümesi nedir? (normal mi?)
[ ] PDF işleme ortalama süresi nedir?
[ ] Herhangi bir 5xx hatası var mı?
[ ] Email doğrulama sorunsuz çalışıyor mu?
```

---

## 🚀 10–100 Kullanıcı: Sorun Tespiti Dönemi

### Sık Karşılaşılan Sorunlar ve Çözümleri

**Sorun 1: Kullanıcılar kaydoluyor ama ödeme yapmıyor**
```
→ Fiyat yüksek mi? Plan avantajları net değil mi?
→ İyzico ödeme ekranı güven vermiyor mu?
→ Çözüm: Free plan limitleri netti mi kontrol et. Pricing sayfasını iyileştir.
```

**Sorun 2: "PDF işlenmedi" şikayetleri**
```
→ Hangi dosya formatları sorun çıkarıyor?
→ Corrupt/şifreli PDF denemeleri var mı?
→ Loglardan hata türlerini analiz et:
```
```bash
grep "pdf_error" /var/log/nb-pdf-platform/api.log | \
  python3 -c "
import sys, json
from collections import Counter
errors = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        errors.append(d.get('error_type', 'unknown'))
    except: pass
for e, c in Counter(errors).most_common(): print(f'{c:4d}x {e}')
"
```

**Sorun 3: Email doğrulama e-postası gelmiyor**
```
→ Spam klasörüne düşüyor olabilir
→ Gmail günlük limitine takıldın mı?
→ Çözüm: Transactional email servise geç (Resend ücretsiz 3000/ay)
```

### 50 Kullanıcıda Mutlaka Yap

```bash
# Disk büyüme trend analizi:
du -sh /tmp/nbpdf-* 2>/dev/null | head -20
df -h /

# En çok kullanılan araçlar:
grep "tool_used" /var/log/nb-pdf-platform/api.log | \
  grep "$(date +%Y-%m)" | \
  python3 -c "
import sys, json
from collections import Counter
tools = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        tools.append(d.get('tool', 'unknown'))
    except: pass
for t, c in Counter(tools).most_common(): print(f'{c:4d}x {t}')
"
```

---

## ⚡ 100–500 Kullanıcı: Ölçekleme Sorunları

Bu aşamada altyapı sorunları görünür hale gelir.

### Muhtemel Bottleneck'ler

**1. Thread Pool Doygunluğu**
```bash
# Sıraya giren PDF işlemleri:
grep "queue_wait_ms" /var/log/nb-pdf-platform/api.log | \
  awk -F'"queue_wait_ms":' '{print $2}' | awk '{print $1}' | \
  sort -n | tail -20
# 5000ms+ görüyorsan thread pool sorunu var
```

Çözüm: `PDF_CPU_MAX_IN_FLIGHT` artır (sunucu RAM'ine göre).

**2. PostgreSQL Yavaşlama**
```sql
-- Yavaş sorgular:
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Çözüm: İndeks ekle. En sık yapılan sorguları `EXPLAIN ANALYZE` ile incele.

**3. Bellek Büyümesi**
```bash
# Node.js process memory trend (her saat logla):
0 * * * * ps aux | grep "node.*dist" | awk '{print $6}' >> /var/log/nb-pdf-platform/node-mem.log
```

### 100 Kullanıcıda Yapman Gerekenler

```
[ ] Otomatik yedekleme çalışıyor ve test edildi
[ ] UptimeRobot kuruldu
[ ] Telegram alarmı kuruldu
[ ] Logrotate kuruldu
[ ] Netdata veya benzeri sunucu monitoring
[ ] npm audit ve pip-audit temiz
```

---

## 🏗️ 500–1000 Kullanıcı: Otomasyon Dönemi

500+ kullanıcıyla artık her şeyi elle yapamazsın.

### Otomasyon Öncelikleri

**1. Günlük Rapor E-postası**
```bash
#!/bin/bash
# /usr/local/bin/nb-daily-report.sh
# Cron: 0 8 * * * /usr/local/bin/nb-daily-report.sh

DATE=$(date -d "yesterday" +%Y-%m-%d)
LOG="/var/log/nb-pdf-platform/api.log"

REPORT="📊 $DATE Günlük Rapor

Yeni kayıtlar: $(grep "$DATE" $LOG | grep 'user_registered' | wc -l)
PDF işlemleri: $(grep "$DATE" $LOG | grep 'pdf_processed' | wc -l)
Başarılı ödemeler: $(grep "$DATE" $LOG | grep 'subscription_updated' | wc -l)
5xx hatalar: $(grep "$DATE" $LOG | grep '"status":5' | wc -l)
Disk kullanımı: $(df -h / | tail -1 | awk '{print $5}')"

echo "$REPORT" | mail -s "NB PDF - Günlük Rapor" nbglobalstudio@gmail.com
```

**2. Otomatik Kullanıcı Yardımı**
- Kayıt olduktan 48 saat sonra PDF işlemediyse → Otomatik e-posta: "Yardım lazım mı?"
- FREE plan limitine takıldıysa → Otomatik e-posta: "PRO'ya geç, %20 indirim"

**3. Şüpheli Aktivite Alarmı**
```bash
# Tek kullanıcı çok fazla işlem yapıyorsa (abuse kontrolü):
grep "$(date +%Y-%m-%d)" /var/log/nb-pdf-platform/api.log | \
  grep 'pdf_processed' | \
  python3 -c "
import sys, json
from collections import Counter
users = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        users.append(d.get('user_id', '?'))
    except: pass
for u, c in Counter(users).most_common(5):
    if c > 100:
        print(f'UYARI: {u} bugün {c} işlem yaptı')
"
```

### Kapasite Planlama

```
Sunucu şimdiki kapasitesini tahmin et:
- 1 vCPU → ~50 eşzamanlı kullanıcı
- 2 vCPU → ~150 eşzamanlı kullanıcı
- 4 vCPU → ~400 eşzamanlı kullanıcı

PDF işleme CPU-yoğun. 500 aktif kullanıcıda en az 2 vCPU şart.

Bellek tahmini:
- Node.js: ~200-400MB
- Python (FastAPI): ~100-200MB
- PostgreSQL: ~200-500MB (kullanıma göre)
- İşletim sistemi: ~200MB
Toplam: 1GB+ RAM gerekli. 2GB önerilir.
```

---

## 💰 Gelir ve Sürdürülebilirlik

### Kritik Metrikler (1000 kullanıcıda)

```
MRR (Aylık Tekrar Eden Gelir):
  Kaç kullanıcı PRO? × PRO fiyatı
  Kaç kullanıcı BUSINESS? × BUSINESS fiyatı

Churn oranı:
  (Ay başı abonelik - Ay sonu abonelik) / Ay başı abonelik × 100
  %5 altı iyi, %10 üzeri sorunlu

CAC (Kullanıcı Edinme Maliyeti):
  Reklam harcaması / Yeni ödeme yapan kullanıcı sayısı
  Şimdi muhtemelen 0₺ (organik) — bunu kaydet
```

**SQL ile izle:**
```sql
-- Aylık gelir tahmini:
SELECT 
  DATE_TRUNC('month', created_at) as ay,
  plan,
  COUNT(*) as kullanici_sayisi
FROM users
WHERE plan != 'FREE'
GROUP BY ay, plan
ORDER BY ay DESC;
```

---

## 🧠 Öğrenmeler

### Ne İzlemeye Değer?

**İzle:**
- Hangi araç en çok kullanılıyor? (Bunlara yatırım yap)
- Nerede kullanıcı kaybediyorsun? (Kayıt? Ödeme? İlk kullanım?)
- Hangi hatayla en çok karşılaşıyorlar?

**İzleme:**
```bash
# Kayıt → Ödeme dönüşümü:
npx prisma db execute --stdin <<'SQL'
SELECT 
  DATE_TRUNC('week', created_at) as hafta,
  COUNT(*) as toplam_kayit,
  COUNT(CASE WHEN plan != 'FREE' THEN 1 END) as odeme_yapan,
  ROUND(COUNT(CASE WHEN plan != 'FREE' THEN 1 END)::numeric / COUNT(*) * 100, 1) as donusum_orani
FROM users
GROUP BY hafta
ORDER BY hafta DESC
LIMIT 12;
SQL
```

### Ne Zaman Ek Özellik Ekleme?

**Ekleme zamanı:**
- 3+ kullanıcı aynı özelliği istedi
- Mevcut özelliğin kullanım oranı %80+
- Teknik borç birikmemişse

**Ekleme zamanı değil:**
- Altyapı sorunları varken
- Hiç kimse sormadı ama "harika olur" diye düşünüyorsun
- Mevcut kullanıcılar memnunsa ve churn düşükse

---

## 🆘 1000. Kullanıcıda Sana İzin Ver

1000. kullanıcıya ulaştığında şunları yapabilirsin:

```
✅ İlk müşterinin ödediğini gördün → Fiyatlandırma çalışıyor
✅ 3+ ay hayatta kaldın → Altyapı yeterince sağlam
✅ En az 1 kullanıcı şikayeti çözdün → Destek sistemi var

Artık:
→ Fiyatlandırmayı ayarlamayı düşünebilirsin
→ Yeni araç eklemek için zaman bulabilirsin
→ Reklam denemeleri yapabilirsin
→ Başka kanalları araştırabilirsin
```

> **Hatırla:** 1000 kullanıcı büyük bir rakam değil — ama kendi ürününle ödeme alan ilk 1000 kişi. Bu başarının kendisi.
