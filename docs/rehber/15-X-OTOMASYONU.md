# X (Twitter) otomatik paylaşım düzeni

Yayın saatine ve sıklığa bu sistem dokunmaz; onları panelden sen ayarlarsın. Burada yalnızca **ne paylaşılacağı** anlatılır.

## Haftalık döngü (6 gönderi, sırayla tekrar eder)
1. **Blog ipucu** — yazının en faydalı 2–3 ipucu, madde madde. Link ana gönderide YOKTUR.
2. **Ürün** — bir aracı gösteren kısa metin + görsel (örnek rakamlar metinde "Örnek" diye yazılır).
3. **Blog ipucu**
4. **Ürün**
5. **Anket** — 2–4 seçenek, 24 saat.
6. **"Bunu biliyor muydunuz?"** — tek ipucu + görsel, linksiz.

## Kurallar
- **Link:** ana gönderi yayınlanınca aynı gönderiye (thread varsa en son gönderiye) yanıt olarak gider: "Detaylı rehber 👇 <link>". UTM etiketi kalır.
- **Thread:** metin 280'i aşarsa 1/2, 2/2… diye bölünür; link yine en son yanıtta.
- **Soru:** blog ipucu gönderileri konuya özel kısa bir soruyla biter.
- **Etiket:** gönderi başına en fazla 1, konuya özel (#CV, #İşArama, #Mülakat, #PDF, #Sözleşme, #eDevlet…). Genel etiket yok.
- **Tekrar yok:** aynı içerik, tüm havuz bitmeden yeniden paylaşılmaz.
- **Spam yok:** sistem yalnızca kendi gönderilerini ve kendi link yanıtını yayınlar; beğeni, takip, yanıt, DM yapmaz.

## İçerik nereden geliyor
`/social-x.json` (siteyi derleyince üretilir, `frontend/scripts/generate-social-x.mjs`):
- **İpuçları uydurulmaz:** yazının kendi bölüm başlıkları ve açıklama cümlesinin ilk parçasıdır (kaydırmalı gönderiyle aynı kaynak).
- **Ürün gönderileri ve anketler** aynı dosyada (`X_PRODUCTS`, `X_POLLS`) tutulur; yeni bir tane eklemek için oraya satır ekle.
- **Görseller** (`/x-cards/...`) yazıya özel: başlık + 1 somut ipucu/rakam. Renk konuya göre: CV mavi, sözleşme mor, PDF araçları turuncu, fotoğraf yeşil, resmî evrak gök mavisi. Düzenler (8 çeşit) dönüşümlü kullanıldığı için görseller birbirine benzemez.

## Gönderi gövdesi (panelde okunur/düzenlenir)
Parçalar `---` satırıyla ayrılır; link yanıtı `↳` ile başlar. Anket `ANKET` ile başlar, seçenekler `•` ile yazılır.

## Denemek (yayınlamadan)
```
cd web/api
npx tsx scripts/x-dry-run.ts [yazı-adresi-parçası]
```
Hiçbir ağ isteği yapmaz; her tür için örnek gönderiyi, link yanıtını, uzunlukları ve kural denetimini gösterir.

## Bilinen sınırlar
- Ürün gönderilerinde ekran kaydı videosu YOK, önce/sonra görseli kullanılır (video yükleme ayrı iş).
- Bazı yazıların kaynak başlıkları kısadır ("Rakamla yazın"); ipucu satırı o zaman yalnız başlıktan oluşur.
