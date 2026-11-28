/**
 * Videosu hazır olan araçlar. Her araç için `<id>.html` (sahne) + `sounds.mjs` içinde `<id>` müziği gerekir.
 *
 * `processing`, videodaki gizlilik anlatımının hangi söze göre yazıldığıdır; üretimde
 * `src/content/toolProcessing.mjs` ile karşılaştırılır ve uyuşmazsa video ÜRETİLMEZ.
 *   device → "cihazından çıkmaz" (yalnız koşulsuz cihazda çalışan araç)
 *   server → "dosyan bize gelir, iş bitince bizden silinir"
 *
 * API tarafındaki liste (`web/api/src/modules/social/tool-reel-scenes.ts`) bununla aynı olmalıdır.
 */

export const SCENES = {
  "udf-to-pdf": { processing: "device" },
  "gorsel-sikistir": { processing: "device" },
  "aranabilir-pdf": { processing: "device" },
  "pdf-to-excel": { processing: "server" },
};

/** Aynı sahnenin üç sürümü; yalnız kapanıştaki yönlendirme satırı farklıdır. */
export const LINK_LINES = {
  profile: "Bağlantı profilde", // Instagram + TikTok
  caption: "Bağlantı açıklamada", // YouTube
  comment: "Bağlantı yorumlarda", // Facebook
};

/** Kapanıştaki araç vitrininin uzunluğu (sn). Sürümler yalnız bu bölümde ayrışır. */
export const OUTRO_SECONDS = 5.5;

/** Videoda ASLA geçmeyecek sözler (README.md → kurallar). */
export const BANNED_PHRASES = [
  /sunucu/i,
  /göremeyiz/i,
  /kimse göremez/i,
  /bize gelmi/i,
  /24 saat/i,
  /%\s*100\s*güven/i,
  /\d+\s?MB['’]?(a|ı|tan)?\s+(kadar|sınır|limit|üstü)/i,
];

/** Sahnenin gizlilik anlatımı aracın gerçek çalışma biçimiyle uyuşuyor mu? Uyuşmuyorsa nedeni döner. */
export function processingMismatch(id, toolRows) {
  const scene = SCENES[id];
  const row = toolRows.find((t) => t.id === id);
  if (!scene) return `${id}: sahne tanımlı değil`;
  if (!row) return `${id}: araç işleme tablosunda yok`;
  if (row.where !== scene.processing) return `${id}: sahne "${scene.processing}" diyor, araç "${row.where}" çalışıyor`;
  if (scene.processing === "device" && (row.noteTr ?? "") !== "") {
    return `${id}: araç koşullu olarak cihazda çalışıyor ("${row.noteTr}"); videoda koşulsuz söz verilemez`;
  }
  return null;
}
