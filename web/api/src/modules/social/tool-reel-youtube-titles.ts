/**
 * YouTube Shorts BAŞLIKLARI — izleyicinin derdini söyleyen kısa cümleler.
 *
 * NEDEN: Katalogdaki başlık "Araç adı: ne yapar" biçiminde ve araç tanıtımı gibi okunuyor
 * ("PDF → Excel: Tabloları hesaplanabilir Excel sayfasına aktarın"). Shorts akışında izleyiciyi
 * durduran şey araç adı değil, kendi sorunu. Burada her araç için kısa bir sorun/vaat cümlesi var.
 *
 * KURAL: Yalnızca kataloğun başlığında ve `tool-reel-about.ts` açıklamasında zaten DOĞRULANMIŞ
 * olan şeyi söyle; yeni iddia (süre, oran, "ücretsiz" gibi) ekleme. Her katalog satırının bir
 * karşılığı olmalı (test denetler). Başlık 100 karakteri aşamaz (YouTube sınırı).
 */
export const TOOL_REEL_YOUTUBE_TITLES: Record<string, string> = {
  compress: "“Dosya çok büyük” hatası mı alıyorsun? PDF'i küçült",
  merge: "Birkaç PDF'i tek dosyada toplamanın en kolay yolu",
  "cv-olustur": "CV'ni sıfırdan tasarlamadan dakikalar içinde hazırla",
  "grayscale-pdf": "Renkli PDF'i siyah-beyaza çevir, renkli mürekkepten tasarruf et",
  "flatten-pdf": "Gönderdiğin PDF karşıda kaymasın: formu sabitle",
  "pdf-to-word": "PDF'te bir şeyi değiştirmen mi gerek? Word'e çevir",
  "pdf-to-excel": "PDF'teki tabloyu elle Excel'e yazma, aktar",
  "pdf-to-ppt": "Elinde yalnızca PDF sunum mu var? Slaytlara çevir",
  "word-to-pdf": "Word dosyan karşıda kaymasın: PDF'e çevir",
  "excel-to-pdf": "Excel tablonu bozulmadan gönder: PDF yap",
  "ppt-to-pdf": "Sunumun her cihazda aynı görünsün: PDF yap",
  "pdf-to-text": "PDF'teki tüm yazıyı düz metin olarak al",
  "pdf-to-pdfa": "Kurum PDF/A mı istiyor? Dosyanı arşiv biçimine çevir",
  "deskew-pdf": "Eğri taranmış sayfaları tek tıkla düzelt",
  "repair-pdf": "PDF açılmıyor mu? Bozulmuş dosyayı kurtarmayı dene",
  "extract-images": "PDF'teki tüm fotoğrafları ayrı dosya olarak al",
  "resize-pdf": "PDF'i A4, A5 ya da Letter boyutuna getir",
  "flip-pdf": "PDF sayfalarını ayna gibi çevir",
  encrypt: "PDF'ini parolayla koru, izinleri sen belirle",
  "unlock-pdf": "Parolasını bildiğin PDF'in kilidini aç",
  "pdf-to-image": "PDF'in her sayfasını ayrı fotoğraf olarak kaydet",
  "image-to-pdf": "Fotoğraflarını sıralayıp tek PDF'te topla",
  "alternate-mix-pdf": "Çift taraflı mı taradın? İki PDF'i sırayla birleştir",
  "gorsel-sikistir": "Fotoğraf boyutu çok mu büyük? Hedef boyuta küçült",
  "gorsel-boyutlandir": "Fotoğrafı istediğin ölçüye getir",
  "udf-to-pdf": "UYAP'tan inen .udf dosyasını program kurmadan PDF yap",
  "html-to-pdf": "Bir web sayfasını olduğu gibi PDF'e al",
  "ustveri-temizle": "Göndermeden önce PDF'teki yazar ve konum izlerini sil",
  "form-doldur": "PDF formunu cihazında doldur",
  "taranmis-pdf-ocr": "Taranmış PDF'teki yazıyı okunabilir metne çevir",
  "aranabilir-pdf": "Taranmış belgede Ctrl+F ile arama yap",
};

/** Aracın YouTube başlığı; tanımlı değilse null (çağıran katalog başlığına düşer). */
export function youtubeTitleFor(toolId: string | undefined | null): string | null {
  if (!toolId) return null;
  return TOOL_REEL_YOUTUBE_TITLES[toolId] ?? null;
}
