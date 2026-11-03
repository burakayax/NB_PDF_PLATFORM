import { Lock, Trash2, Zap, type LucideIcon } from "lucide-react";
import { TOOLS } from "../../lib/toolCatalog";
import { isOnDeviceTool } from "../../lib/onDeviceTools";

/**
 * YÜKLEME EKRANINDAKİ ÜÇ FAYDA KUTUSU.
 *
 * Birkaç aracın elle yazılmış, işine özel metinleri vardır; geri kalan
 * araçlarda bu kutular jenerik üretilir — böylece yeni bir araç eklendiğinde
 * ekran boş kalmaz, ama iyi yazılmış metin de kaybolmaz. Jenerik üretimin
 * ilk kutusu aracın katalog adını/açıklamasını olduğu gibi tekrarlar; Hero'da
 * (ana sayfa) bu, aracın üstündeki tanıtım şeridiyle birebir çakışıyordu —
 * o yüzden Hero'ya sonradan gömülen araçlar da (sayfa-duzeni, pdf-duzenle,
 * pdf-kesit-al, pdf-imzala, pdf-yorumla, udf-to-pdf, gorsel-boyutlandir)
 * burada elle yazılmıştır.
 *
 * Üçüncü kutu gizlilik anlatır ve `lib/onDeviceTools.ts` listesine bakar:
 * sunucuya iş gönderen araçta "cihazından çıkmaz" DENMEZ.
 */

export type Benefit = { icon: LucideIcon; tr: string; trDesc: string; en: string; enDesc: string };

