/**
 * Araç istek gövdesi — her aracın sunucuya hangi alanları gönderdiği.
 *
 * Alan ADLARI sunucudaki karşılıklarıyla birebir aynı olmak zorundadır; bir
 * harf kayarsa hata vermez, sadece o ayar sessizce yok sayılır (ör. parola
 * gitmezse şifreli PDF "bozuk" görünür). Bu yüzden adlar burada tek tek
 * sabitlenmiştir.
 */
import { describe, it, expect } from "vitest";
import { buildToolFormData, type ToolFormState } from "../lib/toolFormData";

const pdf = (name = "a.pdf") =>
  new File(["%PDF-1.4"], name, { type: "application/pdf" });

function state(over: Partial<ToolFormState> = {}): ToolFormState {
  return {
    files: [pdf()],
    password: "",
    htmlToPdfMode: "url",
    htmlToPdfUrl: "https://ornek.com",
    htmlToPdfRaw: "<p>merhaba</p>",
    pagesText: "1-3",
    splitMode: "single",
    compressQuality: "auto",
    deletePagesText: "2",
    rotatePageRotations: {},
    organizePageOrder: [3, 1, 2],
    unlockOpenPassword: "acilis",
    watermarkPhrase: "GİZLİ",
    watermarkColor: "#ff0000",
    watermarkFont: "helv",
    watermarkOpacity: "0.3",
    pageNumStart: "5",
    pageNumPos: "bottom-center",
    pageNumFmt: "n",
    pdfToImgFmt: "png",
    inputPassword: "eski",
    outputPassword: "yeni",
    ...over,
  };
}

const keys = (fd: FormData) => [...fd.keys()].sort();

describe("buildToolFormData", () => {
  it("sayfa ayırma: sayfa listesi, mod ve parola", () => {
    const fd = buildToolFormData("split", state({ password: "1234" }));
    expect(fd.get("pages_text")).toBe("1-3");
    expect(fd.get("mode")).toBe("single");
    expect(fd.get("password")).toBe("1234");
    expect(fd.get("file")).toBeInstanceOf(File);
  });

  it("sıkıştırma: kalite kademesi gönderilir", () => {
    const fd = buildToolFormData("compress", state({ compressQuality: "low" }));
    expect(fd.get("quality")).toBe("low");
  });

  it("döndürme: seçim varsa açı listesi, yoksa 90 derece", () => {
    const secim = buildToolFormData(
      "rotate-pdf",
      state({ rotatePageRotations: { "1": 90, "2": 0 } }),
    );
    expect(JSON.parse(String(secim.get("pages_rotation_json")))).toEqual({
      "1": 90,
    });
    expect(secim.get("degrees")).toBeNull();

    const secimsiz = buildToolFormData("rotate-pdf", state());
    expect(secimsiz.get("degrees")).toBe("90");
  });

  it("filigran: metin, renk, yazı tipi ve saydamlık", () => {
    const fd = buildToolFormData("watermark", state());
    expect(fd.get("watermark_text")).toBe("GİZLİ");
    expect(fd.get("watermark_color")).toBe("#ff0000");
    expect(fd.get("watermark_font")).toBe("helv");
    expect(fd.get("watermark_opacity")).toBe("0.3");
  });

  it("sayfa numarası: başlangıç boşsa 1 kabul edilir", () => {
    const fd = buildToolFormData("page-numbers", state({ pageNumStart: "  " }));
    expect(fd.get("start_at")).toBe("1");
    expect(fd.get("position")).toBe("bottom-center");
    expect(fd.get("fmt")).toBe("n");
  });

  it("şifreleme: eski ve yeni parola ayrı alanlarda", () => {
    const fd = buildToolFormData("encrypt", state());
    expect(fd.get("input_password")).toBe("eski");
    expect(fd.get("user_password")).toBe("yeni");
  });

  it("kilit açma: açma parolası gönderilir", () => {
    const fd = buildToolFormData("unlock-pdf", state());
    expect(fd.get("password")).toBe("acilis");
  });

  it("HTML→PDF: adres veya ham içerik, dosya gönderilmez", () => {
    const adres = buildToolFormData("html-to-pdf", state());
    expect(adres.get("source_url")).toBe("https://ornek.com");
    expect(keys(adres)).toEqual(["source_url"]);

    const ham = buildToolFormData(
      "html-to-pdf",
      state({ htmlToPdfMode: "html" }),
    );
    expect(ham.get("html")).toBe("<p>merhaba</p>");
  });

  it("görsel→PDF: tüm dosyalar tek alanda gönderilir", () => {
    const fd = buildToolFormData(
      "image-to-pdf",
      state({ files: [pdf("1.png"), pdf("2.png")] }),
    );
    expect(fd.getAll("files")).toHaveLength(2);
    expect(fd.get("file")).toBeNull();
  });

  it("sayfa sırala: sıra virgülle gönderilir", () => {
    const fd = buildToolFormData("organize-pdf", state());
    expect(fd.get("page_order")).toBe("3,1,2");
  });

  it("parola boşsa gereksiz yere gönderilmez", () => {
    const fd = buildToolFormData("delete-pages", state({ password: "   " }));
    expect(fd.get("password")).toBeNull();
    expect(fd.get("pages_to_delete")).toBe("2");
  });
});
