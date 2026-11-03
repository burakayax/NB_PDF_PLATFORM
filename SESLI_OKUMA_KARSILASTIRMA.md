# Türkçe Sesli Okuma (PDF → Ses) — Karşılaştırma ve Karar

Karar sizindir. Bu dosya iki yolu karşılaştırır; **doğrulanmayan her bilgi "DOĞRULANMADI" diye işaretlidir.**

## Önce kendi kulağınızla deneyin

`web/frontend/public/ses-deneme.html` geçici bir deneme sayfasıdır (kararla birlikte silinecek).
`npm run dev` ile açıp `http://localhost:5173/ses-deneme.html` adresine gidin; **telefonda da** deneyin
(canlıya almadan telefonda denemek için bilgisayarın yerel adresini kullanabilirsiniz).
Sayfa o cihazdaki Türkçe sesleri listeler ve içinde zor Türkçe örnekler olan bir metni (İ/ı, rakam, yüzde, saat, para, adres) okutur.
Dinlerken şunlara bakın: i/ı doğru mu, "%12,5" ve "3.450.000 TL" doğru okunuyor mu, ritim doğal mı.

## Seçenek A — Tarayıcının kendi sesi (Web Speech)

| Konu | Durum |
|---|---|
| Maliyet | Sıfır. Sunucu yok. |
| Gizlilik | Metin cihazdan çıkmaz (bazı tarayıcılarda "internetten" tipi sesler metni üreticiye gönderir — denemede tablodaki "Cihazda" sütununa bakın). |
| Kalite | **Cihaza ve tarayıcıya göre değişir.** Windows/Android/iPhone'da farklı sesler gelir; bazı cihazlarda Türkçe ses hiç olmayabilir. Kalite kontrolü bizde değil. |
| Ses dosyası (MP3) indirme | **Yok** (tarayıcı sesi kaydedilemez). Sadece sayfada dinlenir. |
| Uzun metin | Tarayıcı bazen uzun metinde durur; parçalara bölmek gerekir (yapılabilir). |
| İş yükü | Küçük: PDF metni zaten cihazda çıkarılabiliyor. |

## Seçenek B — Sunucu sesi

Alt seçenekler (hiçbiri bu projede kurulu değil):

| Alt seçenek | Artı | Eksi |
|---|---|---|
| B1. Kendi sunucumuzda açık kaynak ses (ör. Piper, Türkçe sesleri var: "dfki", "fahrettin") | Dış ücret yok, her cihazda aynı ses, MP3 indirilebilir | Mevcut PDF sunucusu "starter" plan, 512 MB (render.yaml); ses modeli + çalışma ortamı bunu zorlayabilir → büyük plan veya ayrı sunucu gerekebilir. Ses modeli lisansı **DOĞRULANMADI** (kod lisansı MIT görünüyor, ses modeli ayrı olabilir; ticari kullanımdan önce model sayfasından kontrol şart). Model boyutu **DOĞRULANMADI**. Kalite: orta ("medium"), Türkçe için dinleyip karar verilmeli. |
| B2. Bulut TTS (Google/Azure/ElevenLabs) | Genelde daha doğal | Karakter başına ücret (Google: Standard ~4 $/milyon karakter, Neural2 ~16 $/milyon karakter — **bilgi üçüncü taraf özetlerinden, resmi sayfadan teyit edilmeli; Türkçe ses listesi DOĞRULANMADI**). Metin dış servise gider → "dosya cihazdan çıkmaz" iddiası bu araçta kullanılamaz. Kredi/limit tasarımı gerekir. |

## Önerim (karar sizin)

1. **Önce A'yı sunalım**: sıfır maliyet, gizlilik iddiası korunur, hızlı çıkar. Aracın adına/açıklamasına dürüstçe "sesi cihazınız belirler" yazarız.
2. A'nın kalitesi sizin cihazlarınızda yetersizse **B1** (Piper) için küçük bir deneme sunucusu kurup aynı metni karşılaştırırım; MP3 indirme ve tutarlı ses bu yoldan gelir.
3. B2'yi ancak ücret + gizlilik değişimi kabul edilirse düşünürüm.

## Sizden istenen

- [ ] Deneme sayfasını **bilgisayarda ve telefonda** dinleyin. Kalite yeterli mi?
- [ ] Karar: **A** / **B1** / **B2** / (A ile başla, sonra B1)

Karar gelene kadar İş 6 için araç sayfası **yapılmadı** (boşa iş olmasın diye).
