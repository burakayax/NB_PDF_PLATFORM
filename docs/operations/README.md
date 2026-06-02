# PDF PLATFORM — Prodüksiyon Operasyonel El Kitabı

> **Bu belge kimler içindir:** Teknik geçmişi olmayan ya da az olan, AI destekli geliştirme yapan solo kurucular için yazılmıştır. Saat 3'te sistem çöktüğünde ne yapacağını bilesin diye tasarlandı.

---

## Klasör Yapısı

```
docs/
├── operations/           ← Günlük/haftalık/aylık operasyonlar
│   ├── README.md         ← Bu dosya (ana indeks)
│   ├── 01-daily.md       ← Her gün yapılacaklar
│   ├── 02-weekly.md      ← Her hafta yapılacaklar
│   ├── 03-monthly.md     ← Her ay yapılacaklar
│   └── 04-yearly.md      ← Her yıl yapılacaklar
│
├── runbooks/             ← Kriz anında adım adım çözüm rehberleri
│   ├── README.md         ← Runbook indeksi
│   ├── RB-01-site-down.md
│   ├── RB-02-api-down.md
│   ├── RB-03-pdf-stuck.md
│   ├── RB-04-memory-leak.md
│   ├── RB-05-cpu-spike.md
│   ├── RB-06-disk-full.md
│   ├── RB-07-payment-failure.md
│   ├── RB-08-ssl-expired.md
│   ├── RB-09-ddos.md
│   ├── RB-10-worker-freeze.md
│   └── RB-11-deployment-broken.md
│
├── deployment/           ← Deploy nasıl yapılır, rollback nasıl yapılır
│   ├── deployment-guide.md
│   ├── environment-variables.md
│   └── secrets-management.md
│
├── monitoring/           ← Ne izlenir, hangi eşikler tehlikeli
│   ├── monitoring-guide.md
│   └── alerting-thresholds.md
│
├── security/             ← Güvenlik operasyonları
│   ├── security-operations.md
│   └── secret-rotation.md
│
├── backup/               ← Yedekleme ve kurtarma
│   └── backup-recovery.md
│
└── solo-founder/         ← Solo kurucu için gerçekçi rehberler
    ├── mvp-reality.md
    ├── launch-checklist.md
    ├── first-1000-users.md
    ├── top-20-breaks.md
    ├── when-to-rewrite.md
    └── operations-roadmap.md
```

---

## 🚨 ACİL DURUM — Saat 3'te Site Çöktü

Panik yapma. Şu sırayla kontrol et:

```
1. Site tamamen mi erişilemez?     → docs/runbooks/RB-01-site-down.md
2. Sadece API mi çalışmıyor?       → docs/runbooks/RB-02-api-down.md
3. PDF işlemleri mi takılı?        → docs/runbooks/RB-03-pdf-stuck.md
4. Disk mi doldu?                  → docs/runbooks/RB-06-disk-full.md
5. Ödeme sistemi mi çalışmıyor?    → docs/runbooks/RB-07-payment-failure.md
6. Yeni deploy'dan sonra mı kırdı? → docs/runbooks/RB-11-deployment-broken.md
```

---

## Servisler Hakkında Kısa Hatırlatma

| Servis | Teknoloji | Port | Görev |
|--------|-----------|------|-------|
| Frontend | React + Vite | 5173 (dev) / 80-443 (prod) | Kullanıcı arayüzü |
| Auth API | Express + Node.js | 4000 | JWT, ödeme, abonelik |
| PDF API | FastAPI + Python | 8000 | PDF işlemleri |
| Database | PostgreSQL (prod) / SQLite (dev) | 5432 | Kullanıcı verileri |
| Result Store | Disk (geçici) | — | İşlenmiş PDF'ler (30 dk TTL) |

---

## Bu Belgeleri Güncel Tutmak

Her büyük değişiklikten sonra (yeni özellik, yeni servis, yeni sunucu) ilgili belgeyi güncelle.
Belgelerin tarihi bilgi olması, hiç belge olmamasından daha tehlikelidir.
