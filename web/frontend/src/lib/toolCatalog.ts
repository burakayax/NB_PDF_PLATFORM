/**
 * ARAÇ KATALOĞU — her aracın adı, açıklaması, ikonu, kategorisi ve rengi.
 *
 * Tek kaynak: hem ana sayfadaki tam araç listesi hem de araçların yükleme
 * ekranındaki ortak panel (ToolUploadPanel) buradan beslenir. Daha önce ad ve
 * ikon listede, renk başka bir tabloda, yükleme ekranı ise her araçta ayrı ayrı
 * yazılıydı; araçların çoğu birbirinden farklı görünüyordu.
 *
 * Bileşen dosyasından AYRI tutulur: yükleme paneli bu veriyi okumak için ağır
 * bir bölüm bileşenini (ve framer-motion'ı) yüklemek zorunda kalmasın.
 *
 * Sınıf adları TAM yazılmalıdır (Tailwind derleme sırasında metni tarar);
 * `bg-${x}-500` gibi birleştirmeler üretimde renksiz kalır.
 */
import {
  ScanLine,
  Contrast,
  Shuffle,
  Scaling,
  FlipHorizontal2,
  ArrowRightLeft,
  Camera,
  Combine,
  Droplets,
  Eraser,
  FileImage,
  FileInput,
  FileOutput,
  FileSearch,
  FileCheck2,
  FileSpreadsheet,
  FileStack,
  FileText,
  Archive,
  Grid2x2,
  FileSignature,
  FileType2,
  Files,
  Globe,
  Hash,
  Highlighter,
  Image as ImageIcon,
  Languages,
  Layers,
  Layout,
  ListOrdered,
  Lock,
  Maximize2,
  MessageSquareText,
  Minimize2,
  PenTool,
  Presentation,
  Repeat,
  Scale,
  Scan,
  Scissors,
  Sparkles,
  SquareSplitHorizontal,
  Table2,
  Trash2,
  Unlock,
  Wrench,
  QrCode,
  ListTree,
  type LucideIcon,
  Gavel,
  FileUser,
  UserRound,
  ListChecks,
} from "lucide-react";

/** Araç kategorileri — ana sayfadaki listede başlık ve süzgeç olarak kullanılır. */
export type CategoryId = "ai" | "edit" | "scan" | "convert" | "security" | "legal";

export type Tool = {
  id: string;
  cat: CategoryId;
  Icon: LucideIcon;
  /** Üyelik istemeden, cihazda anında çalışır. */
  free?: boolean;
  /** Ücretsiz ama üye girişi ister (cihazda çalışır, maliyeti yoktur). */
  account?: boolean;
  ai?: boolean;
  tr: { name: string; desc: string };
  en: { name: string; desc: string };
};

