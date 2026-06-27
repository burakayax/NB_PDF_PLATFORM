# 08 — Görsel Rehberi (ekran görüntüleri / demo)

Sitedeki tüm "gerçek ekran görüntüsü" görselleri ve **nereye konacakları**.
Yeni görsel eklerken aşağıdaki **dosya adlarını birebir** kullan — kod o adlara
bakıyor. Görseli koyduğun an otomatik görünür (yeniden deploy yeterli).

> **İngilizce sürüm:** Aynı görselin İngilizcesini çekersen, dosya adına
> uzantıdan **önce `-en`** ekle (ör. `step1.png` → `step1-en.png`).
> Site İngilizce görüntülendiğinde otomatik o gösterilir. **`-en` dosyası yoksa
> Türkçesine düşer** — yani İngilizce sürüm eklemek zorunda değilsin, eklersen
> kendiliğinden devreye girer.

---

## 1) Ana sayfa "3 Adımda Tamamla" — canlı demo animasyonu

Klasör: `web/frontend/public/demo/`

| Dosya | Nerede görünür | Ne çekmeli | İng. sürüm |
|---|---|---|---|
| `step1.png` | Adım 1 · **Aracı Seç** | Çalışma alanı, sol araç menüsü görünür | `step1-en.png` |
| `step2.png` | Adım 2 · **Dosyanı Yükle** | "Dosya Seç" ekranı (dosya seçilmiş hâli) | `step2-en.png` |
| `step3.jpg` | Adım 3 · **Sayfaları Seç & Düzenle** | Görsel sayfa ızgarası (thumbnail grid) | `step3-en.jpg` |
| `step4.png` | Adım 4 · **Otomatik İndir & Paylaş** | İndirme barı (Paylaş/Aç/Kapat görünür) | `step4-en.png` |

- Önerilen genişlik **~1440px**, oran **~2.08:1** (geniş ekran). Hepsi PNG, sadece
  `step3` JPG (yoğun ızgara → daha küçük dosya).
- Vurgu kutularının yeri kodda yüzde olarak ayarlı (`ThreeStepDemo.tsx`); aynı
  ekranı benzer çözünürlükte çekersen oturur. Çok farklı bir görsel koyarsan
  vurgu koordinatları güncellenmeli.

## 2) Ana sayfa "Her PDF İş Akışı" — tarayıcı önizlemesi

Klasör: `web/frontend/public/screenshots/`

| Dosya | Nerede görünür | Ne çekmeli | İng. sürüm |
|---|---|---|---|
| `web-app.png` | Hero altındaki **tarayıcı çerçevesi** (Gerçek Zamanlı vb. rozetlerin ortasında) | Web uygulaması, sol araç menüsü dahil tam ekran | `web-app-en.png` |

- Çerçeve oranı `aspect-[1366/657]` (≈2.08). Görseli bu orana yakın çek ki
  kırpılmadan tam otursun.

## 3) Fiyatlandırma → Business → "Tüm ayrıcalıkları gör" popup'ı

Klasör: `web/frontend/public/`

| Dosya | Nerede görünür | Ne çekmeli | İng. sürüm |
|---|---|---|---|
| `admin-preview.png` | **Business** plan popup'ının üstündeki **Yönetim/Ekip Paneli** görseli | Ekip Yönetimi ekranı (istatistik kartları + koltuk kullanımı) | `admin-preview-en.png` |

- ⚠️ **GİZLİLİK:** Bu görselde **gerçek e-posta / kişisel bilgi (PII) OLMASIN.**
  Mevcut görsel, üye satırı (e-posta) kırpılarak hazırlandı. Yeni çekersen üye
  e-postalarının olduğu kısmı dahil etme (üst kısım yeterli).

---

## Ham görseller nereye?

Çekip işlenmemiş ham görselleri repo-kökündeki `_screenshots/` klasörüne
koyabilirsin — bu klasör `.gitignore`'da, repoya **girmez** (içinde PII olabilir).
İşlenmiş/temiz hâlleri yukarıdaki `public/...` yollarına konur ve deploy edilir.

## Özet kural

1. Görseli ilgili `public/...` klasörüne, **tablodaki adla** kaydet.
2. İngilizcesi varsa `-en` ekli adla da kaydet (opsiyonel).
3. Commit + push → Render deploy → görsel canlıda.
