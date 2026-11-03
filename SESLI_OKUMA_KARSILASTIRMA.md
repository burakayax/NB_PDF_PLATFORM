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


## GÜNCELLEME — Seçenek C: tarayıcıda çalışan yapay zekâ sesi (araştırma sonucu)

Deneme sayfasında tarayıcının hazır sesini metinle yönlendirmeye çalıştık (noktalama, sayı, şapka). Üç ayrı yerde takıldı; "Haakim" gibi uzatma ve virgül duraksaması sesin **kendi içinden** geliyor, metinle düzeltilemez. Bu yüzden Seçenek A'yı tek başına yeterli bulmuyorum.

Araştırmada **sunucu gerektirmeyen, tamamen tarayıcıda çalışan Türkçe yapay zekâ sesleri** buldum. Sunucu maliyeti yok, metin cihazdan çıkmıyor (gizlilik iddiamız korunur):

| Model | Boyut | Lisans (kod / ses ağırlıkları) | Not | Dinleme adresi |
|---|---|---|---|---|
| **Antalia-2 Mini** | ~50 MB (ilk açılışta iner, sonra çevrimdışı) | Apache-2.0 / Apache-2.0 | Sayı, tarih, kısaltma düzeltici dahil; tek erkek ses; WebGPU veya WASM | https://fr0stb1rd.github.io/antalia-mini-web/ |
| **EMA Lightning** | 8,6 M parametre | Apache-2.0 / Apache-2.0 | Yazarın ölçümünde Okur'a göre daha anlaşılır (hata oranı %1,10) ve daha doğal (UTMOS 3,29) | https://huggingface.co/spaces/korhun/turkce-dogal-ses |
| **Okur** | ~10 M parametre | Apache-2.0 / CC BY 4.0 (ses sahibine atıf şart) | Şapkalı harf, sıra sayısı ve sayı okuma var; yazarın kendi ölçümünde dördü arasında en az doğal | https://huggingface.co/spaces/ahakan/okur-tts |

Kaynak ölçümler (hata oranı / doğallık, Okur yazarının karşılaştırması): EMA 1,10 % / 3,29, Okur 1,81 % / 2,93, Piper 3,14 % / 3,66, Meta MMS 5,74 % / 3,78. Yani Piper ve MMS daha "doğal" puanlı ama daha çok yanlış okuyor. **Bu rakamlar bağımsız değil, Okur yazarının kendi ölçümü.** Dinleyerek karar verin.

**Doğrulanmadı / dikkat:** Lisans sayfaları "ticari kullanım" kelimesini açıkça yazmıyor (Apache-2.0 genelde ticari kullanıma izin verir, ama canlıya almadan önce LICENSE ve NOTICE dosyaları okunmalı). Okur'un yazarı sesin başkasını taklit etmek ya da dinleyiciyi yanıltmak için kullanılmamasını istiyor. Modellerin mobil telefonlarda hızı ölçülmedi. Model dosyalarını kendi sunucumuzdan sunmamız gerekir (~50 MB, ilk kullanımda indirilir ve tarayıcıda saklanır).

**Önerim (güncel):** C'yi seçelim. Yukarıdaki üç adresten aynı cümleyi dinleyin ("Sayın Hakim, ..."); en iyi geleni siteye gömerim: araç, ilk kullanımda modeli indirir (ilerleme çubuğuyla), PDF metnini cümle cümle okur, sayfa gezinme ve hız ayarı ekler. Telefonda yavaşsa tarayıcı sesine (A) otomatik geri düşer.

## Sizden istenen

- [ ] Deneme sayfasını **bilgisayarda ve telefonda** dinleyin. Kalite yeterli mi?
- [ ] Karar: **A** / **B1** / **B2** / (A ile başla, sonra B1)

Karar gelene kadar İş 6 için araç sayfası **yapılmadı** (boşa iş olmasın diye).


## KARAR (2026-11-03)

Kullanıcı **Antalia-2 Mini**'yi seçti ve araç olarak eklendi: `/tools/pdf-sesli-oku`. Okur kullanılmadı (ses sahibine atıf şartı var). Deneme sayfası silindi. Lisans: kod ve ses ağırlıkları Apache-2.0 (`web/frontend/src/lib/antalia/LICENSE`, `NOTICE`). Doğrulanmadı: telefonda hız; dinleme kalitesi kullanıcının kulağına bağlı.