export const TOOLS: Tool[] = [
  // ── Yapay zekâ ────────────────────────────────────────────────────────────
  {
    id: "pdf-ozetle", cat: "ai", Icon: Sparkles, ai: true,
    tr: { name: "PDF Özetle", desc: "Uzun belgenin ana fikrini birkaç saniyede çıkarır." },
    en: { name: "Summarize PDF", desc: "Pulls the key points out of a long document in seconds." },
  },
  {
    id: "pdf-sohbet", cat: "ai", Icon: MessageSquareText, ai: true,
    tr: { name: "PDF ile Sohbet", desc: "Belgeye soru sorun, cevabı kaynağıyla alın." },
    en: { name: "Chat with PDF", desc: "Ask the document questions and get sourced answers." },
  },
  {
    id: "pdf-ceviri", cat: "ai", Icon: Languages, ai: true,
    tr: { name: "PDF Çeviri", desc: "Düzeni bozmadan belgeyi başka dile çevirir." },
    en: { name: "Translate PDF", desc: "Translates the document while keeping its layout." },
  },
  {
    id: "pdf-sinav-olustur", cat: "ai", Icon: ListChecks, ai: true,
    tr: { name: "Soru / Test Oluştur", desc: "Belgenizden çoktan seçmeli ve doğru-yanlış sorular üretir; testi çözün ya da PDF indirin." },
    en: { name: "Quiz Maker", desc: "Creates multiple-choice and true/false questions from your document; take the quiz or download a PDF." },
  },
  {
    id: "pdf-karsilastir", cat: "ai", Icon: ArrowRightLeft, ai: true,
    tr: { name: "PDF Karşılaştır", desc: "İki sürüm arasındaki farkları madde madde gösterir." },
    en: { name: "Compare PDFs", desc: "Lists what changed between two versions." },
  },
  {
    id: "sozlesme-denetci", cat: "ai", Icon: Gavel, ai: true,
    tr: { name: "Sözleşme Denetçisi", desc: "Riskli maddeleri bulur, belgede boyar; detaylı denetim mevzuatı da kontrol eder." },
    en: { name: "Contract Auditor", desc: "Finds and highlights risky clauses; the detailed audit also checks current law." },
  },
  {
    id: "ai-fotograf-studyosu", cat: "ai", Icon: UserRound, ai: true,
    tr: { name: "AI Fotoğraf Stüdyosu", desc: "Vesikalık, biyometrik, CV ve LinkedIn fotoğrafınızı hazırlar; arka planı değiştirir. Fotoğraf cihazınızdan çıkmaz." },
    en: { name: "AI Photo Studio", desc: "Prepares ID, biometric, CV and LinkedIn photos and swaps the background. The photo never leaves your device." },
  },
  {
    id: "pdf-veri-cikar", cat: "ai", Icon: Table2, ai: true,
    tr: { name: "PDF Veri Çıkar", desc: "Fatura ve formlardaki bilgileri tabloya döker." },
    en: { name: "Extract Data", desc: "Turns invoice and form fields into a clean table." },
  },
  {
    id: "ai-toplu-islem", cat: "ai", Icon: FileStack, ai: true,
    tr: { name: "AI Toplu İşlem", desc: "Onlarca belgeyi tek seferde özetler veya işler." },
    en: { name: "AI Batch", desc: "Summarizes or processes dozens of files at once." },
  },
  {
    id: "taranmis-pdf-ocr", cat: "scan", Icon: FileSearch, account: true,
    tr: { name: "Taranmış PDF (OCR)", desc: "Taranmış sayfadaki yazıyı okunabilir metne çevirir." },
    en: { name: "Scanned PDF (OCR)", desc: "Turns scanned pages into text you can read and copy." },
  },
  {
    id: "aranabilir-pdf", cat: "scan", Icon: FileCheck2, account: true,
    tr: { name: "Aranabilir PDF", desc: "Taranmış belgede Ctrl+F ile arama yapabilir hale gelin." },
    en: { name: "Searchable PDF", desc: "Make a scanned document findable with Ctrl+F." },
  },

  // ── Düzenle ───────────────────────────────────────────────────────────────
  {
    id: "pdf-duzenle", cat: "edit", Icon: FileType2,
    tr: { name: "PDF Düzenle", desc: "Mevcut yazıyı gerçekten silip yerine yenisini yazın." },
    en: { name: "Edit PDF", desc: "Really delete existing text and type new text in its place." },
  },
  {
    id: "cv-olustur", cat: "edit", Icon: FileUser, account: true,
    tr: { name: "CV Oluştur", desc: "30 hazır şablondan seçin, bilgilerinizi girin; CV'niz canlı oluşsun, ATS röntgeniyle kontrol edin, PDF veya Word indirin." },
    en: { name: "CV Maker", desc: "Pick from 30 templates, fill in your details, watch your CV build live, check it with the ATS X-ray and download PDF or Word." },
  },
  {
    id: "pdf-imzala", cat: "edit", Icon: PenTool, free: true,
    tr: { name: "PDF İmzala", desc: "İmzanızı çizip belgenin istediğiniz yerine koyun." },
    en: { name: "Sign PDF", desc: "Draw your signature and place it anywhere on the page." },
  },
  {
    id: "pdf-yorumla", cat: "edit", Icon: Highlighter, free: true,
    tr: { name: "PDF İşaretle", desc: "Vurgulayın, not düşün, ok ve kutu çizin." },
    en: { name: "Markup PDF", desc: "Highlight, add notes, draw arrows and boxes." },
  },
  {
    id: "merge", cat: "edit", Icon: Combine, free: true,
    tr: { name: "PDF Birleştir", desc: "Birden çok dosyayı sıralayıp tek PDF yapın." },
    en: { name: "Merge PDF", desc: "Order several files and combine them into one PDF." },
  },
  {
    id: "split", cat: "edit", Icon: SquareSplitHorizontal, free: true,
    tr: { name: "PDF Böl", desc: "İstediğiniz sayfaları ayrı bir dosya olarak alın." },
    en: { name: "Split PDF", desc: "Pull the pages you choose into a separate file." },
  },
  {
    id: "organize-pdf", cat: "edit", Icon: ListOrdered, free: true,
    tr: { name: "Sayfa Sırala", desc: "Sayfaların sırasını sürükleyerek değiştirin." },
    en: { name: "Reorder Pages", desc: "Drag pages into the order you want." },
  },
  {
    id: "delete-pages", cat: "edit", Icon: Trash2, free: true,
    tr: { name: "Sayfa Sil", desc: "İstemediğiniz sayfaları belgeden çıkarın." },
    en: { name: "Delete Pages", desc: "Remove the pages you don't want." },
  },
  {
    id: "rotate-pdf", cat: "edit", Icon: Repeat, free: true,
    tr: { name: "PDF Döndür", desc: "Yan duran sayfaları düz çevirin." },
    en: { name: "Rotate PDF", desc: "Turn sideways pages the right way up." },
  },
  {
    id: "pdf-kesit-al", cat: "edit", Icon: Scissors, free: true,
    tr: { name: "PDF'ten Kesit Al", desc: "Sayfadan bir alan seçip görsel olarak kaydedin." },
    en: { name: "Snip to Image", desc: "Select an area on the page and save it as an image." },
  },
  {
    id: "compress", cat: "edit", Icon: Minimize2,
    tr: { name: "PDF Sıkıştır", desc: "Dosya boyutunu düşürüp e-postaya sığdırın." },
    en: { name: "Compress PDF", desc: "Shrink the file so it fits in an email." },
  },
  {
    id: "gorsel-sikistir", cat: "edit", Icon: FileImage, free: true,
    tr: { name: "Görsel Sıkıştır", desc: "Fotoğrafları kaliteyi koruyarak küçültün." },
    en: { name: "Compress Image", desc: "Make photos smaller while keeping them sharp." },
  },
  {
    id: "gorsel-boyutlandir", cat: "edit", Icon: Maximize2, free: true,
    tr: { name: "Görsel Boyutlandır", desc: "Fotoğrafı istediğiniz ölçüye getirin." },
    en: { name: "Resize Image", desc: "Set a photo to exactly the size you need." },
  },
  {
    id: "extract-images", cat: "edit", Icon: ImageIcon,
    tr: { name: "Görselleri Çıkar", desc: "Belgedeki tüm fotoğrafları ayrı dosya olarak alın." },
    en: { name: "Extract Images", desc: "Save every picture in the document as its own file." },
  },
  {
    id: "page-numbers", cat: "edit", Icon: Hash,
    tr: { name: "Sayfa Numarası", desc: "Belgeye düzgün sayfa numaraları ekleyin." },
    en: { name: "Page Numbers", desc: "Add clean page numbers to the document." },
  },
  {
    id: "watermark", cat: "edit", Icon: Droplets,
    tr: { name: "Filigran Ekle", desc: "Sayfalara kendi damganızı veya yazınızı basın." },
    en: { name: "Add Watermark", desc: "Stamp your own mark or text onto the pages." },
  },
  {
    id: "imza-iste", cat: "security", Icon: FileSignature,
    tr: { name: "İmza İste", desc: "Belgeyi karşı tarafa imzalatın; denetim kayıtlı imzalı kopya gelsin." },
    en: { name: "Request Signature", desc: "Send a document out for signature and get an audited signed copy." },
  },
  {
    id: "tiff-to-pdf", cat: "convert", Icon: FileType2, free: true,
    tr: { name: "TIFF'ten PDF'e", desc: "Tek ya da çok sayfalı TIFF taramalarını PDF'e çevirin; sayfa sırası korunur." },
    en: { name: "TIFF'ten PDF'e", desc: "Turn single or multi-page TIFF scans into a PDF; page order is kept." },
  },
  {
    id: "pdf-ust-alt-bilgi", cat: "edit", Icon: Hash, free: true,
    tr: { name: "Üst / Alt Bilgi Ekle", desc: "Her sayfanın üstüne ve altına başlık, tarih, dosya adı ve sayfa numarası yazın." },
    en: { name: "Add Header / Footer", desc: "Put a title, date, file name and page number at the top and bottom of every page." },
  },
  {
    id: "pdf-sesli-oku", cat: "convert", Icon: Scale, free: true,
    tr: { name: "Sesli Okuma", desc: "PDF'i ya da yazdığınız metni doğal bir Türkçe sesle dinleyin; ses dosyası olarak indirin." },
    en: { name: "Read Aloud", desc: "Listen to a PDF or your text in a natural Turkish voice; download it as an audio file." },
  },
  {
    id: "kimlik-karti-tek-sayfa", cat: "edit", Icon: Scale, free: true,
    tr: { name: "Kimlik Ön–Arka Tek Sayfa", desc: "Kimlik, ehliyet veya pasaportun iki yüzünü tek A4 sayfaya gerçek boyutta koyun." },
    en: { name: "ID Front+Back on One Page", desc: "Put both sides of an ID, licence or passport on one A4 page at real size." },
  },
  {
    id: "sayfa-duzeni", cat: "edit", Icon: Grid2x2, free: true,
    tr: { name: "PDF Sayfa Düzeni", desc: "2/4/8 sayfayı tek kâğıda sığdırın ya da kitapçık dizin." },
    en: { name: "PDF Page Layout", desc: "Fit 2/4/8 pages on one sheet, or impose a booklet." },
  },
  {
    id: "pdf-to-pdfa", cat: "edit", Icon: Archive,
    tr: { name: "PDF'ten PDF/A'ya (Arşiv)", desc: "Kurumların istediği ISO arşiv biçimi; yazı tipleri gömülür." },
    en: { name: "PDF to PDF/A (Archive)", desc: "The ISO archival format institutions ask for; fonts embedded." },
  },
  {
    id: "pdf-qr-ekle", cat: "edit", Icon: QrCode, account: true,
    tr: { name: "PDF'ye QR Kod Ekle", desc: "Link, kişi kartı, WhatsApp, Wi-Fi QR kodunu sayfada istediğin yere koy." },
    en: { name: "Add QR Code to PDF", desc: "Place a link, contact card, WhatsApp or Wi-Fi QR code anywhere on the page." },
  },
  {
    id: "pdf-birlestir-icindekiler", cat: "edit", Icon: ListTree, account: true,
    tr: { name: "Birleştir + İçindekiler", desc: "PDF'leri birleştirir; tıklanabilir içindekiler sayfası ve yer imleri ekler." },
    en: { name: "Merge + Table of Contents", desc: "Merges PDFs and adds a clickable contents page and bookmarks." },
  },
  {
    id: "ustveri-temizle", cat: "edit", Icon: Eraser, account: true,
    tr: { name: "PDF Gizli Bilgi Temizle", desc: "Yazar, program, tarih, XMP ve fotoğraf GPS izlerini siler." },
    en: { name: "Remove PDF Metadata", desc: "Strips author, software, dates, XMP and photo GPS traces." },
  },
  {
    id: "form-doldur", cat: "edit", Icon: FileText, account: true,
    tr: { name: "PDF Form Doldur", desc: "Doldurulabilir form alanlarını bulur ve cihazınızda doldurur." },
    en: { name: "Fill PDF Form", desc: "Detects fillable fields and fills them on your device." },
  },
  {
    id: "grayscale-pdf", cat: "edit", Icon: Contrast,
    tr: { name: "PDF Siyah-Beyaz Yap", desc: "Renkli PDF'i siyah-beyaza çevirir; metin seçilebilir kalır." },
    en: { name: "Grayscale PDF", desc: "Turns a colour PDF black-and-white; text stays selectable." },
  },
  {
    id: "resize-pdf", cat: "edit", Icon: Scaling,
    tr: { name: "PDF Sayfa Boyutunu Değiştir", desc: "Sayfaları A4, A5, Letter veya özel ölçüye getirir." },
    en: { name: "Resize PDF Pages", desc: "Fits pages to A4, A5, Letter or a custom size." },
  },
  {
    id: "flip-pdf", cat: "edit", Icon: FlipHorizontal2,
    tr: { name: "PDF Çevir (Ayna)", desc: "Sayfaları yatay veya dikey ayna gibi çevirir." },
    en: { name: "Flip PDF", desc: "Mirrors pages horizontally or vertically." },
  },
  {
    id: "alternate-mix-pdf", cat: "edit", Icon: Shuffle,
    tr: { name: "PDF Sırayla Birleştir", desc: "İki PDF'in sayfalarını sırayla serpiştirir (çift taraflı tarama)." },
    en: { name: "Alternate & Mix PDF", desc: "Interleaves the pages of two PDFs (double-sided scans)." },
  },
  {
    id: "deskew-pdf", cat: "edit", Icon: ScanLine,
    tr: { name: "PDF Eğri Taramayı Düzelt", desc: "Eğri taranmış sayfaları düzeltir; yazı katmanlı sayfalara dokunmaz." },
    en: { name: "Deskew PDF", desc: "Straightens crooked scanned pages; leaves text-layer pages alone." },
  },
  {
    id: "flatten-pdf", cat: "edit", Icon: Layers,
    tr: { name: "PDF Düzleştir", desc: "Form ve katmanları sabitleyip değiştirilemez yapın." },
    en: { name: "Flatten PDF", desc: "Lock forms and layers so nothing can shift." },
  },

  // ── Dönüştür ──────────────────────────────────────────────────────────────
  {
    id: "pdf-to-word", cat: "convert", Icon: FileText, account: true,
    tr: { name: "PDF'ten Word'e", desc: "Düzenlenebilir Word belgesine çevirin." },
    en: { name: "PDF'ten Word'e", desc: "Convert into an editable Word document." },
  },
  {
    id: "word-to-pdf", cat: "convert", Icon: FileOutput, account: true,
    tr: { name: "Word'den PDF'e", desc: "Word dosyasını herkesin açabildiği PDF yapın." },
    en: { name: "Word'den PDF'e", desc: "Turn a Word file into a PDF anyone can open." },
  },
  {
    id: "pdf-to-excel", cat: "convert", Icon: FileSpreadsheet,
    tr: { name: "PDF'ten Excel'e", desc: "Tabloları hesaplanabilir Excel sayfasına aktarın." },
    en: { name: "PDF'ten Excel'e", desc: "Move tables into a spreadsheet you can calculate with." },
  },
  {
    id: "excel-to-pdf", cat: "convert", Icon: FileInput,
    tr: { name: "Excel'den PDF'e", desc: "Tabloyu bozulmadan paylaşılabilir PDF yapın." },
    en: { name: "Excel'den PDF'e", desc: "Share a spreadsheet as a PDF that keeps its layout." },
  },
  {
    id: "pdf-to-ppt", cat: "convert", Icon: Presentation,
    tr: { name: "PDF'ten PowerPoint'e", desc: "Sayfaları düzenlenebilir sunum slaytlarına çevirin." },
    en: { name: "PDF'ten PowerPoint'e", desc: "Turn pages into editable presentation slides." },
  },
  {
    id: "ppt-to-pdf", cat: "convert", Icon: Layout,
    tr: { name: "PowerPoint'ten PDF'e", desc: "Sunumu her cihazda aynı görünen PDF yapın." },
    en: { name: "PowerPoint'ten PDF'e", desc: "Make a deck that looks the same on every device." },
  },
  {
    id: "pdf-to-image", cat: "convert", Icon: Files, account: true,
    tr: { name: "PDF'ten Görsele", desc: "Her sayfayı ayrı bir fotoğraf olarak kaydedin." },
    en: { name: "PDF to Image", desc: "Save each page as its own picture." },
  },
  {
    id: "image-to-pdf", cat: "convert", Icon: Scan, free: true,
    tr: { name: "Görselden PDF'e", desc: "Fotoğrafları sıralayıp tek bir PDF'te toplayın." },
    en: { name: "Image to PDF", desc: "Order your photos and collect them in one PDF." },
  },
  {
    id: "belge-tara", cat: "scan", Icon: Camera, free: true,
    tr: { name: "Belge Tara", desc: "Telefonun kamerasıyla çekip düzgün bir PDF'e çevirin." },
    en: { name: "Scan Document", desc: "Shoot with your phone camera and get a clean PDF." },
  },
  {
    id: "html-to-pdf", cat: "convert", Icon: Globe,
    tr: { name: "HTML'den PDF'e", desc: "Bir web sayfasını olduğu gibi PDF'e alın." },
    en: { name: "HTML'den PDF'e", desc: "Capture a web page as a PDF, exactly as it looks." },
  },
  {
    id: "pdf-to-text", cat: "convert", Icon: FileType2,
    tr: { name: "PDF'ten Metne", desc: "Belgedeki tüm yazıyı düz metin olarak alın." },
    en: { name: "PDF to Text", desc: "Get all the writing as plain text." },
  },
  {
    id: "txt-to-pdf", cat: "convert", Icon: FileType2, free: true,
    tr: { name: "TXT'den PDF'e", desc: "Metin dosyasını Türkçe karakterleri bozmadan PDF yapın." },
    en: { name: "TXT'den PDF'e", desc: "Turn a text file into a PDF without breaking Turkish characters." },
  },
  {
    id: "markdown-to-pdf", cat: "convert", Icon: FileText, free: true,
    tr: { name: "Markdown'dan PDF'e", desc: "Markdown (.md) notunuzu başlık ve listeleriyle PDF yapın." },
    en: { name: "Markdown'dan PDF'e", desc: "Turn a Markdown (.md) note into a PDF with headings and lists." },
  },
  {
    id: "rtf-to-pdf", cat: "convert", Icon: FileType2, free: true,
    tr: { name: "RTF'den PDF'e", desc: "RTF belgesini Türkçe karakterli PDF'e çevirin." },
    en: { name: "RTF'den PDF'e", desc: "Convert an RTF document to PDF with Turkish characters intact." },
  },
  {
    id: "odt-to-pdf", cat: "convert", Icon: FileOutput, free: true,
    tr: { name: "ODT'den PDF'e", desc: "LibreOffice ODT belgesini PDF'e çevirin." },
    en: { name: "ODT'den PDF'e", desc: "Convert a LibreOffice ODT document to PDF." },
  },
  {
    id: "epub-to-pdf", cat: "convert", Icon: FileOutput, free: true,
    tr: { name: "EPUB'tan PDF'e", desc: "DRM'siz EPUB e-kitabını PDF'e çevirin." },
    en: { name: "EPUB'tan PDF'e", desc: "Convert a DRM-free EPUB e-book to PDF." },
  },
  {
    id: "pdf-to-epub", cat: "convert", Icon: FileInput, free: true,
    tr: { name: "PDF'ten EPUB'a", desc: "Metin PDF'ini telefonda okunur EPUB e-kitaba çevirin." },
    en: { name: "PDF'ten EPUB'a", desc: "Turn a text PDF into an EPUB e-book readable on a phone." },
  },
  {
    id: "pdf-to-markdown", cat: "convert", Icon: FileType2, free: true,
    tr: { name: "PDF'ten Markdown'a", desc: "PDF'i başlık ve listeleriyle Markdown'a çevirin." },
    en: { name: "PDF'ten Markdown'a", desc: "Turn a PDF into Markdown with its headings and lists." },
  },

  // ── Güvenlik ──────────────────────────────────────────────────────────────
  {
    id: "encrypt", cat: "security", Icon: Lock,
    tr: { name: "PDF Şifrele", desc: "Belgeyi parolayla koruyup izinleri belirleyin." },
    en: { name: "Encrypt PDF", desc: "Protect the file with a password and set permissions." },
  },
  {
    id: "unlock-pdf", cat: "security", Icon: Unlock,
    tr: { name: "Şifre Kaldır", desc: "Parolasını bildiğiniz belgenin kilidini açın." },
    en: { name: "Unlock PDF", desc: "Remove the password from a file you own." },
  },
  {
    id: "hassas-veri-gizle", cat: "security", Icon: Eraser, ai: true,
    tr: { name: "Hassas Veri Gizle", desc: "Kimlik, IBAN ve isimleri geri alınamaz şekilde karartın." },
    en: { name: "Redact PDF", desc: "Black out IDs, account numbers and names for good." },
  },
  {
    id: "udf-to-pdf", cat: "legal", Icon: Scale, free: true,
    tr: { name: "UDF'den PDF'e", desc: "UYAP'tan inen .udf belgesini program kurmadan PDF'ye çevirin." },
    en: { name: "UDF'den PDF'e", desc: "Turn a .udf file from UYAP into a PDF — no software needed." },
  },
  {
    id: "pdf-to-udf", cat: "legal", Icon: Scale, free: true,
    tr: { name: "PDF'ten UDF'ye", desc: "Metin içeren PDF'yi UYAP'ta açılabilen .udf belgesine çevirin." },
    en: { name: "PDF'ten UDF'ye", desc: "Turn a text PDF into a .udf document that opens in UYAP." },
  },
  {
    id: "word-to-udf", cat: "legal", Icon: Scale, free: true,
    tr: { name: "Word'den UDF'ye", desc: "Word (.docx) dilekçenizi biçimiyle birlikte .udf'ye çevirin." },
    en: { name: "Word'den UDF'ye", desc: "Convert a Word (.docx) petition to .udf, keeping its formatting." },
  },
  {
    id: "udf-to-word", cat: "legal", Icon: Scale, free: true,
    tr: { name: "UDF'den Word'e", desc: "UYAP belgesini düzenlenebilir Word dosyasına çevirin." },
    en: { name: "UDF'den Word'e", desc: "Turn a UYAP document into an editable Word file." },
  },
  {
    id: "udf-viewer", cat: "legal", Icon: Scale, free: true,
    tr: { name: "UDF Görüntüleyici", desc: "UDF dosyasını program kurmadan tarayıcıda açıp okuyun." },
    en: { name: "UDF Viewer", desc: "Open and read a UDF file in your browser — nothing to install." },
  },
  {
    id: "e-basvuru-uyumluluk", cat: "legal", Icon: Scale, free: true,
    tr: { name: "E-başvuru Uyumluluk Kontrolü", desc: "PDF'nin boyut, sayfa ve A4 sınırlarına uyup uymadığını denetleyin; düzeltin." },
    en: { name: "Filing Compliance Check", desc: "Check a PDF against size, page and A4 limits you choose, and fix it." },
  },
  {
    id: "dilekce-sablonlari", cat: "legal", Icon: Scale, free: true,
    tr: { name: "Dilekçe Şablonları", desc: "Hazır dilekçe ve form şablonunu doldurun; PDF veya UDF olarak indirin." },
    en: { name: "Petition Templates", desc: "Fill in a ready-made letter template and download it as PDF or UDF." },
  },
  {
    id: "image-to-udf", cat: "legal", Icon: Scale, free: true,
    tr: { name: "Görsel ve TIFF'ten UDF'ye", desc: "JPG, PNG ve çok sayfalı TIFF'i UDF belgesine çevirin." },
    en: { name: "Image and TIFF to UDF", desc: "Turn JPG, PNG and multi-page TIFF into a UDF document." },
  },
  {
    id: "repair-pdf", cat: "edit", Icon: Wrench,
    tr: { name: "PDF Onar", desc: "Açılmayan veya bozulmuş dosyayı kurtarın." },
    en: { name: "Repair PDF", desc: "Rescue a file that won't open or looks broken." },
  },
];

