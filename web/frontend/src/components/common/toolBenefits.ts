import { Lock, Trash2, Zap, type LucideIcon } from "lucide-react";
import { TOOLS } from "../../lib/toolCatalog";
import { isOnDeviceTool } from "../../lib/onDeviceTools";

/**
 * YÜKLEME EKRANINDAKİ ÜÇ FAYDA KUTUSU.
 *
 * Sekiz ücretsiz aracın elle yazılmış, aracın işine özel metinleri vardı; geri
 * kalan araçlarda bu kutular hiç yoktu. Elle yazılanlar korunur, yazılmamış
 * araçlar için katalogdan tutarlı bir üçlü üretilir — böylece yeni bir araç
 * eklendiğinde ekran boş kalmaz, ama iyi yazılmış metin de kaybolmaz.
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
    { icon: Zap, tr: "Hızlı", trDesc: "Yükleme yok — cihazında saniyeler içinde.", en: "Fast", enDesc: "No upload — done on your device in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Belgen cihazından hiç çıkmaz.", en: "Private", enDesc: "Your document never leaves your device." },
  ],
  "image-to-pdf": [
    { icon: Zap, tr: "Görselleri PDF yap", trDesc: "JPG/PNG'leri tek PDF'e sırayla dönüştür.", en: "Images to PDF", enDesc: "Turn JPG/PNG files into one ordered PDF." },
    { icon: Zap, tr: "Anında", trDesc: "Sürükle-bırak, saniyeler içinde hazır.", en: "Instant", enDesc: "Drag & drop, ready in seconds." },
    { icon: Lock, tr: "Gizli", trDesc: "Görsellerin cihazında kalır.", en: "Private", enDesc: "Your images stay on your device." },
  ],
  "gorsel-sikistir": [
    { icon: Zap, tr: "Dosya boyutunu küçült", trDesc: "Kalite ve boyutu ayarla, JPEG/WebP olarak al.", en: "Shrink file size", enDesc: "Adjust quality and dimensions, export JPEG/WebP." },
    { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Yükleme yok — cihazında saniyeler içinde.", en: "Instant & free", enDesc: "No upload — done on your device in seconds." },
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
        trDesc: "Yükleme yok — cihazında saniyeler içinde biter.",
        en: "Instant & free",
        enDesc: "No upload — finished on your device in seconds.",
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
