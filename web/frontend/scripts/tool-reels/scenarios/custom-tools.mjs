/**
 * Kendi ekran düzeni olan (form.tool-form kullanmayan) ve dosyasız çalışan araçların senaryoları.
 * Çekim iskeleti lib/kit.mjs'te.
 */

import { clickAt, dragRange, pickOption, simpleTool, typeInto } from "../lib/kit.mjs";

const btn = (re) => (pg) => pg.getByRole("button", { name: re });
const selectByLabel = (pg, label) => pg.getByText(label, { exact: true }).locator("xpath=ancestor::label[1]").locator("select");

export const CUSTOM = {
  "gorsel-sikistir": simpleTool({
    id: "gorsel-sikistir",
    toolPath: "/tools/gorsel-sikistir",
    intro: { title: "Görsel Sıkıştırma", sub: "Fotoğrafları kaliteyi koruyarak küçült" },
    files: ["Manzara.jpg"],
    pick: { l1: "Fotoğrafını yükle", l2: "birden çoğunu da seçebilirsin" },
    options: [
      {
        title: "Ölçüyü seç",
        l1: "Uzun kenarı küçültürsen",
        l2: "dosya çok daha hafifler",
        run: async (st) => pickOption(st, selectByLabel(st.pg, "Ölçü"), /1920/),
      },
      {
        title: "Kaliteyi ayarla",
        l1: "Çubuğu sola çekersen",
        l2: "dosya daha çok küçülür",
        run: async (st) => dragRange(st, st.pg.locator("input[type=range]").first(), 55),
      },
    ],
    button: btn(/^Sıkıştır$/),
    press: { title: "Sıkıştır'a bas", l1: "" },
    resultLine: "Fotoğraf küçüldü",
  }),

  "gorsel-boyutlandir": simpleTool({
    id: "gorsel-boyutlandir",
    toolPath: "/tools/gorsel-boyutlandir",
    intro: { title: "Görsel Boyutlandırma", sub: "Fotoğrafı istediğin ölçüye getir" },
    files: ["Manzara.jpg"],
    pick: { l1: "Fotoğrafını yükle", l2: "" },
    options: [
      {
        title: "Hazır ölçü seç",
        l1: "Instagram, vesikalık, vize…",
        l2: "ya da genişlik/yüksekliği kendin yaz",
        run: async (st) => pickOption(st, selectByLabel(st.pg, "Hazır ölçüler"), /Instagram gönderi \(kare\)/),
      },
    ],
    button: btn(/^Boyutlandır$/),
    press: { title: "Boyutlandır'a bas", l1: "" },
    resultLine: "Fotoğraf 1080 × 1080 oldu",
  }),

  "udf-to-pdf": simpleTool({
    id: "udf-to-pdf",
    toolPath: "/tools/udf-to-pdf",
    intro: { title: "UDF → PDF", sub: "UYAP belgesini program kurmadan PDF yap" },
    files: ["Dilekce.udf"],
    pick: { l1: "UYAP'tan inen .udf dosyanı seç", l2: "" },
    button: btn(/PDF'e çevir/),
    press: { title: "PDF'e çevir", l1: "Program kurmana gerek yok" },
    resultLine: "UDF belgesi PDF oldu",
  }),

  "html-to-pdf": simpleTool({
    id: "html-to-pdf",
    toolPath: "/tools/html-to-pdf",
    intro: { title: "HTML → PDF", sub: "Web sayfasını olduğu gibi PDF'e al" },
    files: [],
    options: [
      {
        title: "Sayfa adresini yaz",
        l1: "Herhangi bir web sayfası",
        l2: "olduğu gibi PDF olur",
        run: async (st) => typeInto(st, st.pg.getByPlaceholder("https://").first(), "https://example.com", { delay: 55 }),
      },
    ],
    button: btn(/PDF OLUŞTUR/),
    press: { title: "PDF oluştur'a bas", l1: "" },
    resultLine: "Web sayfası PDF oldu",
  }),

  "ustveri-temizle": simpleTool({
    id: "ustveri-temizle",
    toolPath: "/tools/ustveri-temizle",
    intro: { title: "PDF Üstveri Temizleme", sub: "Belgeden gizli izleri sil" },
    files: ["Rapor-Hafif.pdf"],
    pick: { l1: "PDF'ini yükle", l2: "gizli bilgiler gösterilir" },
    options: [
      {
        title: "Belgede neler var gör",
        l1: "Yazar, program, tarih",
        l2: "ve fotoğraf konum izleri",
        run: async (st) => {
          const h = st.pg.getByText("BELGEDE BULUNANLAR", { exact: false }).first();
          if (await h.count()) {
            await st.hl(h, 12);
            await st.wait(2200);
            await st.hlOff();
          }
        },
      },
    ],
    button: btn(/Üstveriyi temizle/),
    press: { title: "Üstveriyi temizle", l1: "" },
    resultLine: "Gizli izler silindi",
  }),

  "form-doldur": simpleTool({
    id: "form-doldur",
    toolPath: "/tools/form-doldur",
    intro: { title: "PDF Form Doldurma", sub: "Formu bilgisayarında doldur" },
    files: ["Basvuru-Formu.pdf"],
    pick: { l1: "Doldurulabilir formunu yükle", l2: "alanlar otomatik bulunur" },
    options: [
      {
        title: "Alanları doldur",
        l1: "Bulunan alanlara yaz",
        l2: "",
        run: async (st) => {
          const inputs = st.pg.locator("input[type=text]");
          const values = ["Ayşe Demir", "ayse.demir@ornek.com", "0532 000 00 00", "İstanbul"];
          for (let i = 0; i < values.length; i++) await typeInto(st, inputs.nth(i), values[i], { delay: 45 });
          await clickAt(st, st.pg.locator("input[type=checkbox]").first(), { hold: 600 });
        },
      },
    ],
    button: btn(/Formu doldur/),
    press: { title: "Formu doldur'a bas", l1: "Alanlar kilitlenir" },
    resultLine: "Form dolduruldu",
  }),

  "taranmis-pdf-ocr": simpleTool({
    id: "taranmis-pdf-ocr",
    toolPath: "/tools/taranmis-pdf-ocr",
    intro: { title: "Taranmış PDF (OCR)", sub: "Taranmış sayfadaki yazıyı metne çevir" },
    files: ["Taranmis-Belge.pdf"],
    pick: { l1: "Taranmış PDF'ini yükle", l2: "fotoğraf da olabilir" },
    button: btn(/Aranabilir PDF Yap/),
    press: { title: "Başlat'a bas", l1: "Sayfadaki yazılar tanınır" },
    timeout: 300000,
    resultText: /^Aranabilir PDF hazır/,
    resultLine: "Yazı artık okunabilir metin",
  }),

  "aranabilir-pdf": simpleTool({
    id: "aranabilir-pdf",
    toolPath: "/tools/aranabilir-pdf",
    intro: { title: "Aranabilir PDF", sub: "Taranmış belgede Ctrl+F ile ara" },
    files: ["Taranmis-Belge.pdf"],
    pick: { l1: "Taranmış belgeni yükle", l2: "" },
    button: btn(/Aranabilir PDF Yap/),
    press: { title: "Başlat'a bas", l1: "Ctrl+F ile kelime aratabilirsin" },
    timeout: 300000,
    resultText: /^Aranabilir PDF hazır/,
    resultLine: "Belge artık aranabilir",
  }),
};
