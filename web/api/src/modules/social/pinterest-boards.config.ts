/**
 * Pinterest pano YAPILANDIRMASI — tek yer.
 *
 * Yeni araç, pano ya da anahtar kelime eklemek için yalnız bu dosya düzenlenir; seçim mantığı
 * (`pinterest-board.ts`) buradaki verileri okur. Hiçbir şey kodun içine dağıtılmaz.
 *
 * Seçim sırası (bkz. chooseBoard):
 *   1. elle seçim  2. araç eşleştirmesi  3. blog kategorisi/etiketi  4. başlık+açıklama anahtar kelimesi  5. varsayılan
 */

export const PIN_BOARD_KEYS = ["cv", "pdf-duzenleme", "tarama", "gizlilik", "hukuk", "ogrenci"] as const;
export type PinBoardKey = (typeof PIN_BOARD_KEYS)[number];

export function isPinBoardKey(value: unknown): value is PinBoardKey {
  return typeof value === "string" && (PIN_BOARD_KEYS as readonly string[]).includes(value);
}

/** Hiçbir kural tutmazsa gidilecek pano. */
export const DEFAULT_PIN_BOARD: PinBoardKey = "pdf-duzenleme";

/** Pinterest'te görünecek pano adı ve açıklaması (panolar bu bilgiyle oluşturulur, adla eşleştirilir). */
export const PIN_BOARDS: Record<PinBoardKey, { name: string; description: string }> = {
  cv: {
    name: "CV Örnekleri ve CV Hazırlama",
    description: "Meslek meslek CV örnekleri, iş başvurusu için CV hazırlama ipuçları ve hazır şablonlar.",
  },
  "pdf-duzenleme": {
    name: "PDF Düzenleme İpuçları",
    description: "PDF birleştirme, sıkıştırma, Word'e çevirme ve düzenleme için ücretsiz, pratik yöntemler.",
  },
  tarama: {
    name: "Telefonla Belge Tarama",
    description: "Telefonla belge tarama, fotoğrafı PDF yapma ve aranabilir PDF (OCR) ipuçları.",
  },
  gizlilik: {
    name: "Belge Gizliliği ve Kişisel Veri",
    description: "PDF paylaşmadan önce kişisel verileri koruma: kimlik numarası gizleme, üstveri temizleme.",
  },
  hukuk: {
    name: "Sözleşme ve Hukuk Belgeleri",
    description: "Sözleşme hazırlama ve kontrol, cezai şart hesaplama, UYAP belgeleriyle çalışma rehberleri.",
  },
  ogrenci: {
    name: "Öğrenciler İçin PDF ve Ödev İpuçları",
    description: "Ödev, tez ve ders notları için PDF birleştirme, sıkıştırma ve düzenleme ipuçları.",
  },
};

/**
 * ARAÇ → PANO. Anahtar: aracın sayfa adresindeki ad (`/tools/<ad>`). Sitedeki TÜM araçlar burada olmalı;
 * eksik araç testte yakalanır (social-pinterest-boards.test.ts).
 */
