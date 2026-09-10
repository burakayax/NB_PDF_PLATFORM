/**
 * ARAÇ ZİNCİRLEME — bir araç çıktı ürettikten sonra "sıradaki adım" önerileri.
 *
 * Bu tablolar ana uygulama dosyasının içinde duruyordu. Saf veri ve saf
 * fonksiyon oldukları için ayrı modülde durmaları hem o dosyayı küçültür hem de
 * yeni bir araç eklenirken nereye bakılacağını netleştirir.
 */
import type { FeatureKey } from "../api/subscription";

type FeatureId = FeatureKey;

/**
 * Araç zincirleme — bir araç PDF çıktısı ürettiğinde önerilecek MANTIKLI sonraki
 * araçlar. Ters/gereksiz çiftler (pdf→word sonrası word→pdf gibi) ve çıktısı PDF
 * olmayan araçlar (pdf-to-word/excel/ppt/image/text) bilinçli olarak dışlanır.
 * Öneriler yalnızca PDF-girdili workspace araçlarıdır; her biri "kaydetme yeri sor"
 * dahil normal boru hattından geçer.
 */
// Her araç için "ilgili sonraki araç" havuzu. Sıra öncelik belirtir; önce
// yapısal (çoğu bağlamda görünür) araçlar, sonra server-side olanlar gelir ki
// bazı araçlar gizli/kilitli olsa bile eleme sonrası 2-3 öneri kalabilsin.
// Ters/anlamsız dönüşüm zincirleri (pdf→excel→pdf gibi) kasıtla dışarıda.
/**
 * ARKA PLANDA çalıştırılan araçlar.
 *
 * Bu dönüşümler sayfa sayısına göre dakikalar sürebiliyor. Cevabı bekleyen tek
 * bir istekte bağlantı koparsa (mobil ağ, ara sunucu zaman aşımı, sekmenin
 * uykuya geçmesi) yapılan iş boşa gidiyor ve ilerleme çubuğu sonunda takılı
 * kalıyordu. Buradaki araçlar önce sunucuda sıraya alınır, sonra gerçek sayfa
 * ilerlemesi okunur.
 *
 * Yeni bir aracı buraya eklemeden önce sunucuda `<uç>/start` yolunun açıldığını
 * doğrula; aksi halde istek 404 döner.
 */
export const BACKGROUND_JOB_TOOLS = new Set<FeatureId>([
  "pdf-to-excel",
  "pdf-to-word",
  "pdf-to-ppt",
]);

export const CHAIN_SUGGESTIONS: Partial<Record<FeatureId, FeatureId[]>> = {
  merge: ["organize-pdf", "split", "rotate-pdf", "compress", "page-numbers", "watermark"],
  split: ["merge", "organize-pdf", "rotate-pdf", "compress", "watermark", "page-numbers"],
  compress: ["merge", "organize-pdf", "page-numbers", "watermark", "split", "encrypt"],
  "rotate-pdf": ["organize-pdf", "delete-pages", "merge", "compress", "page-numbers", "watermark"],
  "delete-pages": ["organize-pdf", "rotate-pdf", "merge", "compress", "page-numbers", "split"],
  "organize-pdf": ["delete-pages", "rotate-pdf", "merge", "page-numbers", "compress", "watermark"],
  watermark: ["compress", "page-numbers", "merge", "organize-pdf", "encrypt"],
  "page-numbers": ["compress", "watermark", "merge", "organize-pdf", "encrypt"],
  "repair-pdf": ["compress", "organize-pdf", "merge", "page-numbers", "watermark"],
  "unlock-pdf": ["compress", "watermark", "page-numbers", "merge", "organize-pdf", "encrypt"],
  "flatten-pdf": ["compress", "page-numbers", "watermark", "merge", "encrypt"],
  "image-to-pdf": ["merge", "organize-pdf", "rotate-pdf", "compress", "page-numbers", "watermark"],
  "word-to-pdf": ["compress", "merge", "watermark", "page-numbers", "encrypt"],
  "excel-to-pdf": ["compress", "merge", "watermark", "page-numbers"],
  "ppt-to-pdf": ["compress", "merge", "watermark", "page-numbers"],
  "html-to-pdf": ["compress", "page-numbers", "watermark", "merge"],
  // encrypt → çıktı şifreli (zincir parola ister) → öneri yok.
};

