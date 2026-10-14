/**
 * HAK AĞIRLIKLARI — günlük hak havuzunda bir işlemin kaç hak saydığı (rozet açıklamasında gösterilir).
 *
 * Sunucudaki `web/api/src/lib/quota.ts` → OPERATION_WEIGHTS ile AYNI olmak zorundadır
 * (`operation-weights.test.ts` ayrışmayı yakalar). Düşüm her zaman sunucuda yapılır; burada
 * yalnızca gösterim için kullanılır. Listede olmayan araç = 1 hak.
 */
export const OPERATION_WEIGHTS: Readonly<Record<string, number>> = {
  "pdf-to-image": 2,
  "pdf-to-ppt": 3,
};
