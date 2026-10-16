import { afterEach, describe, expect, it, vi } from "vitest";
import { toolVideoKeywords } from "../modules/social/keywords.service.js";
import { findCatalogEntry } from "../modules/social/tool-reels.service.js";

afterEach(() => vi.unstubAllGlobals());

describe("Araç videosu anahtar kelimeleri (ölçüme dayalı)", () => {
  it("otomatik tamamlamadan gelenleri ekler; rakip adı ve konu dışı terimleri eler; katalog terimlerini korur", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("suggestqueries.google.com")) {
        const q = new URL(url).searchParams.get("q") ?? "";
        const lang = new URL(url).searchParams.get("hl");
        const list =
          lang === "tr"
            ? [`${q} 1 mb`, `${q} online`, `${q} ücretsiz`, `${q} reddit`, "pdf sıkıştırma ilovepdf", "hava durumu istanbul"]
            : [`${q} free`, `${q} login`, `${q} iphone`, "weather tomorrow"];
        return new Response(JSON.stringify([q, list]));
      }
      throw new Error("kaynak yok");
    });
    const entry = findCatalogEntry("compress")!;
    // Bellek önbelleği başka testte dolmuş olabilir: benzersiz kimlikle çağır.
    const out = await toolVideoKeywords({ ...entry, id: "compress-test-1" });

    expect(out.tr).toContain("pdf sıkıştırma");
    // Güvenli ek ("online") ve doğrulanmış "ücretsiz" kabul edilir.
    expect(out.tr.some((t) => t.endsWith(" online"))).toBe(true);
    expect(out.tr.some((t) => t.endsWith(" ücretsiz"))).toBe(true);
    expect(out.en.some((t) => t.endsWith(" free"))).toBe(true);
    // Bilinmeyen ek (sayı, reddit, login, iphone), rakip adı ve konu dışı ifade elenir.
    expect(out.tr.join("|")).not.toMatch(/1 mb|reddit|ilove|hava durumu/i);
    expect(out.en.join("|")).not.toMatch(/login|iphone|weather/i);
    expect(out.tr.length).toBeLessThanOrEqual(30);
  });

  it("ücretsiz iddiası doğrulanmamış araçta (freeClaim yok) 'ücretsiz' eklenmez", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("suggestqueries.google.com")) {
        const q = new URL(url).searchParams.get("q") ?? "";
        return new Response(JSON.stringify([q, [`${q} ücretsiz`, `${q} free`, `${q} online`]]));
      }
      throw new Error("kaynak yok");
    });
    const entry = findCatalogEntry("compress")!;
    const out = await toolVideoKeywords({ ...entry, freeClaim: false, id: "compress-test-2" });
    expect(out.tr.join("|")).not.toMatch(/ücretsiz/);
    expect(out.en.join("|")).not.toMatch(/free/);
    expect(out.tr.some((t) => t.endsWith(" online"))).toBe(true);
  });

  it("tüm dış kaynaklar susarsa katalog terimleriyle devam eder", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ağ yok");
    });
    const entry = findCatalogEntry("merge")!;
    const out = await toolVideoKeywords({ ...entry, id: "merge-test-1" });
    expect(out.tr).toEqual(expect.arrayContaining(entry.keywords.tr));
  });
});
