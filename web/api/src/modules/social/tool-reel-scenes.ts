/**
 * Video SAHNESİ hazır olan araçlar. Otomatik sıra, panel ve üretim ucu yalnız bunları kullanır;
 * sahnesi olmayan araç için video istenmez (eski ekran kaydı biçimi kaldırıldı).
 *
 * `frontend/scripts/tool-reels/scenes/index.mjs` içindeki `SCENES` ile aynı olmalıdır
 * (frontend testi `reelScenes.test.ts` denetler). Metinler yine `tool-reel-catalog.ts`'tedir.
 */
export const REEL_SCENE_TOOL_IDS: readonly string[] = ["udf-to-pdf", "gorsel-sikistir", "aranabilir-pdf", "pdf-to-excel"];