/**
 * PDF OLMAYAN çıktılar için öneriler — dosya UZANTISINA göre.
 *
 * Word/Excel/PowerPoint/görsel çıktısı veren araçlardan sonra da kullanıcı
 * genelde bir sonraki adımı yapmak ister; eskiden bu çıktılarda hiç öneri
 * gösterilmiyordu ve akış orada bitiyordu. Burada, o dosya türünü GERÇEKTEN
 * kabul eden araçlar listelenir — yanlış araca yönlendirme olmaz.
 */
export const CHAIN_BY_OUTPUT_EXT: Record<string, FeatureId[]> = {
  xlsx: ["excel-to-pdf"],
  xls: ["excel-to-pdf"],
  docx: ["word-to-pdf"],
  doc: ["word-to-pdf"],
  pptx: ["ppt-to-pdf"],
  ppt: ["ppt-to-pdf"],
  png: ["image-to-pdf"],
  jpg: ["image-to-pdf"],
  jpeg: ["image-to-pdf"],
  webp: ["image-to-pdf"],
  // .zip (toplu çıktı) ve .txt için anlamlı bir sonraki adım yok.
};

/** Dosya adından küçük harfli uzantı. */
export function fileExt(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

// Zincirleme başlığında kullanılan "işlem sonucu" dosya adı — kullanıcı bunun
// yüklediği orijinal değil, az önce OLUŞTURDUĞU dosya olduğunu anlasın diye.
export const CHAIN_RESULT_NOUN: Partial<Record<FeatureId, { tr: string; en: string }>> = {
  merge: { tr: "Birleştirdiğiniz PDF", en: "merged PDF" },
  split: { tr: "Ayırdığınız PDF", en: "split PDF" },
  compress: { tr: "Sıkıştırdığınız PDF", en: "compressed PDF" },
  "rotate-pdf": { tr: "Döndürdüğünüz PDF", en: "rotated PDF" },
  "delete-pages": { tr: "Düzenlediğiniz PDF", en: "edited PDF" },
  "organize-pdf": { tr: "Sıraladığınız PDF", en: "reordered PDF" },
  watermark: { tr: "Filigran eklediğiniz PDF", en: "watermarked PDF" },
  "page-numbers": { tr: "Numaralandırdığınız PDF", en: "numbered PDF" },
  "repair-pdf": { tr: "Onardığınız PDF", en: "repaired PDF" },
  "unlock-pdf": { tr: "Şifresini çözdüğünüz PDF", en: "unlocked PDF" },
  "flatten-pdf": { tr: "Düzleştirdiğiniz PDF", en: "flattened PDF" },
  "image-to-pdf": { tr: "Oluşturduğunuz PDF", en: "new PDF" },
  "word-to-pdf": { tr: "Oluşturduğunuz PDF", en: "converted PDF" },
  "excel-to-pdf": { tr: "Oluşturduğunuz PDF", en: "converted PDF" },
  "ppt-to-pdf": { tr: "Oluşturduğunuz PDF", en: "converted PDF" },
  "html-to-pdf": { tr: "Oluşturduğunuz PDF", en: "converted PDF" },
};

// Öneri havuzu (yukarıdaki liste) eleme sonrası 3'ün altında kalırsa buradan
// tamamlanır. Yalnızca PDF GİRDİ alıp PDF ÇIKTI veren araçlar (popülerlik sırası)
// — böylece "3 öneri" hedefi her bağlamda garanti altına alınır.
export const CHAIN_FALLBACK: FeatureId[] = [
  "compress",
  "merge",
  "organize-pdf",
  "rotate-pdf",
  "page-numbers",
  "watermark",
  "split",
  "delete-pages",
  "encrypt",
  "unlock-pdf",
  "flatten-pdf",
  "repair-pdf",
];
