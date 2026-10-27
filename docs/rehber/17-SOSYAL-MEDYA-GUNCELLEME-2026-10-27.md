# 17 — Sosyal medya güncellemesi (27 Ekim 2026)

## Ne değişti

1. **Tüm ağlarda gönderi dili Türkçe.** Artık "İngilizce üstte, Türkçe altta" iki dilli blok yok. Çift dilli ayarı panelde
   durur ama gönderi metnini etkilemez. Pinterest'te dil karışıklığı bu yüzden bitti.
2. **Her gönderi yoruma çağıran bir soruyla biter** (örn. "Sen CV'nde hangisini yazıyorsun? 👇"). Yapay zekâ yazmazsa sistem
   sonuna konuya uygun bir soru ekler. Facebook'ta zaten vardı.
3. **LinkedIn'e ayrı metin.** Profesyonel ton, "siz" hitabı, meslek hayatından bir soru. X kısa, Pinterest arama odaklı kalır.
4. **Kopya kontrolü adrese de bakar.** Aynı yazı Türkçe ve İngilizce besleme kaydıyla farklı kimlik taşırsa artık ikinci kez
   paylaşılmaz (Pinterest'te aynı pinin iki kez çıkmasının olası sebebi).
5. **Alt bilgideki 7 sosyal bağlantı koddan garanti edilir.** Panelde Facebook yoktu, LinkedIn kişisel profile gidiyordu;
   artık Instagram, Facebook, X, LinkedIn (şirket sayfası), YouTube, TikTok, Pinterest her zaman doğru adresle görünür.
   Panelden başka bir ağ (örn. GitHub) eklersen korunur; bu yedi ağın adresi panelden değiştirilemez.
6. **Elle yükleme paketi:** `web/api` klasöründen
   `npx tsx scripts/export-manual-pack.ts --tool compress --dir <indirilen klasör> --out "../../sosyal medya/yayin-paketi"`
   Videoyu GitHub → Actions → "Araç videosu üretimi" → çalıştırma → "arac-videosu-cikti" dosyasından indir (2 gün saklanır).
   Çıkan klasörlerde (instagram, tiktok, youtube, facebook) `video.mp4` + `aciklama.txt` hazır olur.
7. **4 haftalık takvim:** `sosyal medya/10-Dort-Haftalik-Takvim.csv` (Excel'de açılır). Başka tarihten üretmek için
   `node "sosyal medya/yayin-takvimi-uret.mjs" 2026-11-25`.

## Senin yapacakların (panel ve hesaplar)

- **Haftada 2 video:** Panel → Sosyal medya → Zamanlama → "Araç videoları" sıklığını **3 gün** yap (haftada ~2,3 video).
  Varsayılan "kapalı"dır. Başlangıçta "Önce onay" modunda bırak, izleyip onayla.
- **LinkedIn:** Haftada 2 CV ipucu takvimde var. Otomatik gitmesi için LinkedIn "Community Management API" onayı ve erişim
  anahtarı gerekir (rehber 09). Anahtar yoksa gönderi "Elle paylaşılacaklar"da bekler; kopyalayıp paylaşırsın.
- **TikTok:** API onayı 2–4 hafta sürer ve onaylanana kadar paylaşımlar sadece sana görünür. O yüzden TikTok'a elle yükle
  (yayin-paketi/.../tiktok). Profil biyografisine `pdfplatform.app` bağlantısını koy.
- **Pinterest:** Eski düz koyu pinleri silmedik. İstersen Pinterest'ten elle sil; yeni pinler zaten tasarımlı 2:3 şablondan çıkar.

## Geri alma

- Çift dile dönmek: `copy.service.ts` içindeki `sidesFor` fonksiyonunun sonundaki "Türkçe tek dil" satırını eski
  `bilingualPossible` mantığıyla değiştir (git geçmişinde var).
- Sosyal bağlantıları panelden yönetmek: `SettingsContext.tsx` içindeki `resolveSocialLinks` çağrısını kaldır.
