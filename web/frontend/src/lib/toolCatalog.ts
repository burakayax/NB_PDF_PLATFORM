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
  type LucideIcon,
} from "lucide-react";

/** Araç kategorileri — ana sayfadaki listede başlık ve süzgeç olarak kullanılır. */
export type CategoryId = "ai" | "edit" | "scan" | "convert" | "security";

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
    id: "pdf-karsilastir", cat: "ai", Icon: ArrowRightLeft, ai: true,
    tr: { name: "PDF Karşılaştır", desc: "İki sürüm arasındaki farkları madde madde gösterir." },
    en: { name: "Compare PDFs", desc: "Lists what changed between two versions." },
  },
  {
    id: "pdf-veri-cikar", cat: "ai", Icon: Table2, ai: true,
    tr: { name: "PDF Veri Çıkar", desc: "Fatura ve formlardaki bilgileri tabloya döker." },
    en: { name: "Extract Data", desc: "Turns invoice and form fields into a clean table." },
  },
  {
    id: "ai-toplu-islem", cat: "ai", Icon: FileStack, ai: true,
    tr: { name: "Toplu İşle", desc: "Onlarca belgeyi tek seferde özetler veya işler." },
    en: { name: "Batch Process", desc: "Summarizes or processes dozens of files at once." },
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
    tr: { name: "Sayfaları Düzenle", desc: "Sayfaların sırasını sürükleyerek değiştirin." },
    en: { name: "Organize Pages", desc: "Drag pages into the order you want." },
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
    id: "sayfa-duzeni", cat: "edit", Icon: Grid2x2, free: true,
    tr: { name: "PDF Sayfa Düzeni", desc: "2/4/8 sayfayı tek kâğıda sığdırın ya da kitapçık dizin." },
    en: { name: "PDF Page Layout", desc: "Fit 2/4/8 pages on one sheet, or impose a booklet." },
  },
  {
    id: "pdf-to-pdfa", cat: "edit", Icon: Archive,
    tr: { name: "PDF → PDF/A (Arşiv)", desc: "Kurumların istediği ISO arşiv biçimi; yazı tipleri gömülür." },
    en: { name: "PDF to PDF/A (Archive)", desc: "The ISO archival format institutions ask for; fonts embedded." },
  },
  {
    id: "ustveri-temizle", cat: "edit", Icon: Eraser, account: true,
    tr: { name: "PDF Üstveri Temizle", desc: "Yazar, program, tarih, XMP ve fotoğraf GPS izlerini siler." },
    en: { name: "Remove PDF Metadata", desc: "Strips author, software, dates, XMP and photo GPS traces." },
  },
  {
    id: "form-doldur", cat: "edit", Icon: FileText, account: true,
    tr: { name: "PDF Form Doldur", desc: "Doldurulabilir form alanlarını bulur ve cihazınızda doldurur." },
    en: { name: "Fill PDF Form", desc: "Detects fillable fields and fills them on your device." },
  },
  {
    id: "flatten-pdf", cat: "edit", Icon: Layers,
    tr: { name: "PDF Düzleştir", desc: "Form ve katmanları sabitleyip değiştirilemez yapın." },
    en: { name: "Flatten PDF", desc: "Lock forms and layers so nothing can shift." },
  },

  // ── Dönüştür ──────────────────────────────────────────────────────────────
  {
    id: "pdf-to-word", cat: "convert", Icon: FileText,
    tr: { name: "PDF → Word", desc: "Düzenlenebilir Word belgesine çevirin." },
    en: { name: "PDF → Word", desc: "Convert into an editable Word document." },
  },
  {
    id: "word-to-pdf", cat: "convert", Icon: FileOutput,
    tr: { name: "Word → PDF", desc: "Word dosyasını herkesin açabildiği PDF yapın." },
    en: { name: "Word → PDF", desc: "Turn a Word file into a PDF anyone can open." },
  },
  {
    id: "pdf-to-excel", cat: "convert", Icon: FileSpreadsheet,
    tr: { name: "PDF → Excel", desc: "Tabloları hesaplanabilir Excel sayfasına aktarın." },
    en: { name: "PDF → Excel", desc: "Move tables into a spreadsheet you can calculate with." },
  },
  {
    id: "excel-to-pdf", cat: "convert", Icon: FileInput,
    tr: { name: "Excel → PDF", desc: "Tabloyu bozulmadan paylaşılabilir PDF yapın." },
    en: { name: "Excel → PDF", desc: "Share a spreadsheet as a PDF that keeps its layout." },
  },
  {
    id: "pdf-to-ppt", cat: "convert", Icon: Presentation,
    tr: { name: "PDF → PowerPoint", desc: "Sayfaları düzenlenebilir sunum slaytlarına çevirin." },
    en: { name: "PDF → PowerPoint", desc: "Turn pages into editable presentation slides." },
  },
  {
    id: "ppt-to-pdf", cat: "convert", Icon: Layout,
    tr: { name: "PowerPoint → PDF", desc: "Sunumu her cihazda aynı görünen PDF yapın." },
    en: { name: "PowerPoint → PDF", desc: "Make a deck that looks the same on every device." },
  },
  {
    id: "pdf-to-image", cat: "convert", Icon: Files,
    tr: { name: "PDF → Görsel", desc: "Her sayfayı ayrı bir fotoğraf olarak kaydedin." },
    en: { name: "PDF → Image", desc: "Save each page as its own picture." },
  },
  {
    id: "image-to-pdf", cat: "convert", Icon: Scan, free: true,
    tr: { name: "Görsel → PDF", desc: "Fotoğrafları sıralayıp tek bir PDF'te toplayın." },
    en: { name: "Image → PDF", desc: "Order your photos and collect them in one PDF." },
  },
  {
    id: "belge-tara", cat: "scan", Icon: Camera, free: true,
    tr: { name: "Belge Tara", desc: "Telefonun kamerasıyla çekip düzgün bir PDF'e çevirin." },
    en: { name: "Scan Document", desc: "Shoot with your phone camera and get a clean PDF." },
  },
  {
    id: "html-to-pdf", cat: "convert", Icon: Globe,
    tr: { name: "HTML → PDF", desc: "Bir web sayfasını olduğu gibi PDF'e alın." },
    en: { name: "HTML → PDF", desc: "Capture a web page as a PDF, exactly as it looks." },
  },
  {
    id: "pdf-to-text", cat: "convert", Icon: FileType2,
    tr: { name: "PDF → Metin", desc: "Belgedeki tüm yazıyı düz metin olarak alın." },
    en: { name: "PDF → Text", desc: "Get all the writing as plain text." },
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
    id: "udf-to-pdf", cat: "convert", Icon: Scale, free: true,
    tr: { name: "UDF'yi PDF Yap", desc: "UYAP'tan inen .udf belgesini program kurmadan PDF'ye çevirin." },
    en: { name: "UDF to PDF", desc: "Turn a .udf file from UYAP into a PDF — no software needed." },
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
  "pdf-sohbet": "purple",
  "pdf-ceviri": "indigo",
  "pdf-karsilastir": "violet",
  "pdf-veri-cikar": "teal",
  "ai-toplu-islem": "purple",
  "taranmis-pdf-ocr": "cyan",
  "aranabilir-pdf": "sky",
  // Düzenle
  "pdf-duzenle": "amber",
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
  "form-doldur": "emerald",
  "ustveri-temizle": "rose",
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
  // Güvenlik
  encrypt: "emerald",
  "unlock-pdf": "teal",
  "hassas-veri-gizle": "rose",
  "repair-pdf": "amber",
};
