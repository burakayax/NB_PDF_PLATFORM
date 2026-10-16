/**
 * "Dosyayı seç → (ayar) → büyük düğme → sonuç" akışındaki araçların senaryoları.
 * Çekim iskeleti lib/kit.mjs'te; burada yalnızca her aracın KENDİNE ÖZGÜ bilgisi var.
 *
 * Yazılar aracın gerçek davranışına dayanır (src/lib/toolCatalog.ts açıklamaları + ekran).
 */

import { pickOption, simpleTool, typeInto } from "../lib/kit.mjs";

const btn = (re) => (pg) => pg.getByRole("button", { name: re });
const R = "Rapor-Hafif.pdf";
const selectByLabel = (pg, label) => pg.getByText(label, { exact: true }).locator("xpath=ancestor::label[1]").locator("select");

export const SIMPLE = {
  "grayscale-pdf": simpleTool({
    id: "grayscale-pdf",
    toolPath: "/tools/grayscale-pdf",
    intro: { title: "PDF Gri Tonlama", sub: "Renkli PDF'i siyah-beyaza çevir" },
    files: [R],
    pick: { l1: "Renkli bir PDF yükle", l2: "yazdırmadan önce griye çevir" },
    button: btn(/GRİYE ÇEVİR/),
    press: { title: "Griye çevir'e bas", l1: "Metin seçilebilir kalır" },
    resultLine: "Renkli PDF siyah-beyaz oldu",
  }),

  "flatten-pdf": simpleTool({
    id: "flatten-pdf",
    toolPath: "/tools/flatten-pdf",
    intro: { title: "PDF Düzleştirme", sub: "Formu sabitle, değiştirilemez yap" },
    files: ["Basvuru-Formu.pdf"],
    pick: { l1: "Doldurulmuş formunu yükle", l2: "" },
    button: btn(/DÜZLEŞTİR/),
    press: { title: "Düzleştir'e bas", l1: "Form ve katmanlar sabitlenir" },
    resultLine: "Belge artık değiştirilemez",
  }),

  "pdf-to-word": simpleTool({
    id: "pdf-to-word",
    toolPath: "/tools/pdf-to-word",
    intro: { title: "PDF → Word", sub: "Düzenlenebilir Word belgesine çevir" },
    files: [R],
    pick: { l1: "PDF'ini yükle", l2: "Word'de düzenleyebilirsin" },
    button: btn(/WORD İNDİR/),
    press: { title: "Word'e çevir", l1: "Düzenlenebilir belge olur" },
    resultLine: "PDF, Word belgesine dönüştü",
  }),

  "pdf-to-excel": simpleTool({
    id: "pdf-to-excel",
    toolPath: "/tools/pdf-to-excel",
    intro: { title: "PDF → Excel", sub: "Tabloları hesaplanabilir Excel'e aktar" },
    files: ["Satis-Tablosu.pdf"],
    pick: { l1: "Tablolu PDF'ini yükle", l2: "" },
    button: btn(/EXCEL İNDİR/),
    press: { title: "Excel'e çevir", l1: "Tablo hücrelere ayrılır" },
    resultLine: "Tablo Excel sayfasına aktarıldı",
  }),

  "pdf-to-ppt": simpleTool({
    id: "pdf-to-ppt",
    toolPath: "/tools/pdf-to-ppt",
    intro: { title: "PDF → PowerPoint", sub: "Sayfaları düzenlenebilir slaytlara çevir" },
    files: ["Sozlesme.pdf"],
    pick: { l1: "PDF'ini yükle", l2: "" },
    button: btn(/PPTX İNDİR/),
    press: { title: "Slayta çevir", l1: "Her sayfa bir slayt olur" },
    resultLine: "PDF, sunuma dönüştü",
  }),

  "word-to-pdf": simpleTool({
    id: "word-to-pdf",
    toolPath: "/tools/word-to-pdf",
    intro: { title: "Word → PDF", sub: "Herkesin açabildiği PDF yap" },
    files: ["Teklif.docx"],
    pick: { l1: "Word dosyanı yükle", l2: ".doc ya da .docx" },
    button: btn(/PDF İNDİR/),
    press: { title: "PDF'e çevir", l1: "Her cihazda aynı görünür" },
    resultLine: "Word belgesi PDF oldu",
  }),

  "excel-to-pdf": simpleTool({
    id: "excel-to-pdf",
    toolPath: "/tools/excel-to-pdf",
    intro: { title: "Excel → PDF", sub: "Tabloyu bozmadan PDF yap" },
    files: ["Satis-Tablosu.xlsx"],
    pick: { l1: "Excel dosyanı yükle", l2: "" },
    button: btn(/PDF İNDİR/),
    press: { title: "PDF'e çevir", l1: "Tablo olduğu gibi kalır" },
    resultLine: "Excel tablosu PDF oldu",
  }),

  "ppt-to-pdf": simpleTool({
    id: "ppt-to-pdf",
    toolPath: "/tools/ppt-to-pdf",
    intro: { title: "PowerPoint → PDF", sub: "Her cihazda aynı görünen PDF" },
    files: ["Sunum.pptx"],
    pick: { l1: "Sunumunu yükle", l2: "" },
    button: btn(/PDF İNDİR/),
    press: { title: "PDF'e çevir", l1: "Slaytlar sayfa olur" },
    resultLine: "Sunum PDF oldu",
  }),

  "pdf-to-text": simpleTool({
    id: "pdf-to-text",
    toolPath: "/tools/pdf-to-text",
    intro: { title: "PDF → Metin", sub: "Belgedeki yazıyı düz metin olarak al" },
    files: ["Sozlesme.pdf"],
    pick: { l1: "PDF'ini yükle", l2: "" },
    button: btn(/METİN ÇIK/),
    press: { title: "Metni çıkar", l1: "Tüm yazı düz metin olur" },
    resultLine: "Yazı düz metin olarak hazır",
  }),

  "pdf-to-pdfa": simpleTool({
    id: "pdf-to-pdfa",
    toolPath: "/tools/pdf-to-pdfa",
    intro: { title: "PDF → PDF/A", sub: "Kurumların istediği arşiv biçimi" },
    files: [R],
    pick: { l1: "PDF'ini yükle", l2: "" },
    options: [
      {
        title: "Uyumluluk düzeyini seç",
        l1: "Çoğu kurum için PDF/A-2b",
        l2: "yazı tipleri belgeye gömülür",
        run: async (st) => pickOption(st, selectByLabel(st.pg, "Uyumluluk düzeyi"), /PDF\/A-2b/),
      },
    ],
    button: btn(/ARŞİVE ÇEVİR/),
    press: { title: "Arşive çevir'e bas", l1: "" },
    resultLine: "PDF arşiv biçimine çevrildi",
  }),

  "deskew-pdf": simpleTool({
    id: "deskew-pdf",
    toolPath: "/tools/deskew-pdf",
    intro: { title: "Eğri Tarama Düzeltme", sub: "Eğri taranmış sayfaları düzelt" },
    files: ["Taranmis-Belge.pdf"],
    pick: { l1: "Eğri taranmış PDF'i yükle", l2: "" },
    button: btn(/EĞRİLİĞİ DÜZELT/),
    press: { title: "Eğriliği düzelt", l1: "Sayfalar düz hâle gelir" },
    resultLine: "Eğri sayfalar düzeltildi",
  }),

  "repair-pdf": simpleTool({
    id: "repair-pdf",
    toolPath: "/tools/repair-pdf",
    intro: { title: "PDF Onarma", sub: "Açılmayan dosyayı kurtar" },
    files: ["Bozuk-Rapor.pdf"],
    pick: { l1: "Açılmayan PDF'i yükle", l2: "" },
    button: btn(/ONARILMIŞ PDF AL/),
    press: { title: "Onar'a bas", l1: "Kurtarılabilen sayfalar alınır" },
    resultLine: "Bozuk dosya kurtarıldı",
  }),

  "extract-images": simpleTool({
    id: "extract-images",
    toolPath: "/tools/extract-images",
    intro: { title: "PDF'ten Görsel Çıkar", sub: "Belgedeki fotoğrafları ayrı dosya yap" },
    files: [R],
    pick: { l1: "Görselli PDF'i yükle", l2: "" },
    button: btn(/GÖRSELLERİ ÇIKAR/),
    press: { title: "Görselleri çıkar", l1: "Hepsi ZIP içinde gelir" },
    resultLine: "Görseller ZIP olarak hazır",
  }),

  "resize-pdf": simpleTool({
    id: "resize-pdf",
    toolPath: "/tools/resize-pdf",
    intro: { title: "PDF Sayfa Boyutu", sub: "Sayfaları A4, A5 ya da Letter yap" },
    files: [R],
    pick: { l1: "PDF'ini yükle", l2: "" },
    options: [
      {
        title: "Hedef boyutu seç",
        l1: "A4, A5, A3, Letter, Legal…",
        l2: "ya da özel ölçü yaz",
        run: async (st) => pickOption(st, selectByLabel(st.pg, "Hedef boyut"), /A5/),
      },
    ],
    button: btn(/BOYUTLANDIR/),
    press: { title: "Boyutlandır'a bas", l1: "" },
    resultLine: "Sayfalar A5 boyutuna getirildi",
  }),

  "flip-pdf": simpleTool({
    id: "flip-pdf",
    toolPath: "/tools/flip-pdf",
    intro: { title: "PDF Çevir (Ayna)", sub: "Sayfaları ayna gibi çevir" },
    files: [R],
    pick: { l1: "PDF'ini yükle", l2: "" },
    options: [
      {
        title: "Yönü seç",
        l1: "Yatay ya da dikey ayna",
        l2: "istediğin sayfa aralığına uygula",
        run: async (st) => {
          const b = st.pg.getByRole("button", { name: /Yatay \(soldan sağa\)/ });
          const c = await st.center(b);
          await st.moveTo(c.x, c.y);
          await st.hl(b, 6);
          await st.wait(1300);
          await st.pg.mouse.click(c.x, c.y);
          await st.wait(600);
          await st.hlOff();
        },
      },
    ],
    button: btn(/^ÇEVİR$/),
    press: { title: "Çevir'e bas", l1: "" },
    resultLine: "Sayfalar ayna gibi çevrildi",
  }),

  encrypt: simpleTool({
    id: "encrypt",
    toolPath: "/tools/encrypt",
    intro: { title: "PDF Şifreleme", sub: "Belgeyi parolayla koru" },
    files: ["Sozlesme.pdf"],
    pick: { l1: "PDF'ini yükle", l2: "" },
    options: [
      {
        title: "Bir parola belirle",
        l1: "Belgeyi açmak için gerekir",
        l2: "",
        run: async (st) => typeInto(st, st.pg.getByPlaceholder("Yeni parola girin").first(), "Demo-2026!"),
      },
    ],
    button: btn(/ŞİFRELİ PDF İNDİR/),
    press: { title: "Şifrele'ye bas", l1: "" },
    resultLine: "Belge parolayla korundu",
  }),

  "unlock-pdf": simpleTool({
    id: "unlock-pdf",
    toolPath: "/tools/unlock-pdf",
    intro: { title: "PDF Şifre Kaldırma", sub: "Parolasını bildiğin belgenin kilidini aç" },
    files: ["Sifreli-Sozlesme.pdf"],
    pick: { l1: "Şifreli PDF'i yükle", l2: "" },
    options: [
      {
        title: "Mevcut parolayı yaz",
        l1: "Parolayı biliyor olman gerekir",
        l2: "",
        run: async (st) => typeInto(st, st.pg.getByPlaceholder("Belgeyi açan parola").first(), "demo123"),
      },
    ],
    button: btn(/AÇIK PDF AL/),
    press: { title: "Kilidi aç", l1: "" },
    resultLine: "Belgenin kilidi açıldı",
  }),

  "pdf-to-image": simpleTool({
    id: "pdf-to-image",
    toolPath: "/tools/pdf-to-image",
    intro: { title: "PDF → Görsel", sub: "Her sayfayı ayrı fotoğraf yap" },
    files: ["Sozlesme.pdf"],
    pick: { l1: "PDF'ini yükle", l2: "" },
    options: [
      {
        title: "Biçimi seç",
        l1: "JPG, PNG ya da TIFF",
        l2: "çözünürlük de ayarlanır",
        run: async (st) => pickOption(st, selectByLabel(st.pg, "Görüntü biçimi"), /PNG/),
      },
    ],
    button: btn(/ZIP İNDİR/),
    press: { title: "Görsele çevir", l1: "Her sayfa bir dosya olur" },
    resultLine: "Sayfalar görsel olarak hazır",
  }),

  "image-to-pdf": simpleTool({
    id: "image-to-pdf",
    toolPath: "/tools/image-to-pdf",
    intro: { title: "Görsel → PDF", sub: "Fotoğrafları tek PDF'te topla" },
    files: ["Manzara.jpg", "Sehir.jpg", "Soyut.jpg"],
    pick: { l1: "Birden çok fotoğraf seçebilirsin", l2: "" },
    button: btn(/PDF AL/),
    press: { title: "PDF'e çevir", l1: "3 fotoğraf tek dosya olur" },
    resultLine: "3 fotoğraf tek PDF oldu",
  }),

  "alternate-mix-pdf": simpleTool({
    id: "alternate-mix-pdf",
    toolPath: "/tools/alternate-mix-pdf",
    intro: { title: "Dönüşümlü Birleştirme", sub: "İki PDF'in sayfalarını sırayla serpiştir" },
    files: ["Tarama-On-Yuzler.pdf", "Tarama-Arka-Yuzler.pdf"],
    pick: { l1: "Ön yüz ve arka yüz PDF'lerini seç", l2: "çift taraflı taramalar için" },
    loaded: (pg) => pg.getByText("Tarama-Arka-Yuzler.pdf").first(),
    button: btn(/SERPİŞTİR/),
    press: { title: "Serpiştir'e bas", l1: "Sayfalar sırayla dizilir" },
    resultLine: "İki PDF sırayla birleşti",
  }),
};