export const TOOL_BOARD: Record<string, PinBoardKey> = {
  // ── PDF düzenleme ──
  "merge-pdf": "pdf-duzenleme",
  "pdf-birlestir-icindekiler": "pdf-duzenleme",
  "pdf-qr-ekle": "pdf-duzenleme",
  "split-pdf": "pdf-duzenleme",
  compress: "pdf-duzenleme",
  "rotate-pdf": "pdf-duzenleme",
  "delete-pages": "pdf-duzenleme",
  "organize-pdf": "pdf-duzenleme",
  "page-numbers": "pdf-duzenleme",
  watermark: "pdf-duzenleme",
  "pdf-to-word": "pdf-duzenleme",
  "pdf-to-excel": "pdf-duzenleme",
  "pdf-to-ppt": "pdf-duzenleme",
  "word-to-pdf": "pdf-duzenleme",
  "excel-to-pdf": "pdf-duzenleme",
  "ppt-to-pdf": "pdf-duzenleme",
  "pdf-to-image": "pdf-duzenleme",
  "pdf-to-text": "pdf-duzenleme",
  "html-to-pdf": "pdf-duzenleme",
  "extract-images": "pdf-duzenleme",
  "pdf-imzala": "pdf-duzenleme",
  "imza-iste": "pdf-duzenleme",
  "pdf-duzenle": "pdf-duzenleme",
  "pdf-karsilastir": "pdf-duzenleme",
  "pdf-kesit-al": "pdf-duzenleme",
  "sayfa-duzeni": "pdf-duzenleme",
  "resize-pdf": "pdf-duzenleme",
  "flip-pdf": "pdf-duzenleme",
  "flatten-pdf": "pdf-duzenleme",
  "grayscale-pdf": "pdf-duzenleme",
  "repair-pdf": "pdf-duzenleme",
  "pdf-to-pdfa": "pdf-duzenleme",
  "alternate-mix-pdf": "pdf-duzenleme",
  "unlock-pdf": "pdf-duzenleme",
  "form-doldur": "pdf-duzenleme",
  "pdf-ceviri": "pdf-duzenleme",
  "pdf-sinav-olustur": "ogrenci",
  "pdf-ozetle": "ogrenci",
  "pdf-sohbet": "pdf-duzenleme",
  "pdf-yorumla": "pdf-duzenleme",
  "pdf-veri-cikar": "pdf-duzenleme",
  "ai-toplu-islem": "pdf-duzenleme",
  "gorsel-sikistir": "pdf-duzenleme",
  "gorsel-boyutlandir": "pdf-duzenleme",
  // ── Tarama ──
  "belge-tara": "tarama",
  "image-to-pdf": "tarama",
  "taranmis-pdf-ocr": "tarama",
  "aranabilir-pdf": "tarama",
  "deskew-pdf": "tarama",
  // ── Gizlilik ──
  "hassas-veri-gizle": "gizlilik",
  "ustveri-temizle": "gizlilik",
  encrypt: "gizlilik",
  // ── Hukuk ──
  "sozlesme-denetci": "hukuk",
  "udf-to-pdf": "hukuk",
  "pdf-to-udf": "hukuk",
  "word-to-udf": "hukuk",
  "udf-to-word": "hukuk",
  "udf-viewer": "hukuk",
  "image-to-udf": "hukuk",
  "e-basvuru-uyumluluk": "hukuk",
  "dilekce-sablonlari": "hukuk",
  "kimlik-karti-tek-sayfa": "pdf-duzenleme",
  "pdf-sesli-oku": "ogrenci",
  "pdf-ust-alt-bilgi": "pdf-duzenleme",
  // ── CV ──
  "cv-olustur": "cv",
  "ai-fotograf-studyosu": "cv",
};

/**
 * BLOG KATEGORİSİ / ETİKETİ → PANO. Yazının kategorileri ve adresindeki sözcüklerle eşleşir.
 * Terimler küçük harfe ve Türkçe karaktersiz yazıya çevrilerek karşılaştırılır (ö→o, ı→i…).
 * Üç harf ve altı terimler TAM sözcük, uzun terimler sözcük BAŞI olarak aranır ("sozlesme" → "sozlesmesi" de tutar).
 * Sıra önemlidir: ilk tutan kazanır.
 */
export const CATEGORY_RULES: { board: PinBoardKey; terms: string[] }[] = [
  { board: "cv", terms: ["cv", "ozgecmis", "europass", "on yazi", "cover letter", "resume", "is basvurusu", "mulakat", "ats"] },
  { board: "hukuk", terms: ["sozlesme", "uyap", "cezai sart", "ihale", "sartname", "kira kontrat", "dilekce", "contract", "tender"] },
  { board: "gizlilik", terms: ["kvkk", "kimlik", "metadata", "ustveri", "karart", "redact", "kisisel veri", "hassas veri", "privacy", "gizlilik"] },
  { board: "tarama", terms: ["belge tara", "tarama", "tarayici", "scan", "ocr", "fotograftan pdf", "aranabilir"] },
];

/**
 * BAŞLIK + AÇIKLAMA ANAHTAR KELİMELERİ → PANO (kategori tutmadığında son çare).
 * Aynı eşleştirme kuralları; sıra yine önemlidir.
 */
export const KEYWORD_RULES: { board: PinBoardKey; terms: string[] }[] = [
  ...CATEGORY_RULES,
  {
    board: "ogrenci",
    terms: ["odev", "tez", "tezi", "tezler", "ogrenci", "universite", "ders notu", "ders notlari", "akademik", "makale", "student", "homework", "thesis"],
  },
];
