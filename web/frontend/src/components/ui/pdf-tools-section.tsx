import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Camera,
  Combine,
  Crop,
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
  Scan,
  Scissors,
  Search,
  Sparkles,
  SquareSplitHorizontal,
  Table2,
  Trash2,
  Unlock,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import type { FeatureKey } from "../../api/subscription";

/**
 * ARAÇLAR BÖLÜMÜ (ana sayfa, misafir) — tüm araç kataloğu.
 *
 * Tasarım kararları:
 *  • Tek tip çizgi ikon (emoji YOK) → kurumsal, tutarlı bir görünüm.
 *  • Her karta bir satır açıklama → kullanıcı adı anlamasa bile ne yaptığını görür.
 *  • Arama + kategori süzgeci → 38 araç tek tek okunmak zorunda kalmaz.
 *  • Rozet SADECE gerçek bir ayrıcalık anlatıyorsa (üyeliksiz / yapay zekâ);
 *    her kartta rozet olursa hiçbiri fark edilmez.
 */

// FeatureKey OLMAYAN araçlar (AI/özel SEO sayfaları) → /tools/<slug>'a gider.
// FeatureKey araçları (merge, split…) uygulama içinde açılır.
const SEO_SLUG_TOOLS = new Set<string>([
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-ceviri",
  "pdf-karsilastir",
  "pdf-veri-cikar",
  "ai-toplu-islem",
  "pdf-duzenle",
  "pdf-imzala",
  "pdf-yorumla",
  "hassas-veri-gizle",
  "taranmis-pdf-ocr",
  "aranabilir-pdf",
  "belge-tara",
  "crop-pdf",
  "gorsel-sikistir",
  "gorsel-boyutlandir",
  "pdf-kesit-al",
]);

type CategoryId = "ai" | "edit" | "scan" | "convert" | "security";

