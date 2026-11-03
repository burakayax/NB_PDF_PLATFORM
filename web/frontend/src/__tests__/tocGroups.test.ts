import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { orderByGroups, suggestGroup, ungroupedItems, normalizeTr, type TocGroup } from "../lib/tocGroups";
import { mergeWithToc } from "../lib/pdfToc";

const G: TocGroup[] = [
  { id: 1, name: "FATURALAR", subs: [{ id: 11, name: "İnternet" }, { id: 12, name: "Telefon" }] },
  { id: 2, name: "SÖZLEŞMELER", subs: [{ id: 21, name: "İhale" }] },
  { id: 3, name: "KAYNAKLAR", subs: [] },
];
const oge = (id: number, gid: number | null, sid: number | null = null) => ({ id, gid, sid });

describe("grup mantığı", () => {
  it("Türkçe karakterleri sadeleştirir", () => {
    expect(normalizeTr("SÖZLEŞMELER İhale")).toBe("sozlesmeler ihale");
  });

  it("dosya adından grup ve alt başlık önerir", () => {
    expect(suggestGroup("fatura-internet-ocak.pdf", G)).toEqual({ gid: 1, sid: 11 });
    expect(suggestGroup("Telefon Faturası.pdf", G)).toEqual({ gid: 1, sid: 12 });
    expect(suggestGroup("ihale_sozlesmesi.pdf", G)).toEqual({ gid: 2, sid: 21 });
    expect(suggestGroup("kaynak notlari.pdf", G)).toEqual({ gid: 3, sid: null });
    expect(suggestGroup("vekaletname.pdf", G)).toBeNull();
  });

  it("grup yokken gruplanmamış sayılmaz; varken atanmayanlar bulunur", () => {
    expect(ungroupedItems([oge(1, null)], [])).toEqual([]);
    expect(ungroupedItems([oge(1, null), oge(2, 1), oge(3, 99)], G).map((x) => x.id)).toEqual([1, 3]);
  });

  it("birleşme sırası: grup sırası, alt başlıksızlar önce, sonra alt başlıklar", () => {
    const sira = orderByGroups([oge(1, 2), oge(2, 1, 12), oge(3, 1), oge(4, 1, 11), oge(5, 2, 21), oge(6, 3)], G);
    expect(sira.map((x) => x.item.id)).toEqual([3, 4, 2, 1, 5, 6]);
    expect(sira.map((x) => [x.group, x.subgroup])).toEqual([
      ["FATURALAR", undefined], ["FATURALAR", "İnternet"], ["FATURALAR", "Telefon"],
      ["SÖZLEŞMELER", undefined], ["SÖZLEŞMELER", "İhale"], ["KAYNAKLAR", undefined],
    ]);
  });

  it("grup yoksa sıra olduğu gibi kalır", () => {
    expect(orderByGroups([oge(2, null), oge(1, null)], []).map((x) => x.item.id)).toEqual([2, 1]);
  });
});

describe("yeni yazı tipleri", () => {
  it.each(["Lato", "PTSans", "PTSerif", "FiraSans", "SourceSans", "LiberationMono"])("%s ile Türkçe içindekiler üretilir", async (aile) => {
    const f = new Uint8Array(readFileSync(`public/fonts/toc/${aile}-Regular.ttf`));
    const b = new Uint8Array(readFileSync(`public/fonts/toc/${aile}-Bold.ttf`));
    const mk = async (ad: string) => {
      const d = await PDFDocument.create();
      d.addPage([595, 842]);
      return { name: ad, title: "Çağrı Şişli İğne Öğün ığüşö İ", bytes: new Uint8Array(await d.save()), group: "ÇÖZÜM ŞİRKETİ" };
    };
    const r = await mergeWithToc([await mk("a.pdf"), await mk("b.pdf")], {
      heading: "İçindekiler", continued: "(devam)", numbering: true, pageFooter: false, pageWord: "Sayfa",
      backLinks: false, backLabel: "x", fontBytes: f, boldBytes: b,
    });
    expect(r.sections).toHaveLength(2);
  });
});
