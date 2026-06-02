# 📈 Canlıya Geçiş ve Ölçeklendirme (Ücretsizden Ücretliye)

## Bu belge ne anlatıyor?

Proje şu an **bakım/test dönemi** için **ücretsiz** ayarlarla çalışıyor.
Gerçek kullanıcı yükü gelmeye başladığında (siteyi tanıtınca, üye/ödeme
gelince) bazı ayarları **ücretli/güçlü** moda almalısın. Bu belge, "ne zaman,
neyi, nasıl değiştireceğini" sıfır bilgiyle adım adım anlatır.

> Bu dosya, projenin ücretsiz çalışacak şekilde ayarlandığı dönemde
> yapılan kısıtlamaların **geri alma talimatıdır**. Hangi ayarın neden
> kısıtlandığını ve büyürken nasıl açacağını burada bulursun.

---

## 🧭 Önce: Şu an ne durumdayız?

Proje 3 servisten oluşur. Ücretsiz dönemdeki durumları:

| Servis | Şu anki plan | Durum |
|--------|--------------|-------|
| **Frontend** (vitrin) | Ücretsiz (static site) | Sorun yok, hep ücretsiz kalabilir |
| **Auth API** (üyelik/ödeme) | `free` | 15 dk boşta kalınca uyur (~50 sn cold start) |
| **PDF API** (mutfak) | `free` + Docker | Uyur; ayrıca **yapay zeka OCR kapalı**, RAM düşük |

Ek olarak ücretsiz dönemde kısıtlanan şeyler:
- **PDF API yapay zeka OCR** (`docling` / `easyocr`) kapalı — torch+CUDA ~5 GB,
  ücretsiz RAM'e sığmaz.
- **PDF API worker sayısı 1** (`WEB_CONCURRENCY=1`) — düşük RAM için.
- **Veritabanı** dış ücretsiz sağlayıcıda (Neon vb.) olabilir — kalıcılık sınırlı.

---

## 🚦 Ne zaman ücretliye geçmeliyim?

Şu işaretlerden **biri** bile varsa geçiş zamanı gelmiştir:

```
[ ] Kullanıcılar "site açılırken bekliyorum / yavaş" diyor (cold start)
[ ] Düzenli üye girişi / ödeme almaya başladın (kesinti kabul edilemez)
[ ] PDF işlemleri "memory" / "killed" / 502 hatası veriyor (RAM yetmiyor)
[ ] Taranmış belge OCR'ı (yapay zeka) gibi gelişmiş özellikler lazım oldu
[ ] Veritabanının asla sıfırlanmaması kritik hale geldi
```

---

## 💳 Render plan rehberi (hangi servis hangi plana?)

| Plan | RAM | Aylık (yaklaşık) | Kime / neye? |
|------|-----|------------------|--------------|
| `free` | 512 MB | $0 | Bakım/test. Uyur. |
| `starter` | 512 MB | ~$7 | Hep açık (uyumaz) ama RAM yine düşük |
| `standard` | 2 GB | ~$25 | Gerçek yük + **yapay zeka OCR** için gereken |

Önerilen büyüme sırası:
1. **İlk adım (uyumayı bitir):** Auth API + PDF API → `starter`.
2. **Yapay zeka OCR / ağır yük gerekince:** PDF API → `standard`.
3. Frontend her zaman ücretsiz kalabilir.

---

## 🔧 Adım 1 — Planı yükseltmek (2 yol var)

### Yol A — render.yaml üzerinden (önerilen, kalıcı)

