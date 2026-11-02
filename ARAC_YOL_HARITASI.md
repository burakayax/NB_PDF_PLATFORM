# Araç Yol Haritası (takip dosyası)

Durum işaretleri: `[ ]` Bekliyor · `[~]` Devam ediyor · `[x]` Bitti · `[!]` Engel var

Çalışma kuralları: işler sırayla, birer birer; her iş bitince (kod + test + SEO + blog) bu dosya güncellenir.
Her iş ayrı dalda, ayrı commit; ana dala birleştirme ve canlıya gönderme yalnız kullanıcı onayıyla.
Oturum kesilirse bu dosya okunup kalınan yerden devam edilir.

Önceki görev (PDF'ye QR Kod Ekle + Birleştir/Tıklanabilir İçindekiler): **bitti** (commit `a040bb8`).

| # | Durum | İş / Araç | URL | Kategori | Nerede çalışır | Not |
|---|---|---|---|---|---|---|
| 0 | [x] | Proje incelemesi | — | — | — | Bulgular aşağıda ("Proje bulguları") |
| 1a | [x] | PDF Sıkıştır: hedef boyut + imza/kaşe uyarısı | /tools/compress | Düzenle | Sunucu | Hedef boyut VAR (100 KB…10 MB, kullanıcı değeri 20 KB–200 MB). 20 MB seçeneği ve imza/kaşe uyarısı eklendi (dal calisma/is1-sikistir-tiff) |
| 1b | [x] | Görsel → PDF: çok sayfalı TIFF (CCITT dahil) | /tools/image-to-pdf | Dönüştür | Tarayıcı (cihazda) | Çok sayfalı TIFF desteği eklendi (`ad56793`); CCITT Group 4 çözümü denendi, doğru. Ayrı "TIFF → PDF" SEO sayfası İş 11'e (SEO) ertelendi: adres takma adı (alias) yönlendirmesi gerektiriyor; yazılacak blog 4 (UYAP TIF) bunu da karşılar |
| 2 | [ ] | UDF paketi: PDF→UDF, Word→UDF, UDF→Word, UDF Görüntüleyici, Görsel/TIFF→UDF | /tools/… | Dönüştür (ya da yeni "Hukuk / UYAP") | Tarayıcı (öneri) | Örnekler `udfornek/` klasöründe (6 dosya; düz metin, tablo, resim hepsi var). Format çözümlendi: ZIP içinde content.xml (+documentproperties.xml) |
| 3 | [ ] | UYAP / e-başvuru uyumluluk kontrolü + "Düzelt" | /tools/… | Düzenle (ya da Hukuk / UYAP) | Tarayıcı + gerekirse sunucu | Sınır kullanıcı seçer, sabit "UYAP sınırı" yok |
| 4 | [ ] | Dilekçe ve form şablonları (PDF/UDF) | /tools/… | Düzenle | Tarayıcı | Metinleri kullanıcı onaylar; ayrı dosyada listelenecek |
| 5 | [ ] | Kimlik kartı ön–arka tek sayfa | /tools/… | Düzenle | **Yalnız tarayıcı** (gizlilik) | Mevcut Belge Tarayıcı altyapısı (OpenCV.js) kullanılabilir |
| 6 | [ ] | Türkçe sesli okuma (PDF → ses) | /tools/… | Dönüştür | Karar bekliyor | Tarayıcı sesi mi sunucu sesi mi: karşılaştırma sunulacak, karar kullanıcıda |
| 7 | [ ] | AI soru / test oluşturucu | /tools/… | Yapay zekâ | Sunucu (Claude) | Mevcut yapay zekâ altyapısı kullanılacak |
| 8 | [ ] | Ek dönüştürmeler: EPUB↔PDF, TXT/RTF/ODT→PDF, PDF→Markdown | /tools/… | Dönüştür | Karışık | Türkçe karakter testi şart |
| 9 | [ ] | PDF'e başlık / üst bilgi / alt bilgi | /tools/… | Düzenle | Tarayıcı | "Sayfa Numarası" aracıyla karşılıklı bağlantı |
| 10 | [ ] | Güven mesajı (ana sayfa + fiyat sayfası) | — | — | — | Önce ödeme sisteminin gerçekten böyle çalıştığı kodda doğrulanacak |
| 11 | [ ] | Tüm site SEO taraması + 10 blog yazısı (taslak) | — | — | — | Yeni+eski ~60 araç; yazılar önce taslak |

## Proje bulguları (0. adım)

- **Yapı:** React + TypeScript + Vite (web/frontend), Express + Prisma (web/api), Python FastAPI PDF servisi (web/backend + src/).
- **Araç sayısı:** 55 (toolCatalog.ts). Kategoriler: Yapay zekâ 8 · Dönüştür 11 · Düzenle 29 · Tarama 3 · Güvenlik 4.
- **Yeni araç ekleme yeri:** `lib/toolCatalog.ts` (liste), `lib/appNavigation.ts` / `lib/appViews.ts` (adres ve ekran), `seo/seoContent.mjs` (SEO + SSS), `lib/onDeviceTools.ts` (cihazda işlenenler), blog: `blog/blogContent*.mjs`.
- **UDF → PDF** cihazda çalışıyor (`components/tools/UdfToPdfTool.tsx`).
- **Kimlik/tarama altyapısı:** Belge Tarayıcı (kenar tespiti + perspektif düzeltme, cihazda) mevcut.
- **Çok dilli:** Türkçe + İngilizce.

## Açık sorular

(Şu an açık soru yok.)

## Kararlar

- **Yeni kategori onaylandı:** "Hukuk / UYAP" (UDF araçları, uyumluluk kontrolü, dilekçe şablonları). Kullanıcı onayı: 2026-11-02.
- UDF örnek dosyaları `udfornek/` klasöründe.

## UDF format çözümlemesi (örneklerden)

- Dosya bir ZIP: `content.xml` + `documentproperties.xml` (ör. `uyapsicil`).
- `content.xml` (UTF-8): `<template format_id="1.7|1.8">` → `<content><![CDATA[ düz metnin tamamı ]]></content>`, `<properties><pageFormat …/>` (kenar boşlukları, yön), `<elements>` (her `paragraph` metnin `startOffset`/`length` aralıklarına bağlı `content` parçaları: bold/italic/size/foreground, Alignment, FirstLineIndent), `table/row/cell`, `image` (base64 PNG, `imageData`), `<styles>`.
- Metin ve biçim ayrı: biçim, düz metindeki karakter konumlarıyla eşleşiyor.