/**
 * ARAÇ RENKLERİ — her aracın kendi rengi var; ikon, renkli bir degrade kutunun
 * içinde durur. Kategori rengi yalnızca başlık ve süzgeç için kullanılır;
 * kartlar kategori içinde tek düze görünmesin diye araç bazında renklendirilir.
 *
 * Sınıf adları TAM yazılmalıdır (Tailwind derleme sırasında metni tarar);
 * `bg-${x}-500` gibi birleştirmeler üretimde renksiz kalır.
 */
export type HueId =
  | "violet" | "fuchsia" | "purple" | "indigo" | "blue" | "sky"
  | "cyan" | "teal" | "emerald" | "lime" | "amber" | "orange" | "rose";

export const HUES: Record<HueId, { tile: string; icon: string; ring: string; glow: string }> = {
  violet: {
    tile: "bg-gradient-to-br from-violet-500/30 to-violet-500/5 ring-violet-400/25",
    icon: "text-violet-200", ring: "group-hover:border-violet-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(139,92,246,0.65)]",
  },
  fuchsia: {
    tile: "bg-gradient-to-br from-fuchsia-500/30 to-fuchsia-500/5 ring-fuchsia-400/25",
    icon: "text-fuchsia-200", ring: "group-hover:border-fuchsia-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(217,70,239,0.65)]",
  },
  purple: {
    tile: "bg-gradient-to-br from-purple-500/30 to-purple-500/5 ring-purple-400/25",
    icon: "text-purple-200", ring: "group-hover:border-purple-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(168,85,247,0.65)]",
  },
  indigo: {
    tile: "bg-gradient-to-br from-indigo-500/30 to-indigo-500/5 ring-indigo-400/25",
    icon: "text-indigo-200", ring: "group-hover:border-indigo-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(99,102,241,0.65)]",
  },
  blue: {
    tile: "bg-gradient-to-br from-blue-500/30 to-blue-500/5 ring-blue-400/25",
    icon: "text-blue-200", ring: "group-hover:border-blue-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(59,130,246,0.65)]",
  },
  sky: {
    tile: "bg-gradient-to-br from-sky-500/30 to-sky-500/5 ring-sky-400/25",
    icon: "text-sky-200", ring: "group-hover:border-sky-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(56,189,248,0.65)]",
  },
  cyan: {
    tile: "bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 ring-cyan-400/25",
    icon: "text-cyan-200", ring: "group-hover:border-cyan-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(34,211,238,0.65)]",
  },
  teal: {
    tile: "bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-teal-400/25",
    icon: "text-teal-200", ring: "group-hover:border-teal-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(20,184,166,0.65)]",
  },
  emerald: {
    tile: "bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 ring-emerald-400/25",
    icon: "text-emerald-200", ring: "group-hover:border-emerald-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(16,185,129,0.65)]",
  },
  lime: {
    tile: "bg-gradient-to-br from-lime-500/30 to-lime-500/5 ring-lime-400/25",
    icon: "text-lime-200", ring: "group-hover:border-lime-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(132,204,22,0.65)]",
  },
  amber: {
    tile: "bg-gradient-to-br from-amber-500/30 to-amber-500/5 ring-amber-400/25",
    icon: "text-amber-200", ring: "group-hover:border-amber-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(245,158,11,0.65)]",
  },
  orange: {
    tile: "bg-gradient-to-br from-orange-500/30 to-orange-500/5 ring-orange-400/25",
    icon: "text-orange-200", ring: "group-hover:border-orange-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(249,115,22,0.65)]",
  },
  rose: {
    tile: "bg-gradient-to-br from-rose-500/30 to-rose-500/5 ring-rose-400/25",
    icon: "text-rose-200", ring: "group-hover:border-rose-400/45",
    glow: "group-hover:shadow-[0_20px_44px_-22px_rgba(244,63,94,0.65)]",
  },
};

