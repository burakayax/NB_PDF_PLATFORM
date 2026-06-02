# 📁 docs Klasörü (Belgeler / Dokümantasyon Klasörü)

## Bu belge ne anlatıyor?

Bu belge, `docs` (belgeler) klasöründe **nerede ne olduğunu** ve **nereden
başlaman gerektiğini** anlatır. Karışıklık olmasın diye en başta okuman
gereken yerdir.

---

## 👉 Hiç teknik bilgin yoksa: BURADAN BAŞLA

Sıfır bilgiyle, adım adım, her teknik kelimenin Türkçe açıklamasıyla yazılmış
ana rehber serisi şurada:

### 📘 **`rehber/` klasörü (Başlangıç Rehberi Serisi)**

```
docs/rehber/
├── 00-BURADAN-BASLA.md   → Ana sayfa, genel bakış (ÖNCE BUNU OKU)
├── 01-YAYINA-ALMA.md     → Projeyi internete açma (Render.com)
├── 02-TEST-ETME.md       → Çalışıyor mu kontrol etme + Postman
├── 03-LOGLAR.md          → Hata kayıtlarını okuma
├── 04-VERITABANI.md      → Üye/ödeme deposunu yönetme (Prisma)
├── 05-GUNLUK-KONTROL.md  → Günlük/haftalık/aylık kontrol listeleri
└── 06-SIK-HATALAR.md     → En sık hatalar ve Türkçe çözümleri
```

> **İlk adımın:** `docs/rehber/00-BURADAN-BASLA.md` dosyasını aç ve oku.
> Geri kalan her şey oradan anlaşılır hale gelir.

---

## 📂 Diğer klasörler ne?

Aşağıdaki klasörler **ileri seviye / teknik referans** içindir. Hiç teknik
bilgin yoksa bunlara şimdilik bakmana **gerek yok** — `rehber/` klasörü
ihtiyacın olan her şeyi sade dille anlatıyor.

| Klasör | İçeriği (teknik referans) |
|--------|---------------------------|
| `audit/` | Güvenlik denetim notları |
| `backup/` | Yedekleme/kurtarma teknik detayları |
| `deployment/` | Eski sunucu (VPS) kurulum notları *(artık Render kullanılıyor)* |
| `legal/` | Yasal güvenlik notları |
| `monitoring/` | İzleme teknik detayları |
| `operations/` | Operasyon (günlük/haftalık/aylık) teknik notları |
| `payments/` | Ödeme sistemi teknik detayları (iyzico, fatura, iade) |
| `runbooks/` | "Şu bozulursa ne yapılır" teknik acil durum kartları |
| `security/` | Güvenlik operasyon notları |
| `solo-founder/` | Tek kişilik kurucu için strateji notları |
| `support/` | Müşteri destek akışları |

> Bu klasörlerin bir kısmı, proje **Render.com'a taşınmadan önce** (eski
> sunucu/Nginx dönemi) yazılmıştı. Güncel ve sade bilgi için her zaman
> `rehber/` klasörünü kullan.

---

## 📄 Proje ana klasöründeki önemli belgeler

`docs` dışında, projenin ana klasöründe de işine yarayacak belgeler var:

| Dosya | Ne işe yarar? |
|-------|---------------|
| `DEPLOYMENT.md` | Yayına alma + **tüm ortam değişkenleri (gizli ayarlar) listesi** |
| `README.md` | Projenin genel tanıtımı ve kurulum özeti |
| `SETUP.md` | İlk kurulum adımları |
| `CALISTIRMA.md` | Projeyi çalıştırma notları |

> **İpucu:** Render'da gizli ayarları (ortam değişkenleri) girerken
> `DEPLOYMENT.md` dosyasındaki tabloyu açık tut — hangi servise ne gireceğin
> orada yazılı.

---

## 🧭 Özet: Nereden başlamalıyım?

```
1. docs/rehber/00-BURADAN-BASLA.md   ← ŞİMDİ BUNU AÇ
2. Sonra sırayla 01, 02, 03... rehberlerini oku.
3. Bir sorun çıkarsa 06-SIK-HATALAR.md'ye bak.
```
