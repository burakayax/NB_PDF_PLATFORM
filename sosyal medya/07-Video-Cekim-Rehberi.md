# 🎬 Sıfırdan Video Çekim Rehberi

> Hiç video çekmediysen bu dosya tam sana göre. Ekipman gerekmez — bilgisayarın ve telefonun yeter.
> Baştan sona takip et; ilk videonu bugün çıkarabilirsin.

---

## 🧠 Önce mantık: 2 tür video çekeceksin

| Tür | Neyle çekilir | Hangi araçlar | Örnek |
|---|---|---|---|
| **Ekran kaydı** | Bilgisayar | Sıkıştırma, Birleştirme, Word'e çevir, İmza, Şifre kaldırma... | Ekranda aracı kullanırken kaydedersin |
| **Telefon kaydı** | Telefon | Belge Tarama (kamera kullanan tek araç) | Belgeyi telefonla tararken kaydedersin |

**İlk videon:** PDF Sıkıştırma (ekran kaydı). Nedeni: herkesin derdi, kanıtı tek sayıda görünür (48 MB → 6 MB), telefon gerekmez, 20 saniyede biter.

---

## 🖥️ BÖLÜM 1 — Bilgisayarda Ekran Kaydı

### Adım 1: Hazırlık (kayıttan önce)
1. Tarayıcıyı **gizli pencerede** aç (Chrome: `Ctrl+Shift+N`). Böylece uzantı çubuğu, yer imleri, kişisel şeyler görünmez.
2. **Örnek/sahte bir PDF hazırla.** Gerçek fatura/kimlik KULLANMA. (İçinde örnek metin olan herhangi bir PDF yeterli. Büyük dosya lazımsa birkaç görselli PDF oluştur.)
3. Bildirimleri kapat (Windows: `Win+A` → "Rahatsız etmeyin" aç). Kayıtta bildirim çıkmasın.
4. Masaüstünü topla (dağınık ikonlar görünmesin — gizli pencere zaten çoğunu halleder).

### Adım 2: Kayıt aracını seç

**Kolay yol — Windows'ta hazır gelen (Xbox Game Bar):**
1. Aracı tarayıcıda aç.
2. `Win + Alt + R` tuşlarına bas → kayıt başlar (sağ üstte küçük sayaç çıkar).
3. İşlemi yap.
4. Tekrar `Win + Alt + R` → kayıt biter. Video `Videos/Captures` klasörüne kaydedilir.
> Sınır: Game Bar sadece **yatay** ve tek pencere kaydeder. Reels/TikTok için dikey lazımsa aşağıdaki OBS'yi kullan.

**Profesyonel yol — OBS Studio (ücretsiz, önerilen):**
1. https://obsproject.com adresinden indir, kur.
2. İlk açılışta "Auto-Configuration Wizard" çıkar → "Optimize for recording" seç.
3. **Dikey video için** (Reels/Shorts/TikTok):
   - `Settings → Video → Base Resolution: 1080x1920`, `Output Resolution: 1080x1920`.
4. `Sources` (Kaynaklar) altında `+` → `Window Capture` → tarayıcı penceresini seç.
5. Pencereyi kadraja sığdır (köşelerden büyüt/küçült).
6. Alttan **`Start Recording`** → işlemi yap → **`Stop Recording`**.
7. Video `Videos` klasörüne kaydedilir.

### Adım 3: Kayıtta NE göstereceksin (sıra çok önemli — 15-25 sn)
Örnek: **PDF Sıkıştırma**
1. (0-2 sn) Araç ekranı açık, dosyayı **sürükle-bırak**.
2. (2-5 sn) Orijinal boyutu göster — imleci "48 MB" yazısının üstünde tut.
3. (5-10 sn) "Sıkıştır" butonuna bas, kısa yükleniş.
4. (10-15 sn) Sonucu göster: "6 MB ✅" + indir butonu.
5. (Bonus — gizlilik araçlarında) `F12 → Network` sekmesini açık tut; işlem boyunca **hiç yükleme (upload) isteği çıkmadığını** göster. Bu en güçlü kanıttır.

> **İpucu:** İmleci yavaş ve net hareket ettir. Tıklayacağın yeri bir an bekle. İzleyici gözüyle takip edebilsin.

---

## 📱 BÖLÜM 2 — Telefonda Kayıt (Belge Tarama için)

### Adım 1: Ekran kaydını aç
- **iPhone:** Ayarlar → Kontrol Merkezi → "Ekran Kaydı"nı ekle. Sonra sağ üstten aşağı kaydır → ⏺ kayıt ikonuna bas.
- **Android:** Ekranın üstünden iki kez aşağı kaydır → "Ekran Kaydedici"ye bas → Başlat.

