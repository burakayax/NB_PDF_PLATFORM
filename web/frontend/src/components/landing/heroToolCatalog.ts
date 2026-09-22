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
  FileSearch,
  FileType2,
  Grid2x2,
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

export type HeroCatId = "pages" | "edit" | "convert" | "shrink";

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
      { k: "page", slug: "sayfa-duzeni", Icon: Grid2x2, tr: "Sayfa Düzeni", en: "Page Layout" },
    ],
  },
  {
    id: "edit",
    tr: "Düzenle",
    en: "Edit",
    items: [
      { k: "editor" },
      { k: "free", id: "crop-pdf" },
      { k: "page", slug: "pdf-kesit-al", Icon: Crop, tr: "Kesit Al", en: "Snip" },
      { k: "page", slug: "pdf-imzala", Icon: PenTool, tr: "İmzala", en: "Sign" },
      { k: "page", slug: "pdf-yorumla", Icon: Highlighter, tr: "İşaretle", en: "Annotate" },
      { k: "member", slug: "unlock-pdf", Icon: Unlock, tr: "Şifre Kaldır", en: "Unlock PDF" },
    ],
  },
  {
    id: "convert",
    tr: "Dönüştür",
    en: "Convert",
    items: [
      { k: "free", id: "image-to-pdf" },
      { k: "page", slug: "udf-to-pdf", Icon: Scale, tr: "UDF → PDF", en: "UDF → PDF" },
      { k: "page", slug: "belge-tara", Icon: ScanLine, tr: "Belge Tara", en: "Scan" },
      { k: "member", slug: "pdf-to-text", Icon: FileType2, tr: "PDF → Metin", en: "PDF → Text" },
      { k: "member", slug: "aranabilir-pdf", Icon: FileSearch, tr: "Aranabilir PDF", en: "Searchable PDF" },
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
export function firstRunnable(cat: HeroCatId): { free?: FreeToolId; editor: boolean } {
  const items = HERO_CATS.find((c) => c.id === cat)?.items ?? [];
  for (const it of items) {
    if (it.k === "editor") return { editor: true };
    if (it.k === "free") return { free: it.id, editor: false };
  }
  return { free: "merge", editor: false };
}
