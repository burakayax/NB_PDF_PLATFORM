# RB-03 — PDF İşleme Takılı / Timeout

> **Kritiklik:** 🟠 YÜKSEK — Kullanıcılar PDF işleyemiyor
> **Tipik çözüm süresi:** 10-30 dakika

---

## 🔍 Belirtiler

- Kullanıcılar "İşleniyor..." ekranında takılı kalıyor
- PDF yükleniyor ama sonuç hiç gelmiyor
- HTTP 503 yanıtları alınıyor ("Sunucu şu an yoğun")
- API loglarında `pdf_cpu_pool saturated` görünüyor
- Uygulama yavaş yanıt veriyor

---

## ✅ Adım 1: PDF API'nin Durumunu Kontrol Et

```bash
# FastAPI servisi çalışıyor mu?
systemctl status nb-pdf-api

# Loglarına bak:
journalctl -u nb-pdf-api -n 100 --no-pager | grep -E "ERROR|WARNING|timeout|saturated"

# Aktif PDF işlemleri kaç tane var?
# Bu endpoint thread pool durumunu döner (varsa):
curl http://localhost:8000/api/pdf/stats 2>/dev/null || echo "Stats endpoint yok"
```

---

## ✅ Adım 2: Thread Pool Doygunluğunu Kontrol Et

> **Thread pool (iş parçacığı havuzu) nedir?** PDF işleme çok işlemci gücü gerektirir. Thread pool, aynı anda kaç PDF işleneceğini sınırlar. Dolunca yeni istekler sıraya girer veya reddedilir.

```bash
# Log'da thread pool doygunluğu var mı?
grep "pdf_cpu_pool saturated\|pdf_operation_timeout" \
  /var/log/nb-pdf-platform/pdf-api.log | tail -20

# Hangi PDF işlemleri sıraya girmiş (503 dönüyor mu):
grep "server_busy\|retry_after" /var/log/nb-pdf-platform/pdf-api.log | tail -20

# CPU kullanımı ne?
top -bn1 | grep -E "Cpu|uvicorn|python"
```

---

## ✅ Adım 3: Geçici Dosyaları Kontrol Et

```bash
# Çok fazla geçici PDF dosyası var mı?
ls /tmp/nbpdf-* 2>/dev/null | wc -l

# Bu dosyalar ne zaman oluşturuldu?
find /tmp -name "nbpdf-*" -type d -printf "%T@ %p\n" | \
  sort -n | awk '{print strftime("%Y-%m-%d %H:%M", $1), $2}' | tail -10

# Disk dolu mu? (PDF işleme disk yazar)
df -h | grep -v tmpfs
```

---

## 🛠️ ACİL FİX: PDF Servisini Yeniden Başlat

**Bu kullanıcıları kısa süre keser ama tüm takılı işlemleri temizler:**

```bash
# Önce kaydet: şu an kaç aktif bağlantı var
ss -s

# PDF servisini yeniden başlat:
sudo systemctl restart nb-pdf-api

# 10 saniye bekle, sonra kontrol:
sleep 10
systemctl status nb-pdf-api

# Test et:
curl -s http://localhost:8000/ | python3 -m json.tool
```

---

## ✅ Adım 4: Takılı Geçici Dosyaları Temizle

```bash
# 30 dakikadan eski geçici PDF işlem dosyalarını sil:
find /tmp -name "nbpdf-*" -mmin +30 -exec rm -rf {} + 2>/dev/null
echo "Temizlendi: $(find /tmp -name "nbpdf-*" | wc -l) dosya kaldı"

# Result store'da eski sonuçlar var mı?
find /path/to/nb-result-store/ -mindepth 1 -maxdepth 1 -type d -mmin +60 | wc -l
# Eğer çoksa TTL sweeper çalışmıyor demektir
```

---

## ✅ Adım 5: Sonsuz Döngüde PDF Var mı?

Bazı zararlı veya bozuk PDF'ler işlemeyi sonsuz döngüye sokabilir:

```bash
# Uzun süredir çalışan Python process'leri:
ps aux --sort=-%cpu | grep uvicorn | head -5

# Tek bir process %100 CPU kullanıyorsa:
top -bn1 -p <PID>

# Eğer 2 dakikadan uzun süredir %100 CPU kullanan process varsa:
# Bu muhtemelen sonsuz döngüde takılı bir PDF işlemi
kill -9 <PID>  # Sadece takılı olan uvicorn worker'ı öldür
# Diğer worker'lar devam eder
```

---

## 🛠️ Kalıcı Önlem: Timeout Ayarı

`web/backend/.env` dosyasına ekle:

```bash
# Her PDF işleminin maksimum süresi (saniye):
PDF_OPERATION_TIMEOUT_SEC=120

# Thread pool boyutu — sunucuna göre ayarla:
# 2 CPU → PDF_CPU_MAX_IN_FLIGHT=4
# 4 CPU → PDF_CPU_MAX_IN_FLIGHT=8
PDF_CPU_MAX_IN_FLIGHT=8

# Kuyrukta bekleme süresi üst sınırı:
PDF_CPU_QUEUE_WAIT_SEC=30
```

---

## ✅ Doğrulama

```bash
# Basit PDF işlemi test et:
# 1. Siteye git → küçük bir PDF yükle → işlenmesi beklenen süre test et
# 2. 30 saniyeden kısa sürmeli
# 3. Hata vermeden indirilmeli

# Logda başarılı işlem görüyor musun?
tail -f /var/log/nb-pdf-platform/pdf-api.log | grep "pdf_api_incoming"
```

---

## 📝 Postmortem Soruları

```
Kaç kullanıcı etkilendi?
Ne kadar süre çalışmadı?
Hangi PDF boyutu/türü soruna neden oldu?
Timeout değeri yeterince düşük müydü?
Thread pool boyutu yeterli miydi?
```

---

## 🔮 Olası Kök Nedenler

| Neden | Belirti | Çözüm |
|-------|---------|-------|
| Bozuk PDF (infinite loop) | Tek worker %100 CPU | O worker'ı kill et |
| Thread pool dolu | "503 server busy" | Sayıyı artır veya restart |
| Disk dolu | İşlem hata veriyor | Disk temizle |
| Bellek tükendi | OOM killer çalıştı | RAM artır veya swap ekle |
| Ağ zaman aşımı | İstekler gelmiyor | Nginx timeout ayarla |
