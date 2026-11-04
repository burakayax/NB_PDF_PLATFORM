/**
 * HERO ARAÇ KATEGORİLERİ — ana sayfadaki hızlı araç alanının içeriği.
 *
 * 20 araç tek ızgarada altı satır kaplıyordu; ziyaretçi asıl işi (dosya bırakma
 * alanını) görmeden kaydırmak zorunda kalıyordu. Araçlar artık kategori
 * sekmelerine bölünür; her sekme geniş ekranda TEK satır.
 *
 * Kutu türleri:
 *   free   → hero'nun içinde, sayfadan ayrılmadan çalışır
 *   editor → PDF Düzenle (hero içinde açılır)
 *   page   → üyeliksiz ama kendi sayfasında açılır
 *   member → ücretsiz üyelikle açılır (kilit rozetli, kayıt ekranına götürür)
 *
 * KAPSAM KURALI: pdf-tools-section.tsx'te "Üyeliksiz" rozeti taşıyan HER araç
 * burada da bulunmalıdır; aksi halde ziyaretçi aşağıda gördüğü ücretsiz aracı
 * yukarıdaki hızlı alanda bulamaz ve rozete güvenmez. Kural
 * `__tests__/heroToolCoverage.test.ts` ile denetlenir.
 *
 * Bu liste LandingPage.tsx'ten AYRI bir dosyadadır: kapsam testinin ağır bir
 * bileşeni (ve onun tarayıcı API'lerini) yüklemeden sabitleri okuyabilmesi için.
 */
import {
  Crop,
  FileUser,
  FileSearch,
  FileType2,
  Grid2x2,
  Hash,
  Highlighter,
  Maximize2,
  Minimize2,
  PenTool,
  Scale,
  ScanLine,
  Unlock,
  type LucideIcon,
} from "lucide-react";
// Yalnızca TİP olarak alınır → derlemede silinir, LandingPage runtime'da yüklenmez.
import type { FreeToolId } from "./LandingPage";

export type HeroItem =
  | { k: "free"; id: FreeToolId }
  | { k: "editor" }
  | { k: "page"; slug: string; Icon: LucideIcon; tr: string; en: string }
  | { k: "member"; slug: string; Icon: LucideIcon; tr: string; en: string };

export type HeroCatId = "pages" | "edit" | "convert" | "docs" | "legal" | "shrink" | "extra";

