import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MEMBER_DAILY_OPS } from "../components/tools/GuestCompressTool";

/**
 * PDF SIKIŞTIR HAK VAADİ GERÇEK OLMALI.
 *
 * Misafir sayfası ve sonuç davetleri "günde 3 işlem" (üye) ve sunucu "günde 1" (misafir) der.
 * Bu rakamlar kodda ayrı yerlerde yaşar; biri değişip ötekisi unutulursa ziyaretçiye verilmeyen bir
 * şey vaat edilir. Test sayıları kaynaklarına bağlar.
 */
const buDosya = dirname(fileURLToPath(import.meta.url));
const planConfig = resolve(buDosya, "../../../api/src/modules/subscription/subscription.config.ts");
const misafirAyari = resolve(buDosya, "../../../api/src/modules/guest-compress/guest-compress.config.ts");
const misafirYedek = resolve(buDosya, "../../../backend/app/core/guest_daily_limit.py");

describe("PDF Sıkıştır hak vaadi", () => {
  it("üye (FREE) günlük hakkı arayüzdeki rakamla aynı", () => {
    const kaynak = readFileSync(planConfig, "utf8");
    const free = kaynak.match(/FREE:\s*\{[\s\S]*?dailyLimit:\s*(\d+)/);
    expect(free, "FREE planı bulunamadı").not.toBeNull();
    expect(Number(free![1])).toBe(MEMBER_DAILY_OPS);
  });

  it("sıkıştırma ücretsiz plan araç listesinde", () => {
    const kaynak = readFileSync(planConfig, "utf8");
    const blok = kaynak.match(/const FREE_TOOLS: FeatureKey\[\] = \[([\s\S]*?)\n\];/);
    expect(blok).not.toBeNull();
    expect(blok![1]).toContain('"compress"');
  });

  it("misafir günlük hakkı panel varsayılanında ve PDF servisi yedeğinde 1", () => {
    const panel = readFileSync(misafirAyari, "utf8").match(/GUEST_COMPRESS_DEFAULTS[\s\S]*?dailyLimit:\s*(\d+)/);
    expect(panel, "panel varsayılanı bulunamadı").not.toBeNull();
    expect(Number(panel![1])).toBe(1);
    const yedek = readFileSync(misafirYedek, "utf8");
    expect(yedek).toMatch(/_env_int\("GUEST_COMPRESS_DAILY_LIMIT",\s*1\)/);
  });

  it("misafir varsayılan hakkı üye hakkından küçük (dönüşüm: üyelik daha avantajlı)", () => {
    const panel = readFileSync(misafirAyari, "utf8").match(/GUEST_COMPRESS_DEFAULTS[\s\S]*?dailyLimit:\s*(\d+)/);
    expect(Number(panel![1])).toBeLessThan(MEMBER_DAILY_OPS);
  });

  it("panel, 0'ı 'sınırsız' değil 'kapalı' sayar", () => {
    const kaynak = readFileSync(misafirAyari, "utf8");
    expect(kaynak).toMatch(/isGuestCompressClosed[\s\S]*dailyLimit <= 0/);
  });
});
