import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  FREE_ACCOUNT_UNLOCKS,
  SIGNIN_ONLY_UNLOCKS,
} from "../components/tools/ValueMomentNudge";

/**
 * KAYIT DAVETİNİN VAADİ GERÇEK OLMALI.
 *
 * Sonuç ekranındaki davet, ücretsiz hesabın neyi açtığını isimle sayar. Bir süre
 * "Word · Excel · PPT'ye çevir" ve "AI: özetle & sohbet" vaat ediyordu; ikisi de
 * ücretsiz planda YOK (Word PLUS'tan itibaren, yapay zekâ hakkı ücretsizde 0).
 * Kaydolan kullanıcı vaadi bulamayınca güveni kırılıyor — ve bu, dönüşüm
 * huninin en pahalı yerinde olan bir kayıp.
 *
 * Bu test daveti, sunucudaki ücretsiz plan araç listesine karşı doğrular. Listeye
 * ücretli bir araç yazılırsa ya da bir araç ücretsiz plandan çıkarılırsa düşer.
 */

const buDosya = dirname(fileURLToPath(import.meta.url));
const planConfig = resolve(
  buDosya,
  "../../../api/src/modules/subscription/subscription.config.ts",
);

/** subscription.config.ts içindeki FREE_TOOLS dizisinin araç kimlikleri. */
function ucretsizPlanAraclari(): string[] {
  const kaynak = readFileSync(planConfig, "utf8");
  const blok = kaynak.match(/const FREE_TOOLS: FeatureKey\[\] = \[([\s\S]*?)\n\];/);
  if (!blok) {
    throw new Error("FREE_TOOLS listesi bulunamadı — subscription.config.ts değişmiş olabilir.");
  }
  return [...blok[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

describe("kayıt daveti vaadi", () => {
  it("ücretsiz plan listesi okunabiliyor", () => {
    const araclar = ucretsizPlanAraclari();
    expect(araclar.length).toBeGreaterThan(5);
    expect(araclar).toContain("merge");
  });

  it("vaat edilen her araç ücretsiz hesapla gerçekten açık", () => {
    const ucretsiz = new Set(ucretsizPlanAraclari());
    const yanlisVaat = FREE_ACCOUNT_UNLOCKS.filter(
      (u) => !ucretsiz.has(u.feature) && !SIGNIN_ONLY_UNLOCKS.has(u.feature),
    ).map((u) => u.feature);
    expect(yanlisVaat).toEqual([]);
  });

  it("ücretli araçlar ücretsiz diye vaat edilmiyor", () => {
    // Bunlar ücretli planlara aittir; davette geçerlerse test düşer.
    const ucretliler = ["pdf-to-word", "pdf-to-excel", "pdf-to-ppt", "watermark", "encrypt"];
    const sizmis = FREE_ACCOUNT_UNLOCKS.map((u) => u.feature).filter((f) =>
      ucretliler.includes(f),
    );
    expect(sizmis).toEqual([]);
  });

  it("davet boş değil", () => {
    expect(FREE_ACCOUNT_UNLOCKS.length).toBeGreaterThanOrEqual(3);
  });
});
