import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../lib/toolCatalog";
import { FREE_PLAN_TOOL_IDS, STARTER_TOOL_IDS } from "../lib/planConfig";
import { accountToneCount, toolAccessBadge } from "../lib/toolAccess";
import { CV_TEMPLATES } from "../components/tools/cv/cvTemplates";

const byId = (id: string) => {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) throw new Error(`araç yok: ${id}`);
  return t;
};

/** Sunucudaki plan listesini (subscription.config.ts) okur: `const <ad>: FeatureKey[] = [ ... ]`. */
function sunucuListesi(ad: string): string[] {
  const dir = dirname(fileURLToPath(import.meta.url));
  const kaynak = readFileSync(resolve(dir, "../../../api/src/modules/subscription/subscription.config.ts"), "utf8");
  const bas = kaynak.indexOf(`const ${ad}:`);
  const dizi = kaynak.slice(kaynak.indexOf("[", bas), kaynak.indexOf("];", bas));
  const satirlar = dizi.split("\n").map((s) => s.replace(/\/\/.*$/, "").trim());
  return satirlar.flatMap((s) => [...s.matchAll(/"([\w-]+)"/g)].map((m) => m[1]));
}

describe("araç erişim rozeti", () => {
  it("katalogdaki her araç için rozet üretiliyor", () => {
    for (const t of TOOLS) {
      const b = toolAccessBadge(t, true);
      expect(b.label.length, t.id).toBeGreaterThan(0);
      expect(toolAccessBadge(t, false).label.length, t.id).toBeGreaterThan(0);
    }
  });

  it("istisna araçların rozeti koddaki gerçek kuralı söylüyor", () => {
    const ek = (id: string) => toolAccessBadge(byId(id), true);
    expect(ek("compress")).toMatchObject({ tone: "guest" });
    expect(ek("pdf-duzenle")).toMatchObject({ tone: "guest" });
    expect(ek("imza-iste")).toMatchObject({ tone: "account" });
    expect(ek("imza-iste").label).toContain("ayda 1");
    expect(ek("hassas-veri-gizle")).toMatchObject({ tone: "guest" });
    expect(ek("hassas-veri-gizle").label).toContain("YZ");
    expect(ek("cv-olustur")).toMatchObject({ tone: "account" });
    expect(ek("ai-fotograf-studyosu").label).toBe("Başlangıç+");
  });

  it("yapay zekâ kategorisindeki her araç rozet taşıyor ve Başlangıç+ diyor", () => {
    const aiAraclar = TOOLS.filter((t) => t.cat === "ai");
    expect(aiAraclar.length).toBe(8);
    for (const t of aiAraclar) {
      const b = toolAccessBadge(t, true);
      expect(b.tone, t.id).toBe("ai");
      expect(b.label, t.id).toContain("Başlangıç+");
    }
    expect(toolAccessBadge(byId("pdf-ozetle"), true).label).toContain("3 hediye");
  });

  it("dönüşüm araçlarının seviyeleri doğru", () => {
    const seviye = (id: string) => toolAccessBadge(byId(id), true).tone;
    expect(seviye("pdf-to-word")).toBe("account");
    expect(seviye("word-to-pdf")).toBe("account");
    expect(seviye("pdf-to-excel")).toBe("plus");
    expect(seviye("excel-to-pdf")).toBe("plus");
    expect(seviye("pdf-to-ppt")).toBe("plus");
    expect(seviye("ppt-to-pdf")).toBe("plus");
  });

  it("mavi araç sayısı rozetlerden hesaplanıyor", () => {
    const elle = TOOLS.filter((t) => toolAccessBadge(t, true).tone === "account").length;
    expect(accountToneCount(TOOLS)).toBe(elle);
    expect(elle).toBeGreaterThan(0);
  });
});

describe("plan listeleri sunucu ile aynı", () => {
  it("ücretsiz plan araç listesi", () => {
    expect([...FREE_PLAN_TOOL_IDS].sort()).toEqual(sunucuListesi("FREE_TOOLS").sort());
  });

  it("başlangıç plan araç listesi (ücretsizdekiler + eklenenler)", () => {
    const sunucu = [...sunucuListesi("FREE_TOOLS"), ...sunucuListesi("STARTER_TOOLS")];
    expect([...STARTER_TOOL_IDS].sort()).toEqual(sunucu.sort());
  });
});

describe("CV rozeti şablon sayılarıyla uyumlu", () => {
  it("4 ücretsiz, 30 şablon", () => {
    expect(CV_TEMPLATES.filter((t) => t.free).length).toBe(4);
    expect(CV_TEMPLATES.length).toBe(30);
    expect(toolAccessBadge(byId("cv-olustur"), true).label).toContain("4 şablon");
    expect(toolAccessBadge(byId("cv-olustur"), true).detail).toContain("26");
  });
});

describe("ana sayfadaki sayı iddiaları katalogla uyumlu", () => {
  it("hero ve kapanış metinleri cihazda/üyeliksiz araç sayısını doğru söylüyor", async () => {
    const { ON_DEVICE_TOOLS } = await import("../lib/onDeviceTools");
    const { landingTranslations } = await import("../i18n/landing");
    const cihazda = ON_DEVICE_TOOLS.size;
    const uyeliksiz = TOOLS.filter((t) => t.free).length;
    const metin = JSON.stringify(landingTranslations);
    expect(metin).toContain(`${cihazda} tools run right in your browser, ${uyeliksiz} of them without an account`);
    expect(metin).toContain(`${cihazda} araç doğrudan tarayıcınızda çalışır, ${uyeliksiz}'ü üyeliksiz`);
    expect(metin).not.toContain("everything runs in your browser");
  });
});
