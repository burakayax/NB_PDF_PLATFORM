import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SEO "yapıldı listesi" (scripts/agents/yapilanlar.mjs + yapilanlar.txt).
const p = new URL("../../../../scripts/agents/yapilanlar.mjs", import.meta.url).href;
type Item = { tarih: string; sayfa: string; aciklama: string };
const mod = (await import(/* @vite-ignore */ p)) as {
  parseYapilanlar: (t: string) => Item[];
  bekleyenler: (i: Item[], now: number, gun?: number) => Item[];
  seoBlok: (i: Item[]) => string;
  mailSatirlari: (i: Item[]) => string[];
};
const mp = new URL("../../../../scripts/agents/mail.mjs", import.meta.url).href;
const mail = (await import(/* @vite-ignore */ mp)) as { buildMail: (x: Record<string, unknown>) => { html: string; text: string } };

describe("yapıldı listesi", () => {
  const txt = "# yorum\n\n2026-11-19 | /en/tools/resize-pdf | Başlık güncellendi.\nbozuk satır\n2026-13-99 | x | geçersiz tarih\n2026-10-01 | /blog/x | Eski değişiklik.";
  it("satırları ayrıştırır; yorum, boş ve bozuk satırları atlar", () => {
    const r = mod.parseYapilanlar(txt);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ tarih: "2026-11-19", sayfa: "/en/tools/resize-pdf", aciklama: "Başlık güncellendi." });
  });
  it("yalnız son 21 gün 'sonuç bekleniyor' sayılır", () => {
    const r = mod.parseYapilanlar(txt);
    const b = mod.bekleyenler(r, Date.parse("2026-11-22T00:00:00Z"));
    expect(b.map((x) => x.sayfa)).toEqual(["/en/tools/resize-pdf"]);
    expect(mod.bekleyenler(r, Date.parse("2026-12-30T00:00:00Z"))).toHaveLength(0);
  });
  it("SEO ajanı bloğu 'tekrar yazma' talimatı içerir; liste boşsa boş döner", () => {
    const r = mod.parseYapilanlar(txt);
    expect(mod.seoBlok(r)).toContain("TEKRAR YAZMA");
    expect(mod.seoBlok(r)).toContain("/en/tools/resize-pdf");
    expect(mod.seoBlok([])).toBe("");
  });
  it("e-postada 'Yapıldı, sonuç bekleniyor' satırı çıkar; liste yoksa çıkmaz", () => {
    const base = { date: "2026-11-22", attention: [], now: null, prev: null, gsc: null, seoTips: [], social: [], footer: "f" };
    const a = mail.buildMail({ ...base, done: mod.mailSatirlari(mod.parseYapilanlar(txt).slice(0, 1)) });
    expect(a.html).toContain("Yapıldı, sonuç bekleniyor");
    expect(a.text).toContain("Yapıldı, sonuç bekleniyor: /en/tools/resize-pdf (19.11)");
    expect(mail.buildMail({ ...base, done: [] }).html).not.toContain("Yapıldı, sonuç bekleniyor");
  });
  it("gerçek yapilanlar.txt dosyası geçerli ve boş değil", () => {
    const real = readFileSync(fileURLToPath(new URL("../../../../scripts/agents/yapilanlar.txt", import.meta.url)), "utf8");
    expect(mod.parseYapilanlar(real).length).toBeGreaterThanOrEqual(4);
  });
});
