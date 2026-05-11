# Runbook İndeksi — Kriz Anında Ne Yaparsın?

> **Runbook nedir?** Belirli bir sorun için adım adım çözüm kılavuzu. Pilotların acil durum el kitabı gibi. Paniklemeden, sistematik olarak sorunu çözmenizi sağlar.

---

## 🚨 ACİL DURUM KARAR AĞACI

```
Site erişilemez mi?
├── Evet → RB-01-site-down.md
│
Sadece API hataları mı?
├── Evet → RB-02-api-down.md
│
PDF işlemleri takılı mı / timeout mu?
├── Evet → RB-03-pdf-stuck.md
│
Sunucu yavaş / yanıt vermiyor mu?
├── RAM sorunu şüphesi → RB-04-memory-leak.md
├── CPU %100 mü? → RB-05-cpu-spike.md
├── Disk doldu mu? → RB-06-disk-full.md
│
Ödeme sistemi çalışmıyor mu?
├── Evet → RB-07-payment-failure.md
│
"Bağlantı güvenli değil" hatası mı?
├── Evet → RB-08-ssl-expired.md
│
Çok fazla istek / yavaşlık mı?
├── Evet → RB-09-ddos.md
│
Worker/thread pool yanıt vermiyor mu?
├── Evet → RB-10-worker-freeze.md
│
Yeni deploy'dan sonra mı kırdı?
└── Evet → RB-11-deployment-broken.md
```

---

## 📋 Runbook Listesi

| Dosya | Senaryo | Kritiklik | Tipik Çözüm Süresi |
|-------|---------|-----------|---------------------|
| RB-01 | Site Tamamen Çöktü | 🔴 Kritik | 5-30 dakika |
| RB-02 | API Servisi Çalışmıyor | 🔴 Kritik | 5-20 dakika |
| RB-03 | PDF İşleme Takılı | 🟠 Yüksek | 10-30 dakika |
| RB-04 | Bellek Sızıntısı | 🟠 Yüksek | 5-60 dakika |
| RB-05 | CPU %100 | 🟠 Yüksek | 5-30 dakika |
| RB-06 | Disk Doldu | 🔴 Kritik | 5-15 dakika |
| RB-07 | Ödeme Sistemi Arızası | 🟠 Yüksek | 5-120 dakika |
| RB-08 | SSL Süresi Doldu | 🔴 Kritik | 5-30 dakika |
| RB-09 | DDoS / Aşırı Trafik | 🟠 Yüksek | 5-60 dakika |
| RB-10 | Worker/Thread Donmuş | 🟠 Yüksek | 5-10 dakika |
| RB-11 | Kötü Deployment | 🔴 Kritik | 2-10 dakika |

---

## 🛠️ Her Runbook'ta Standart Bölümler

1. **Belirtiler** — Nasıl anlarsın?
2. **Onaylama** — Gerçekten bu sorun mu?
3. **Acil Düzeltme** — Şimdi ne yaparsın? (kullanıcıları kurtarır)
4. **Kalıcı Çözüm** — Gerçek düzeltme nedir?
5. **Postmortem** — Bir daha olmaması için ne öğrendin?

---

## ⚡ Genel İlk Yardım Komutları

Hangi sorun olursa olsun önce bunları çalıştır:

```bash
# Tüm servislerin durumu:
systemctl status nb-api nb-pdf-api nginx postgresql

# Sistem kaynak kullanımı:
top -bn1 | head -20

# Disk doluluk:
df -h

# RAM kullanımı:
free -h

# Son 50 satır hata logu:
tail -50 /var/log/nb-pdf-platform/api.log | grep error

# Ağ bağlantıları:
ss -tlnp
```

---

## 📞 İletişim Şablonu

Kullanıcılara sosyal medyadan/e-postayla bildirim için:

```
[ACİL] Servis Kesintisi Bildirimi

Tarih: [BUGÜN]
Etkilenen servis: PDF PLATFORM
Sorun: [Kısa açıklama]
Başlangıç: [Saat]
Tahmini çözüm: [Süre]

Ekibimiz sorunu çözmek için çalışıyor.
Özür dileriz.

Güncelleme için: [status sayfası URL]
```