/** Araç → renk. Anlamla eşleşir: Word mavi, Excel yeşil, PowerPoint turuncu,
 *  güvenlik yeşil/kırmızı, yapay zekâ mor tonları. */
export const TOOL_HUE: Record<string, HueId> = {
  // Yapay zekâ
  "pdf-ozetle": "fuchsia",
  "ai-fotograf-studyosu": "rose",
  "pdf-sohbet": "purple",
  "pdf-ceviri": "indigo",
  "pdf-sinav-olustur": "amber",
  "pdf-karsilastir": "violet",
  "sozlesme-denetci": "fuchsia",
  "pdf-veri-cikar": "teal",
  "ai-toplu-islem": "purple",
  "taranmis-pdf-ocr": "cyan",
  "aranabilir-pdf": "sky",
  // Düzenle
  "pdf-duzenle": "amber",
  "cv-olustur": "sky",
  "pdf-imzala": "rose",
  "pdf-yorumla": "amber",
  merge: "violet",
  split: "indigo",
  "organize-pdf": "sky",
  "delete-pages": "rose",
  "rotate-pdf": "cyan",
  "pdf-kesit-al": "lime",
  compress: "emerald",
  "gorsel-sikistir": "emerald",
  "gorsel-boyutlandir": "lime",
  "extract-images": "fuchsia",
  "page-numbers": "blue",
  watermark: "sky",
  "flatten-pdf": "indigo",
  "grayscale-pdf": "sky",
  "resize-pdf": "orange",
  "flip-pdf": "fuchsia",
  "alternate-mix-pdf": "violet",
  "deskew-pdf": "cyan",
  "form-doldur": "emerald",
  "ustveri-temizle": "rose",
  "pdf-qr-ekle": "cyan",
  "pdf-birlestir-icindekiler": "violet",
  "pdf-to-pdfa": "amber",
  "sayfa-duzeni": "lime",
  "imza-iste": "violet",
  // Dönüştür
  "pdf-to-word": "blue",
  "word-to-pdf": "blue",
  "pdf-to-excel": "emerald",
  "excel-to-pdf": "emerald",
  "pdf-to-ppt": "orange",
  "ppt-to-pdf": "orange",
  "pdf-to-image": "cyan",
  "image-to-pdf": "cyan",
  "belge-tara": "teal",
  "html-to-pdf": "sky",
  "pdf-to-text": "violet",
  "udf-to-pdf": "indigo",
  "pdf-to-udf": "indigo",
  "word-to-udf": "indigo",
  "udf-to-word": "indigo",
  "udf-viewer": "indigo",
  "image-to-udf": "indigo",
  "e-basvuru-uyumluluk": "indigo",
  "dilekce-sablonlari": "indigo",
  "kimlik-karti-tek-sayfa": "teal",
  "pdf-sesli-oku": "cyan",
  "pdf-ust-alt-bilgi": "blue",
  "tiff-to-pdf": "cyan",
  "txt-to-pdf": "violet",
  "markdown-to-pdf": "violet",
  "rtf-to-pdf": "blue",
  "odt-to-pdf": "blue",
  "epub-to-pdf": "orange",
  "pdf-to-epub": "orange",
  "pdf-to-markdown": "violet",
  // Güvenlik
  encrypt: "emerald",
  "unlock-pdf": "teal",
  "hassas-veri-gizle": "rose",
  "repair-pdf": "amber",
};
