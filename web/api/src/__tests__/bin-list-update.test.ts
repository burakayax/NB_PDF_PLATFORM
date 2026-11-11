import { describe, expect, it } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";

const scriptUrl = pathToFileURL(path.resolve(process.cwd(), "scripts", "update-bin-list.mjs")).href;
const mod: any = await import(/* @vite-ignore */ scriptUrl);

describe("update-bin-list: CSV ayrıştırma ve fark raporu", () => {
  it("tırnaklı alanları, alan içi virgülü ve kaçışlı tırnağı doğru okur", () => {
    const rows = mod.parseCsv('bin,issuer,alpha_2\n454360,"Garanti, BBVA ""Bonus""",TR\n411111,Chase,US\n');
    expect(rows).toEqual([
      ["bin", "issuer", "alpha_2"],
      ["454360", 'Garanti, BBVA "Bonus"', "TR"],
      ["411111", "Chase", "US"],
    ]);
  });
  it("yalnız 6–8 haneli BIN ve 2 harfli ülkeyi alır; 5 haneli/bozuk satırı atar", () => {
    const m = mod.extractBinCountries("bin,alpha_2\n454360,tr\n41111,US\n123456,\n999999,USA\n12345678,DE\n");
    expect([...m.entries()]).toEqual([["454360", "TR"], ["12345678", "DE"]]);
  });
  it("beklenen sütunlar yoksa hata verir", () => {
    expect(() => mod.extractBinCountries("a,b\n1,2\n")).toThrow(/sütun/);
  });
  it("fark raporu TR kayıtlarındaki her değişikliği öne çıkarır", () => {
    const oldMap = new Map([["454360", "TR"], ["411111", "US"], ["500000", "TR"]]);
    const newMap = new Map([["454360", "DE"], ["411111", "US"], ["600000", "TR"]]);
    const d = mod.diffReport(oldMap, newMap);
    expect(d).toMatchObject({ added: 1, removed: 1, changed: 1 });
    expect(d.trChanges).toEqual(["~ 454360: TR → DE", "+ 600000 eklendi (TR)", "- 500000 çıkarıldı (eskiden TR)"]);
  });
});