/** Aracın işine özel, elle yazılmış faydalar. */
const CUSTOM: Record<string, Benefit[]> = {
  merge: [
    { icon: Zap, tr: "Tek dosyada", trDesc: "Birden çok PDF'i sırayla tek belgeye birleştir.", en: "One file", enDesc: "Combine multiple PDFs into a single document in order." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Saniyeler içinde, dosya sayısı sınırı yok.", en: "Instant & free", enDesc: "Ready in seconds, no file-count limit." },
    { icon: Lock, tr: "Tamamen gizli", trDesc: "Dosyalar cihazında işlenir, sunucuya gitmez.", en: "Fully private", enDesc: "Processed on your device, never uploaded." },
  ],
  split: [
    { icon: Zap, tr: "İstediğin sayfayı ayır", trDesc: "Sayfa aralığı seç, ayrı PDF olarak al.", en: "Split any pages", enDesc: "Pick a page range and export as a separate PDF." },
    { icon: Zap, tr: "Hızlı", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Fast", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Belgen cihazından hiç çıkmaz.", en: "Private", enDesc: "Your document never leaves your device." },
  ],
  "image-to-pdf": [
    { icon: Zap, tr: "Görselleri PDF yap", trDesc: "JPG/PNG'leri tek PDF'e sırayla dönüştür.", en: "Images to PDF", enDesc: "Turn JPG/PNG files into one ordered PDF." },
    { icon: Zap, tr: "Anında", trDesc: "Sürükle-bırak, saniyeler içinde hazır.", en: "Instant", enDesc: "Drag & drop, ready in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Görsellerin cihazında kalır.", en: "Private", enDesc: "Your images stay on your device." },
  ],
  "gorsel-sikistir": [
    { icon: Zap, tr: "Dosya boyutunu küçült", trDesc: "Kalite ve boyutu ayarla, JPEG/WebP olarak al.", en: "Shrink file size", enDesc: "Adjust quality and dimensions, export JPEG/WebP." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Görselin cihazından hiç çıkmaz.", en: "Private", enDesc: "Your image never leaves your device." },
  ],
  "rotate-pdf": [
    { icon: Zap, tr: "Sayfaları döndür", trDesc: "90° adımlarla düzelt — tek tek ya da toplu.", en: "Rotate pages", enDesc: "Fix orientation in 90° steps, one by one or all." },
    { icon: Zap, tr: "Anında önizleme", trDesc: "Döndür, sonucu hemen gör.", en: "Live preview", enDesc: "Rotate and see the result instantly." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazında işlenir.", en: "Private", enDesc: "Your file is processed on your device." },
  ],
  "delete-pages": [
    { icon: Zap, tr: "Sayfa sil", trDesc: "İstemediğin sayfaları çıkar, gerisini koru.", en: "Delete pages", enDesc: "Remove unwanted pages, keep the rest." },
    { icon: Zap, tr: "Hızlı", trDesc: "Seç ve anında temizle.", en: "Fast", enDesc: "Select and clean up instantly." },
    { icon: Lock, tr: "Gizli", trDesc: "Belgen cihazından çıkmaz.", en: "Private", enDesc: "Your document never leaves your device." },
  ],
  "organize-pdf": [
    { icon: Zap, tr: "Sırala & düzenle", trDesc: "Sayfaları sürükleyip yeniden diz.", en: "Reorder & organize", enDesc: "Drag pages into a new order." },
    { icon: Zap, tr: "Canlı önizleme", trDesc: "Değişikliği anında gör.", en: "Live preview", enDesc: "See changes as you make them." },
    { icon: Lock, tr: "Gizli", trDesc: "Cihazında işlenir, gizli kalır.", en: "Private", enDesc: "Processed on your device, stays private." },
  ],
  // Aşağıdaki 7'si önceden jenerik üretim kullanıyordu — ilk kutu aracın adını
  // olduğu gibi tekrarlıyordu (ör. "Görsel Boyutlandır / Görsel Boyutlandır").
  // Yalnızca ilk kutu özelleşti; hız+gizlilik kutuları ON_DEVICE_TOOLS'a göre
  // generate()'teki standart metinle aynı tutuldu (ses tutarlılığı için).
  "sayfa-duzeni": [
    { icon: Zap, tr: "Kâğıt tasarrufu", trDesc: "2, 4, 6, 8, 9 ya da 16 sayfayı tek yaprağa sığdırın ya da kitapçık dizin.", en: "Save paper", enDesc: "Fit 2 to 16 pages on one sheet, or impose a booklet." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-duzenle": [
    { icon: Zap, tr: "Gerçek düzenleme", trDesc: "Mevcut yazıyı silip yerine istediğinizi yazın — görüntü değil, gerçek metin.", en: "Real editing", enDesc: "Delete existing text and type new text — not an image overlay." },
    { icon: Zap, tr: "Hızlı ve kolay", trDesc: "Kurulum yok, hesap adımı yok; dosyanı bırak yeter.", en: "Fast and simple", enDesc: "Nothing to install, no setup — just drop your file." },
    { icon: Trash2, tr: "Dosyan sende kalır", trDesc: "Şifreli aktarılır, işlem biter bitmez sunucudan silinir.", en: "Your file stays yours", enDesc: "Transferred encrypted and deleted from the server right after." },
  ],
  "pdf-kesit-al": [
    { icon: Zap, tr: "Alanı seç, görsele al", trDesc: "Sayfadan istediğiniz bölgeyi kırpıp PNG/JPG olarak indirin.", en: "Crop to image", enDesc: "Select any area on the page and save it as PNG or JPG." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-imzala": [
    { icon: Zap, tr: "Çiz, yerine koy", trDesc: "İmzanızı fare ya da parmağınızla çizip belgenin istediğiniz yerine yerleştirin.", en: "Draw & place", enDesc: "Draw your signature and place it anywhere on the page." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-yorumla": [
    { icon: Zap, tr: "Vurgula & not al", trDesc: "Metni vurgulayın, kenara not düşün, ok ve kutu çizin.", en: "Highlight & annotate", enDesc: "Highlight text, add notes, draw arrows and boxes." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "udf-to-pdf": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP'tan indirdiğiniz .udf belgesini doğrudan tarayıcıda PDF'ye çevirin.", en: "No software needed", enDesc: "Convert a .udf file from UYAP straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-to-udf": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP belgesiyle ilgili işi doğrudan tarayıcıda yapın.", en: "No software needed", enDesc: "Handle UYAP documents straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "word-to-udf": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP belgesiyle ilgili işi doğrudan tarayıcıda yapın.", en: "No software needed", enDesc: "Handle UYAP documents straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "udf-to-word": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP belgesiyle ilgili işi doğrudan tarayıcıda yapın.", en: "No software needed", enDesc: "Handle UYAP documents straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "udf-viewer": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP belgesiyle ilgili işi doğrudan tarayıcıda yapın.", en: "No software needed", enDesc: "Handle UYAP documents straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "image-to-udf": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "UYAP belgesiyle ilgili işi doğrudan tarayıcıda yapın.", en: "No software needed", enDesc: "Handle UYAP documents straight in your browser." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "e-basvuru-uyumluluk": [
    { icon: Zap, tr: "Sınırı siz seçersiniz", trDesc: "Kurumun güncel kuralını girin; araç sabit sınır varsaymaz.", en: "You set the limits", enDesc: "Enter the institution's current rule; no fixed limit is assumed." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "dilekce-sablonlari": [
    { icon: Zap, tr: "Hazır şablonlar", trDesc: "Sık kullanılan dilekçeleri birkaç alanı doldurarak hazırlayın.", en: "Ready templates", enDesc: "Prepare common letters by filling in a few fields." },
    { icon: Zap, tr: "PDF veya UDF", trDesc: "Aynı dilekçeyi PDF ya da UYAP için UDF olarak indirin.", en: "PDF or UDF", enDesc: "Download the same letter as PDF or as UDF for UYAP." },
    { icon: Lock, tr: "Gizli", trDesc: "Bilgileriniz cihazınızdan hiç çıkmaz.", en: "Private", enDesc: "Your details never leave your device." },
  ],
  "kimlik-karti-tek-sayfa": [
    { icon: Zap, tr: "Gerçek boyut", trDesc: "İki yüz tek A4 sayfada, kimlik ölçüsünde ve alt alta.", en: "Real size", enDesc: "Both sides on one A4 page at true card size." },
    { icon: Zap, tr: "İsteğe bağlı filigran", trDesc: "Kimliğin kötüye kullanımını zorlaştırın.", en: "Optional watermark", enDesc: "Make misuse of the ID harder." },
    { icon: Lock, tr: "Gizli", trDesc: "Fotoğrafınız cihazınızdan hiç çıkmaz.", en: "Private", enDesc: "Your photo never leaves your device." },
  ],
  "txt-to-pdf": [
    { icon: Zap, tr: "Türkçe karakter sorunsuz", trDesc: "ş, ğ, ı, İ, ç, ö, ü eski ANSI dosyalarda bile doğru çıkar.", en: "Turkish characters intact", enDesc: "ş, ğ, ı, İ, ç, ö, ü come out right even from legacy ANSI files." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "markdown-to-pdf": [
    { icon: Zap, tr: "Biçim korunur", trDesc: "Başlık, liste, alıntı, kod ve kalın yazı PDF'te düzenli görünür.", en: "Formatting kept", enDesc: "Headings, lists, quotes, code and bold text look tidy in the PDF." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "rtf-to-pdf": [
    { icon: Zap, tr: "Türkçe karakter sorunsuz", trDesc: "RTF içindeki Türkçe harfler doğru çözülür.", en: "Turkish characters intact", enDesc: "Turkish letters inside RTF are decoded correctly." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "odt-to-pdf": [
    { icon: Zap, tr: "Program kurmadan", trDesc: "LibreOffice yüklemeden ODT belgenizi PDF yapın.", en: "No software needed", enDesc: "Turn ODT into PDF without installing LibreOffice." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "epub-to-pdf": [
    { icon: Zap, tr: "Okuma sırası korunur", trDesc: "Bölümler kitabın sırasıyla, yeni sayfalarda başlar.", en: "Reading order kept", enDesc: "Chapters follow the book's order, each starting on a new page." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-to-epub": [
    { icon: Zap, tr: "Telefonda rahat okuma", trDesc: "Metin ekrana sığar; başlıklara göre bölümlenir, içindekiler eklenir.", en: "Comfortable on a phone", enDesc: "Text reflows to the screen; split by headings with a table of contents." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-to-markdown": [
    { icon: Zap, tr: "Başlıklar otomatik", trDesc: "Yazı boyutuna göre başlık seviyeleri ve listeler bulunur.", en: "Headings detected", enDesc: "Heading levels and lists are found from the text sizes." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazından hiç çıkmaz.", en: "Private", enDesc: "Your file never leaves your device." },
  ],
  "pdf-sesli-oku": [
    { icon: Zap, tr: "Doğal Türkçe ses", trDesc: "Tarayıcının hazır sesinden daha akıcı yapay zekâ sesi.", en: "Natural Turkish voice", enDesc: "A more fluent AI voice than the built-in browser voice." },
    { icon: Zap, tr: "Sayfa aralığı ve hız", trDesc: "İstediğiniz sayfaları, istediğiniz hızda dinleyin.", en: "Page range and speed", enDesc: "Listen to the pages you want at the speed you want." },
    { icon: Lock, tr: "Gizli", trDesc: "Metin ve ses modeli cihazınızda çalışır; hiçbir şey gönderilmez.", en: "Private", enDesc: "Text and voice model run on your device; nothing is sent." },
  ],
  "ai-fotograf-studyosu": [
    { icon: Zap, tr: "Amaca göre hazır", trDesc: "Vesikalık, biyometrik, vize, CV ve LinkedIn ölçülerine tek tıkla kırpar; arka planı değiştirir.", en: "Ready for the purpose", enDesc: "Crops to ID, biometric, visa, CV and LinkedIn sizes in one click and swaps the background." },
    { icon: Zap, tr: "Uygunluk denetimi", trDesc: "Baş oranı, ifade ve ışığı kontrol edip uyarır.", en: "Suitability check", enDesc: "Checks head size, expression and light, and warns you." },
    { icon: Lock, tr: "Fotoğraf cihazından çıkmaz", trDesc: "Yapay zekâ cihazında çalışır; fotoğrafın sunucuya yüklenmez, saklanmaz.", en: "Photo stays on your device", enDesc: "The AI runs on your device; your photo is never uploaded or stored." },
  ],
  "cv-olustur": [
    { icon: Zap, tr: "Canlı önizleme, 30 şablon", trDesc: "Yazdıkça CV'niz yanda anında oluşur; Europass tarzı dahil 30 hazır şablon.", en: "Live preview, 30 templates", enDesc: "Your CV builds beside the form as you type; 30 ready templates incl. Europass-style." },
    { icon: Zap, tr: "ATS röntgeni ve ilan eşleştirici", trDesc: "PDF'inizin başvuru sistemlerince nasıl okunduğunu görün; ilandaki eksik anahtar kelimeleri bulun.", en: "ATS X-ray and job matcher", enDesc: "See how hiring systems read your PDF and find the keywords your CV is missing." },
    { icon: Zap, tr: "Boş alan çıktıya girmez", trDesc: "Doldurmadığınız bölümler PDF'e eklenmez, CV'niz temiz kalır.", en: "Empty fields stay out", enDesc: "Sections you skip are left out of the PDF, so the CV stays clean." },
    { icon: Lock, tr: "Bilgileriniz size kalır", trDesc: "CV'niz tarayıcınızda hazırlanır; sunucuya gönderilmez.", en: "Your details stay yours", enDesc: "Your CV is built in your browser and never sent to a server." },
  ],
  "gorsel-boyutlandir": [
    { icon: Zap, tr: "Tam ölçüye getir", trDesc: "Fotoğrafı piksel piksel istediğiniz genişlik ve yüksekliğe ayarlayın.", en: "Exact dimensions", enDesc: "Set a photo to the precise width and height you need." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "Never uploaded — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Görselin cihazından hiç çıkmaz.", en: "Private", enDesc: "Your image never leaves your device." },
  ],
};

/** Elle yazılmamış araçlar için katalogdan tutarlı bir üçlü üret. */
function generate(toolId: string): Benefit[] {
  const tool = TOOLS.find((t) => t.id === toolId);
  const onDevice = isOnDeviceTool(toolId);
  const Icon = tool?.Icon ?? Zap;

  const isi: Benefit = {
    icon: Icon,
    tr: tool?.tr.name ?? "Hazır",
    trDesc: tool?.tr.desc ?? "Dosyanı bırak, gerisini araç halletsin.",
    en: tool?.en.name ?? "Ready",
    enDesc: tool?.en.desc ?? "Drop your file and let the tool do the rest.",
  };

  const hiz: Benefit = onDevice
    ? {
        icon: Zap,
        tr: "Anında & ücretsiz",
        trDesc: "Sunucuya yüklenmez — cihazında saniyeler içinde biter.",
        en: "Instant & free",
        enDesc: "Never uploaded — finished on your device in seconds.",
      }
    : {
        icon: Zap,
        tr: "Hızlı ve kolay",
        trDesc: "Kurulum yok, hesap adımı yok; dosyanı bırak yeter.",
        en: "Fast and simple",
        enDesc: "Nothing to install, no setup — just drop your file.",
      };

  const gizlilik: Benefit = onDevice
    ? {
        icon: Lock,
        tr: "Tamamen gizli",
        trDesc: "Dosyan cihazında işlenir, sunucuya hiç gitmez.",
        en: "Fully private",
        enDesc: "Processed on your device, never uploaded.",
      }
    : {
        icon: Trash2,
        tr: "Dosyan sende kalır",
        trDesc: "Şifreli aktarılır, işlem biter bitmez sunucudan silinir.",
        en: "Your file stays yours",
        enDesc: "Transferred encrypted and deleted from the server right after.",
      };

  return [isi, hiz, gizlilik];
}

export function getToolBenefits(toolId: string): Benefit[] {
  const custom = CUSTOM[toolId];
  if (!custom) return generate(toolId);
  // İlk kutu aracın kendi işini anlatır → ikonu da aracın ikonu olsun; üç kutu
  // birden aynı şimşek simgesini taşımasın.
  const tool = TOOLS.find((t) => t.id === toolId);
  return tool ? [{ ...custom[0], icon: tool.Icon }, ...custom.slice(1)] : custom;
}