### Adım 2: Çekim
1. Telefon tarayıcısında `pdfplatform.app/tools/belge-tara` aç.
2. Masaya **eğik/buruşuk örnek bir belge** koy (before/after etkisi için bilerek düzgün olmasın).
3. Kamerayla çek → aracın **kenarları otomatik bulmasını** ve düzeltmesini göster.
4. Sonuç: net PDF → "Kaydet" ekranını göster.
5. Ekran kaydını durdur.

### Adım 3: Before/After yan yana
Düzenlemede (aşağıda) eğik ham fotoğrafla düzeltilmiş PDF'i **yan yana** göster. Bu format en çok paylaşılandır.

---

## ✂️ BÖLÜM 3 — Düzenleme (CapCut — ücretsiz, Türkçe)

CapCut hem telefonda hem bilgisayarda var, ücretsiz ve kolay.

### Kurulum
- Telefon: App Store / Play Store → "CapCut".
- Bilgisayar: https://www.capcut.com → indir.

### Adım adım düzenleme
1. **Yeni proje** → çektiğin videoyu içeri al.
2. **Kırp/hızlandır:** Bekleme anlarını kes. Yükleniş uzunsa hızlandır. Toplam **15-30 sn** kalsın.
3. **Altyazı ekle (EN ÖNEMLİ ADIM):**
   - CapCut → "Metin" → "Otomatik altyazılar" → dil: Türkçe → oluştur.
   - Konuşmuyorsan bile ekrana **açıklayıcı metin** koy: "1️⃣ Dosyayı sürükle", "2️⃣ Sıkıştır", "3️⃣ İndir".
4. **Başlık (ilk 2 saniye):** Üste büyük yazı — "Dosya çok mu büyük?" / "PDF'i telefonla tara".
5. **Son kart (1-2 sn):** Ekrana logo (`navbar-logo.png`) + `pdfplatform.app` + "Linke tıkla" yaz.
6. **Müzik:** CapCut'ın "Ticari kullanıma uygun" (telifsiz) müziklerinden hafif bir tane ekle, sesi kıs (%15-20).

### Dışa aktarma (Export) ayarları
| Nereye | Boyut / Oran | fps |
|---|---|---|
| Reels / Shorts / TikTok | **1080×1920 (9:16 dikey)** | 30 |
| YouTube normal video | **1920×1080 (16:9 yatay)** | 30 |
- Format: **MP4**, kalite: **1080p (Yüksek)**.

---

## 🔁 BÖLÜM 4 — Tek video, üç platform

Bir **dikey (9:16)** video çektin mi, aynısını 3 yere koy:
- **YouTube Shorts** (60 sn altı)
- **Instagram Reels**
- **TikTok**

> Her platforma yüklerken açıklama + hashtag'i o platforma göre uyarla (ilgili platform dosyasına bak). Video aynı, metin farklı.

---

## 🧾 Çekim Öncesi Kontrol Listesi (her video için)

```
[ ] Gizli tarayıcı penceresi açık
[ ] Örnek/sahte PDF hazır (gerçek belge YOK)
[ ] Bildirimler kapalı (Rahatsız etmeyin)
[ ] Ne göstereceğim netleşti (3-5 adım)
[ ] Kayıt aracı hazır (Game Bar / OBS / telefon)
[ ] Süre hedefi: 15-30 sn
```

## 🧾 Yükleme Öncesi Kontrol Listesi

```
[ ] Altyazı eklendi
[ ] İlk 2 saniyede başlık var
[ ] Son kartta logo + link var
[ ] Doğru boyutta export edildi (dikey/yatay)
[ ] Açıklama + hashtag hazır (platform dosyasından)
[ ] Site linki eklendi
```

---

## ⚠️ Sık Yapılan Hatalar (kaçın)

1. **Altyazısız yüklemek** → en büyük hata, izlenme yarıya düşer.
2. **Çok uzun video** → 40 saniyeyi geçince insanlar kaçar. Kısa tut.
3. **Gerçek kişisel belge göstermek** → asla. Hep örnek dosya.
4. **Sessiz, açıklamasız ekran** → her adımda ekranda ne olduğunu yaz.
5. **İlk 2 saniyede logo/intro koymak** → intro yok, doğrudan probleme gir.
6. **Farklı platformlarda farklı görünmek** → aynı logo, aynı ad, aynı ton.