type Tool = {
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

const TOOLS: Tool[] = [
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
    id: "crop-pdf", cat: "edit", Icon: Crop, free: true,
    tr: { name: "PDF Kırp", desc: "Kenar boşluklarını kesip sayfayı daraltın." },
    en: { name: "Crop PDF", desc: "Cut the margins and tighten the page." },
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
    id: "form-doldur", cat: "edit", Icon: FileText,
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
type HueId =
  | "violet" | "fuchsia" | "purple" | "indigo" | "blue" | "sky"
  | "cyan" | "teal" | "emerald" | "lime" | "amber" | "orange" | "rose";

const HUES: Record<HueId, { tile: string; icon: string; ring: string; glow: string }> = {
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
const TOOL_HUE: Record<string, HueId> = {
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
  "crop-pdf": "teal",
  "pdf-kesit-al": "lime",
  compress: "emerald",
  "gorsel-sikistir": "emerald",
  "gorsel-boyutlandir": "lime",
  "extract-images": "fuchsia",
  "page-numbers": "blue",
  watermark: "sky",
  "flatten-pdf": "indigo",
  "form-doldur": "emerald",
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
  // Güvenlik
  encrypt: "emerald",
  "unlock-pdf": "teal",
  "hassas-veri-gizle": "rose",
  "repair-pdf": "amber",
};

const CATEGORY_META: Record<
  CategoryId,
  { tr: string; en: string; ring: string; tint: string; text: string; glow: string }
> = {
  ai: {
    tr: "Yapay Zekâ", en: "AI",
    ring: "group-hover:border-fuchsia-400/40",
    tint: "bg-fuchsia-500/10 ring-fuchsia-400/20",
    text: "text-fuchsia-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(217,70,239,0.55)]",
  },
  edit: {
    tr: "Düzenle", en: "Edit",
    ring: "group-hover:border-violet-400/40",
    tint: "bg-violet-500/10 ring-violet-400/20",
    text: "text-violet-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(139,92,246,0.55)]",
  },
  convert: {
    tr: "Dönüştür", en: "Convert",
    ring: "group-hover:border-sky-400/40",
    tint: "bg-sky-500/10 ring-sky-400/20",
    text: "text-sky-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(56,189,248,0.55)]",
  },
  scan: {
    tr: "Tara & Metin Tanıma", en: "Scan & OCR",
    ring: "group-hover:border-cyan-400/45",
    tint: "bg-cyan-500/10 ring-cyan-400/20",
    text: "text-cyan-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(34,211,238,0.55)]",
  },
  security: {
    tr: "Güvenlik", en: "Security",
    ring: "group-hover:border-emerald-400/40",
    tint: "bg-emerald-500/10 ring-emerald-400/20",
    text: "text-emerald-300",
    glow: "group-hover:shadow-[0_18px_40px_-20px_rgba(16,185,129,0.55)]",
  },
};

const CATEGORY_ORDER: CategoryId[] = ["ai", "edit", "scan", "convert", "security"];

/** Arama için: Türkçe karakterleri sadeleştirip küçük harfe indirger. */
function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

interface PdfToolsSectionProps {
  language: Language;
  onUseWebApp: () => void;
  onOpenTool: (id: FeatureKey) => void;
}

export default function PdfToolsSection({
  language,
  onUseWebApp,
  onOpenTool,
}: PdfToolsSectionProps) {
  const tr = language === "tr";
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = norm(query);
    return TOOLS.filter((t) => {
      if (filter !== "all" && t.cat !== filter) return false;
      if (!q) return true;
      return norm(`${t[language].name} ${t[language].desc} ${t.id}`).includes(q);
    });
  }, [filter, query, language]);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: visible.filter((t) => t.cat === cat),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  function openTool(t: Tool) {
    if (SEO_SLUG_TOOLS.has(t.id)) {
      if (typeof window !== "undefined") window.location.assign(`/tools/${t.id}`);
      return;
    }
    onOpenTool(t.id as FeatureKey);
  }

  return (
    <section id="tools" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            {tr ? `${TOOLS.length} PDF ARACI` : `${TOOLS.length} PDF TOOLS`}
          </span>
          <h2
            className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Her İhtiyaç İçin Doğru Araç" : "The Right Tool for Every Need"}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {tr
              ? "Aradığınızı yazın ya da bir kategori seçin. «Üyeliksiz» işaretli araçlar kayıt olmadan, dosyanız cihazınızdan çıkmadan çalışır."
              : "Search, or pick a category. Tools marked «No sign-up» run without an account and never upload your file."}
          </p>
        </motion.div>

        {/* Arama + kategori süzgeci */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr ? "Araç ara — örn. birleştir, Word, imza" : "Search tools — e.g. merge, Word, sign"}
              aria-label={tr ? "Araç ara" : "Search tools"}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/40 focus:bg-white/[0.06]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {(["all", ...CATEGORY_ORDER] as const).map((c) => {
              const active = filter === c;
              const label =
                c === "all"
                  ? tr ? "Tümü" : "All"
                  : tr ? CATEGORY_META[c].tr : CATEGORY_META[c].en;
              const count =
                c === "all" ? TOOLS.length : TOOLS.filter((t) => t.cat === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                    active
                      ? "border-violet-400/40 bg-violet-500/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 text-[11px] ${active ? "text-violet-200/80" : "text-slate-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kategoriler + kartlar */}
        <div className="mt-12 space-y-12">
          {grouped.map(({ cat, items }) => {
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat}>
                <div className="mb-5 flex items-center gap-3">
                  <h3 className={`text-[13px] font-bold uppercase tracking-[0.14em] ${meta.text}`}>
                    {tr ? meta.tr : meta.en}
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((t, i) => {
                    const { Icon } = t;
                    const copy = t[language];
                    const hue = HUES[TOOL_HUE[t.id] ?? "violet"];
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        onClick={() => openTool(t)}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2) }}
                        className={`group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.055] ${hue.ring} ${hue.glow}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-inner shadow-black/20 ring-1 transition duration-200 group-hover:scale-[1.06] ${hue.tile} ${hue.icon}`}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-semibold text-white/90 transition group-hover:text-white">
                              {copy.name}
                            </span>
                            {(t.free || t.account || t.ai) && (
                              <span
                                className={`mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide ${
                                  t.free
                                    ? "text-emerald-300/90"
                                    : t.account
                                      ? "text-sky-300/90"
                                      : "text-fuchsia-300/90"
                                }`}
                              >
                                <span
                                  className={`h-1 w-1 rounded-full ${
                                    t.free ? "bg-emerald-400" : t.account ? "bg-sky-400" : "bg-fuchsia-400"
                                  }`}
                                />
                                {t.free
                                  ? tr ? "Üyeliksiz" : "No sign-up"
                                  : t.account
                                    ? tr ? "Ücretsiz üyelik" : "Free account"
                                    : tr ? "Yapay zekâ" : "AI"}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400 transition group-hover:text-slate-300">
                          {copy.desc}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {grouped.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center">
              <p className="text-sm text-slate-400">
                {tr ? "Bu aramaya uyan araç bulunamadı." : "No tool matches that search."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-3 text-[13px] font-semibold text-violet-300 underline underline-offset-4 transition hover:text-violet-200"
              >
                {tr ? "Tüm araçları göster" : "Show all tools"}
              </button>
            </div>
          )}
        </div>

        {/* Alt eylem */}
        <div className="mt-14 text-center">
          <p className="text-[13px] text-slate-500">
            {tr
              ? "Aradığınızı bulamadınız mı? Sürekli yeni araçlar ekliyoruz."
              : "Can't find what you need? We're constantly adding new tools."}
          </p>
          <button
            onClick={onUseWebApp}
            className="mt-4 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
          >
            {tr ? "Çalışma alanını aç →" : "Open the workspace →"}
          </button>
        </div>
      </div>
    </section>
  );
}