Plan ayarı kod içinde `render.yaml` dosyasında yazılı. Değiştirip `git push`
yaparsan Render otomatik uygular. Bu yol kalıcıdır (sonraki deploy'larda korunur).

1. `render.yaml` dosyasını aç.
2. İlgili servisin `plan:` satırını değiştir:

   ```yaml
   # nb-pdf-api ve nb-auth-api altında:
   plan: free        →    plan: standard     # (veya starter)
   ```

3. PDF API'yi `standard`'a alıyorsan worker sayısını da artır (RAM arttı):

   ```yaml
   # nb-pdf-api envVars altında:
   - key: WEB_CONCURRENCY
     value: "1"      →    value: "2"          # 2 GB RAM ~2 worker kaldırır
   - key: PDF_SANDBOX_MEM_MB
     value: "384"    →    value: "1024"       # artık 1 GB sınır güvenli
   ```

4. Kaydet ve gönder:
   ```
   git add render.yaml
   git commit -m "Plan yukseltildi: standard"
   git push
   ```
5. Render otomatik yeniden deploy eder.

### Yol B — Render panelinden (hızlı, geçici)

Acil durumda elle de yapabilirsin (ama bir sonraki `render.yaml` push'unda geri
dönebilir, o yüzden Yol A'yı tercih et):

1. https://dashboard.render.com → ilgili servis (örn. `nb-pdf-api`).
2. **Settings** → **Instance Type** (Plan).
3. `Standard` seç → **Save**. Render servisi yeni planla yeniden başlatır.

> ⚠️ Yol B ile değiştirirsen, kalıcı olması için `render.yaml`'ı da aynı
> şekilde güncellemeyi unutma. Yoksa panel ile dosya çelişir.

---

## 🤖 Adım 2 — Yapay zeka OCR'ı geri açmak (sadece `standard`+ planda)

Ücretsiz dönemde `docling` / `easyocr` (taranmış belge / yapay zeka OCR)
kapatılmıştı. Bunlar torch+CUDA (~5 GB) çeker ve **en az 2 GB RAM** ister.
Yani önce PDF API'yi **`standard`** plana almış olmalısın (Adım 1).

Bu paketler `web/backend/requirements-ocr.txt` dosyasında bekliyor. Geri açmak
için Dockerfile'ın onları da kurmasını sağla:

1. `web/backend/Dockerfile` dosyasını aç.
2. Şu satırı bul:
   ```dockerfile
   RUN pip install --upgrade pip && \
       pip install -r /app/web/backend/requirements.txt
   ```
3. `requirements-ocr.txt`'yi de ekle:
   ```dockerfile
   RUN pip install --upgrade pip && \
       pip install -r /app/web/backend/requirements.txt \
                   -r /app/web/backend/requirements-ocr.txt
   ```
   > Not: Bu satırdan önce `requirements-ocr.txt`'nin de imaja kopyalandığından
   > emin ol. En basiti: `COPY web/backend/requirements.txt ...` satırını
   > `COPY web/backend/requirements*.txt /app/web/backend/` yapmaktır.
4. Kaydet, `git push` → Render yeni imajı build eder (bu build **uzun sürer**,
   ~5 GB indirir; ilk seferde 10-20 dk normaldir).

> Kodda bu paketler **lazy import** edilir (`src/pdf_engine.py`). Yani kurulu
> olmadığında uygulama yine açılır, sadece o özellikler hata verir. Kurunca
> kendiliğinden çalışır hale gelir.

---

## ✅ Adım 3 — Geçiş sonrası kontrol listesi

```
[ ] İlgili servis(ler) Render'da "Live" (yeşil)
[ ] Site bekletmeden açılıyor (cold start bitti)
[ ] Bir PDF işlemi denedim, çalıştı (502/killed yok)
[ ] (OCR açtıysam) taranmış bir PDF'de OCR çalıştı
[ ] Üyelik + giriş + (varsa) test ödemesi sorunsuz
[ ] render.yaml ile panel ayarları birbiriyle TUTARLI
```

---

## 🗄️ Veritabanı notu (büyürken)

- Ücretsiz dış veritabanı (Neon/Supabase ücretsiz katman) küçük başlangıç için
  yeterli ama sınırlıdır (depolama, bağlantı, bazı planlarda otomatik silme).
- Gerçek yük gelince **kalıcı/ücretli** bir PostgreSQL'e geç (Neon/Supabase
  ücretli katman veya Render PostgreSQL). `DATABASE_URL`'i yeni adresle güncelle.
- Geçişte **mevcut veriyi yedekle/taşı** — detay için **04-VERITABANI.md**.

---

## 🧾 Özet — "Ücretsiz → Canlı" geçişinde yapılacaklar

1. `render.yaml`: `plan: free` → `starter`/`standard` (Auth + PDF API).
2. PDF API `standard` ise: `WEB_CONCURRENCY=2`, `PDF_SANDBOX_MEM_MB=1024`.
3. Yapay zeka OCR lazımsa: Dockerfile'a `requirements-ocr.txt` ekle (yalnız `standard`+).
4. Veritabanını kalıcı/ücretli plana taşı, `DATABASE_URL`'i güncelle.
5. `git push` → Render otomatik deploy → kontrol listesini uygula.

> İlgili rehberler: planın kendisi ve ortam değişkenleri için **01-YAYINA-ALMA.md**,
> sorun çıkarsa **03-LOGLAR.md** ve **06-SIK-HATALAR.md**.
