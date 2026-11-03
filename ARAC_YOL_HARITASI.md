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
| 2 | [x] | UDF paketi: PDF→UDF, Word→UDF, UDF→Word, UDF Görüntüleyici, Görsel/TIFF→UDF | /tools/pdf-to-udf, word-to-udf, udf-to-word, udf-viewer, image-to-udf | **Hukuk / UYAP** (yeni kategori; UDF→PDF de buraya taşındı) | Tarayıcı (cihazda) | Motorlar + ekran + adres + SEO (TR/EN) + kategori + ana sayfada "Hukuk / UYAP" sekmesi + panelde tek "UDF / UYAP Araçları" sayfası (sekmeli). Uyarı metni her araçta. Testler geçti (frontend 1312, api 698). **UYAP Doküman Editörü'nde üretilen .udf'nin elle açma testi kullanıcıda bekliyor.** Görüntüleyici şimdilik metin gösterir (sayfa düzenini birebir göstermez) |
| 3 | [x] | E-başvuru / UYAP uyumluluk kontrolü + "Düzelt" | /tools/e-basvuru-uyumluluk | Hukuk / UYAP | Tarayıcı (cihazda) | Sınırları kullanıcı seçer (boyut MB, sayfa sayısı, A4, seçilebilir metin); sabit kurum sınırı YOK. Düzelt: boyut→sayfaları görüntüye çevirip kaliteyi düşürür (e-imza/kaşe korunmaz, düğmeden önce uyarılır); A4→sayfaları A4'e sığdırır (metin korunur). Sayfa fazlası/metinsizlik düzeltilemez, nedeni söylenir. Mantık testleri geçti; gerçek PDF ile elle deneme kullanıcıda bekliyor. Dal calisma/is3-uyumluluk-kontrolu |
| 4 | [x] | Dilekçe ve form şablonları (PDF/UDF) | /tools/dilekce-sablonlari | Hukuk / UYAP | Tarayıcı (cihazda) | 6 şablon (genel, bilgi edinme, istifa, iade, abonelik iptali, tahliye). PDF ve UDF çıktı. **Metinler `HUKUKI_METINLER_ONAY.md` dosyasında onayınızı bekliyor** (tek kaynak: `petitionTemplates.ts`). Dal calisma/is4-dilekce-sablonlari |
| 5 | [x] | Kimlik kartı ön–arka tek sayfa (+ ehliyet, pasaport) | /tools/kimlik-karti-tek-sayfa | Düzenle | **Yalnız tarayıcı** | Gerçek boyut (85,6×54 mm; pasaport 125×88) alt alta tek A4; döndürme; isteğe bağlı filigran (kurum kabul etmeyebilir uyarısı). Kenar bulma AKTİF (dal calisma/is5b-kimlik-kenar-bulma): genel fotoğraftan kimlik bulunur, perspektif düzeltilir (Belge Tarayıcı motoru, Scanic); bulunamazsa fotoğraf olduğu gibi kullanılır; "yakından çekin" ipucu + küçük kapsama/düşük çözünürlük uyarısı. Mantık testleri geçti; GERÇEK fotoğrafla elle deneme kullanıcıda (tarayıcıda otomatik test edilemedi). Dal calisma/is5-kimlik-karti |
| 6 | [x] | Türkçe sesli okuma (PDF/metin → ses) | /tools/pdf-sesli-oku | Dönüştür | **Yalnız tarayıcı** (cihazda) | Kullanıcı kararı: Antalia-2 Mini (Apache-2.0, ses ağırlıkları da Apache-2.0). ~49 MB model ilk kullanımda iner (kendi sunucumuzdan, derleme sırasında `scripts/setup-antalia.mjs` indirir, sürüm sabitli). Sayı/tarih/kısaltma yazıya çevrilir, WebGPU yoksa WASM'a düşer, WAV indirilir. Tarayıcıda denendi: 7,9 sn gerçek ses üretti (sessiz değil). **Dinleme kalitesi (Hâkim, 3.450.000 TL, virgüller) ve telefonda hız kullanıcıda bekliyor.** Tek erkek sentetik ses. Geçici deneme sayfası silindi. Dal calisma/is6b-antalia-sesli-okuma |
| 7 | [x] | AI soru / test oluşturucu | /tools/pdf-sinav-olustur | Yapay zekâ | Sunucu (Claude, Sonnet) | Çoktan seçmeli (4 şık) + doğru/yanlış; sayı 5-20, tür, zorluk seçilir. Her soru için belgeden AYNEN alıntı istenir ve sunucu alıntının belgede geçtiğini denetler; geçmeyen soru elenir (uydurmaya karşı kilit), hiç soru kalmazsa hak iade edilir. Ekranda çözülür (puan, doğru cevap, açıklama, belge alıntısı); soru kâğıdı ve cevap anahtarlı PDF indirilir. Mevcut yapay zekâ altyapısı: aynı hak/kredi sistemi (≤10 soru 1 hak, üstü 2), admin panelinde aç/kapa anahtarı (`pdf-sinav-olustur`). Gerçek modelle denendi: 8/8 soru üretildi, hepsi doğrulandı, ~11 sn. Testler: api 720, frontend 1383. Tarayıcıda girişli uçtan uca deneme kullanıcıda. Dal calisma/is7-ai-sinav-olusturucu |
| 8 | [x] | Ek dönüştürmeler: TXT/Markdown/RTF/ODT/EPUB → PDF, PDF → EPUB, PDF → Markdown | /tools/txt-to-pdf, markdown-to-pdf, rtf-to-pdf, odt-to-pdf, epub-to-pdf, pdf-to-epub, pdf-to-markdown | Dönüştür | **Yalnız tarayıcı** (cihazda) | 7 araç, tek ekran (panelde sekmeli "Ek Dönüştürmeler", ana sayfada "Metin & E-kitap" sekmesi). Türkçe: TXT'de UTF-8/UTF-16/eski ANSI (Windows-1254) otomatik; RTF'de kod sayfası ve \u kodları çözülür; testlerle doğrulandı, PDF çıktısı gözle kontrol edildi (ş ğ ı İ ç ö ü). Kısıtlar: görsel, tablo düzeni ve çok sütunlu sayfa aktarılmaz; DRM'li EPUB ve taranmış PDF açılmaz (OCR'a yönlendirir). PDF→Markdown/EPUB: başlıklar yazı boyutundan bulunur, sayfa no ve tekrar eden üst/alt bilgi atılır. Gerçek tarayıcıda PDF→Markdown denendi. Elle deneme kullanıcıda: gerçek EPUB/ODT/RTF dosyalarıyla. Dal calisma/is8-ek-donusumler |
| 9 | [ ] | PDF'e başlık / üst bilgi / alt bilgi | /tools/… | Düzenle | Tarayıcı | "Sayfa Numarası" aracıyla karşılıklı bağlantı |
| 10 | [ ] | Güven mesajı (ana sayfa + fiyat sayfası) | — | — | — | Önce ödeme sisteminin gerçekten böyle çalıştığı kodda doğrulanacak |
| 11 | [ ] | Tüm site SEO taraması + 10 blog yazısı (taslak) | — | — | — | Yeni+eski ~60 araç; yazılar önce taslak |

## İleride (sıraya alınmadı)

- **Kendi sesimiz (ince ayar):** Seslendirme sanatçısıyla yazılı sözleşme (yapay ses olarak kullanım izni) + birkaç saatlik kayıt ile Antalia'yı markaya özel sese eğitmek. Şirket kurulunca avukat görüşüyle; eğitim için ekran kartlı makine/sunucu gerekir. Maliyet ölçülmedi.
- **Antalia lisans teyidi:** Yazara (GitHub `fr0stb1rd/antalia-mini-web` Issues veya Hugging Face `cloud0day3/antalia-mini` Community) ticari kullanım ve yardımcı dosya lisansı sorusu; cevap gelene kadar araç canlıya alınmamalı.

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