export const HERO_CATS: { id: HeroCatId; tr: string; en: string; items: HeroItem[] }[] = [
  {
    id: "pages",
    tr: "Sayfa",
    en: "Pages",
    items: [
      { k: "free", id: "merge" },
      { k: "free", id: "split" },
      { k: "free", id: "rotate-pdf" },
      { k: "free", id: "delete-pages" },
      { k: "free", id: "organize-pdf" },
      { k: "page", slug: "sayfa-duzeni", Icon: Grid2x2, tr: "PDF Sayfa Düzeni", en: "PDF Page Layout" },
    ],
  },
  {
    id: "edit",
    tr: "Düzenle",
    en: "Edit",
    items: [
      { k: "editor" },
      { k: "page", slug: "pdf-kesit-al", Icon: Crop, tr: "PDF'ten Kesit Al", en: "Snip to Image" },
      { k: "page", slug: "pdf-imzala", Icon: PenTool, tr: "PDF İmzala", en: "Sign PDF" },
      { k: "page", slug: "pdf-yorumla", Icon: Highlighter, tr: "PDF İşaretle", en: "Markup PDF" },
      { k: "member", slug: "unlock-pdf", Icon: Unlock, tr: "Şifre Kaldır", en: "Unlock PDF" },
      { k: "member", slug: "cv-olustur", Icon: FileUser, tr: "CV Oluştur", en: "CV Maker" },
    ],
  },
  {
    id: "convert",
    tr: "Dönüştür",
    en: "Convert",
    items: [
      { k: "free", id: "image-to-pdf" },
      { k: "page", slug: "belge-tara", Icon: ScanLine, tr: "Belge Tara", en: "Scan Document" },
      { k: "page", slug: "e-basvuru-uyumluluk", Icon: Scale, tr: "E-başvuru Uyumluluk Kontrolü", en: "Filing Compliance Check" },
      { k: "page", slug: "dilekce-sablonlari", Icon: Scale, tr: "Dilekçe Şablonları", en: "Petition Templates" },
      { k: "member", slug: "pdf-to-text", Icon: FileType2, tr: "PDF'ten Metne", en: "PDF to Text" },
      { k: "member", slug: "aranabilir-pdf", Icon: FileSearch, tr: "Aranabilir PDF", en: "Searchable PDF" },
    ],
  },
  {
    id: "docs",
    tr: "Metin & E-kitap",
    en: "Text & E-book",
    items: [
      { k: "page", slug: "txt-to-pdf", Icon: FileType2, tr: "TXT'den PDF'e", en: "TXT'den PDF'e" },
      { k: "page", slug: "markdown-to-pdf", Icon: FileType2, tr: "Markdown'dan PDF'e", en: "Markdown'dan PDF'e" },
      { k: "page", slug: "rtf-to-pdf", Icon: FileType2, tr: "RTF'den PDF'e", en: "RTF'den PDF'e" },
      { k: "page", slug: "odt-to-pdf", Icon: FileType2, tr: "ODT'den PDF'e", en: "ODT'den PDF'e" },
      { k: "page", slug: "epub-to-pdf", Icon: FileType2, tr: "EPUB'tan PDF'e", en: "EPUB'tan PDF'e" },
      { k: "page", slug: "pdf-to-epub", Icon: FileType2, tr: "PDF'ten EPUB'a", en: "PDF'ten EPUB'a" },
    ],
  },
  {
    id: "legal",
    tr: "Hukuk / UYAP",
    en: "Legal / UYAP",
    items: [
      { k: "page", slug: "udf-to-pdf", Icon: Scale, tr: "UDF'den PDF'e", en: "UDF'den PDF'e" },
      { k: "page", slug: "pdf-to-udf", Icon: Scale, tr: "PDF'ten UDF'ye", en: "PDF'ten UDF'ye" },
      { k: "page", slug: "word-to-udf", Icon: Scale, tr: "Word'den UDF'ye", en: "Word'den UDF'ye" },
      { k: "page", slug: "udf-to-word", Icon: Scale, tr: "UDF'den Word'e", en: "UDF'den Word'e" },
      { k: "page", slug: "udf-viewer", Icon: Scale, tr: "UDF Görüntüleyici", en: "UDF Viewer" },
      { k: "page", slug: "image-to-udf", Icon: Scale, tr: "Görsel ve TIFF'ten UDF'ye", en: "Image and TIFF to UDF" },
    ],
  },
  {
    id: "shrink",
    tr: "Küçült",
    en: "Shrink",
    items: [
      { k: "free", id: "gorsel-sikistir" },
      { k: "page", slug: "gorsel-boyutlandir", Icon: Maximize2, tr: "Görsel Boyutlandır", en: "Resize Image" },
      { k: "member", slug: "compress", Icon: Minimize2, tr: "PDF Sıkıştır", en: "Compress PDF" },
      { k: "page", slug: "kimlik-karti-tek-sayfa", Icon: Scale, tr: "Kimlik Ön–Arka Tek Sayfa", en: "ID Front+Back on One Page" },
    ],
  },
  {
    id: "extra",
    tr: "Diğer",
    en: "More",
    items: [
      { k: "page", slug: "tiff-to-pdf", Icon: FileType2, tr: "TIFF'ten PDF'e", en: "TIFF'ten PDF'e" },
      { k: "page", slug: "pdf-ust-alt-bilgi", Icon: Hash, tr: "Üst / Alt Bilgi Ekle", en: "Add Header / Footer" },
      { k: "page", slug: "pdf-sesli-oku", Icon: Scale, tr: "Sesli Okuma", en: "Read Aloud" },
      { k: "page", slug: "pdf-to-markdown", Icon: FileType2, tr: "PDF'ten Markdown'a", en: "PDF'ten Markdown'a" },
    ],
  },
];

/** Bir aracın hangi sekmede durduğu (dışarıdan araç seçilince doğru sekme açılsın). */
export function catOfFreeTool(id: FreeToolId): HeroCatId {
  for (const c of HERO_CATS) {
    if (c.items.some((it) => it.k === "free" && it.id === id)) return c.id;
  }
  return "pages";
}

/** Sekme değişince hero'da hangi aracın açılacağı — kategorinin ilk çalışır aracı. */
export function firstRunnable(cat: HeroCatId): { free?: FreeToolId; editor: boolean; page?: string } {
  const items = HERO_CATS.find((c) => c.id === cat)?.items ?? [];
  for (const it of items) {
    if (it.k === "editor") return { editor: true };
    if (it.k === "free") return { free: it.id, editor: false };
    // Yalnızca "kendi sayfasında" araçları olan sekme (Hukuk / UYAP) ilk aracını açar.
    if (it.k === "page" && !items.some((x) => x.k === "free" || x.k === "editor")) return { page: it.slug, editor: false };
  }
  return { free: "merge", editor: false };
}
