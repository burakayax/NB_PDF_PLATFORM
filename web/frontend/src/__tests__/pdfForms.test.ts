import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { formAlanlariniOku, formuDoldur } from "../lib/pdfForms";

/**
 * PDF FORM DOLDURMA.
 *
 * Testler gerçek bir doldurulabilir PDF üretip onun üzerinde çalışır — sahte
 * nesnelerle değil. Korunan davranışlar: alanların doğru tiplerle okunması,
 * değerlerin gerçekten yazılması, Türkçe harflerin kaybolmaması ve düzleştirme
 * sonrası alanların kalıcı içeriğe dönüşmesi.
 */

// Node'un Buffer'ı pdf-lib'in tip denetiminden geçmiyor; düz Uint8Array'e çevir.
const roboto = new Uint8Array(
  readFileSync(join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf")),
);

/** Test için doldurulabilir bir form üretir (metin, onay, liste, seçim). */
async function ornekForm(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sayfa = pdf.addPage([400, 400]);
  const form = pdf.getForm();

  const ad = form.createTextField("ad_soyad");
  ad.setText("");
  ad.addToPage(sayfa, { x: 20, y: 340, width: 300, height: 24 });

  const aciklama = form.createTextField("aciklama");
  aciklama.enableMultiline();
  aciklama.addToPage(sayfa, { x: 20, y: 250, width: 300, height: 70 });

  const onay = form.createCheckBox("kvkk_onay");
  onay.addToPage(sayfa, { x: 20, y: 210, width: 16, height: 16 });

  const liste = form.createDropdown("sehir");
  liste.setOptions(["İstanbul", "Ankara", "İzmir"]);
  liste.addToPage(sayfa, { x: 20, y: 160, width: 200, height: 24 });

  const secim = form.createRadioGroup("tur");
  secim.addOptionToPage("bireysel", sayfa, { x: 20, y: 120, width: 16, height: 16 });
  secim.addOptionToPage("kurumsal", sayfa, { x: 120, y: 120, width: 16, height: 16 });

  const salt = form.createTextField("belge_no");
  salt.setText("SBT-2026");
  salt.enableReadOnly();
  salt.addToPage(sayfa, { x: 20, y: 70, width: 200, height: 24 });

  return pdf.save();
}

describe("form alanlarını okuma", () => {
  it("alanları tipleriyle birlikte listeler", async () => {
    const alanlar = await formAlanlariniOku(await ornekForm());
    const harita = Object.fromEntries(alanlar.map((a) => [a.ad, a]));
    expect(harita["ad_soyad"]!.tip).toBe("metin");
    expect(harita["kvkk_onay"]!.tip).toBe("onay");
    expect(harita["sehir"]!.tip).toBe("liste");
    expect(harita["tur"]!.tip).toBe("secim");
  });

  it("seçeneklerini ve çok satırlı olup olmadığını bildirir", async () => {
    const alanlar = await formAlanlariniOku(await ornekForm());
    const sehir = alanlar.find((a) => a.ad === "sehir")!;
    expect(sehir.secenekler).toEqual(["İstanbul", "Ankara", "İzmir"]);
    expect(alanlar.find((a) => a.ad === "aciklama")!.cokSatirli).toBe(true);
  });

  it("salt okunur alanı işaretler (kullanıcı boşuna uğraşmasın)", async () => {
    const alanlar = await formAlanlariniOku(await ornekForm());
    expect(alanlar.find((a) => a.ad === "belge_no")!.saltOkunur).toBe(true);
  });

  it("formu olmayan PDF'te boş liste döner", async () => {
    const bos = await PDFDocument.create();
    bos.addPage();
    expect(await formAlanlariniOku(await bos.save())).toEqual([]);
  });
});

describe("formu doldurma", () => {
  it("değerleri gerçekten yazar", async () => {
    const cikti = await formuDoldur(
      await ornekForm(),
      { ad_soyad: "Ayşe Yılmaz", kvkk_onay: true, sehir: "İzmir", tur: "kurumsal" },
      { fontBytes: roboto },
    );
    const alanlar = await formAlanlariniOku(cikti);
    const harita = Object.fromEntries(alanlar.map((a) => [a.ad, a.deger]));
    expect(harita["ad_soyad"]).toBe("Ayşe Yılmaz");
    expect(harita["kvkk_onay"]).toBe(true);
    expect(harita["sehir"]).toBe("İzmir");
    expect(harita["tur"]).toBe("kurumsal");
  });

  it("Türkçe harfler kaybolmadan yazılır (WinAnsi tuzağı)", async () => {
    // Font verilmezse pdf-lib varsayılan kodlamayı kullanır ve "ğşçİı" harfleri
    // görünüm üretiminde hata verir. Font verildiğinde hata olmamalı.
    await expect(
      formuDoldur(await ornekForm(), { ad_soyad: "Çağrı Şişman İğne" }, { fontBytes: roboto }),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("salt okunur alanı değiştirmez", async () => {
    const cikti = await formuDoldur(
      await ornekForm(),
      { belge_no: "DEGISTIRILDI" },
      { fontBytes: roboto },
    );
    const alanlar = await formAlanlariniOku(cikti);
    expect(alanlar.find((a) => a.ad === "belge_no")!.deger).toBe("SBT-2026");
  });

  it("listede olmayan seçeneği yazmaz (dosyayı bozmaz)", async () => {
    const cikti = await formuDoldur(
      await ornekForm(),
      { sehir: "Paris" },
      { fontBytes: roboto },
    );
    const alanlar = await formAlanlariniOku(cikti);
    expect(alanlar.find((a) => a.ad === "sehir")!.deger).toBe("");
  });

  it("bilinmeyen alan adı hata vermez", async () => {
    await expect(
      formuDoldur(await ornekForm(), { olmayan_alan: "x" }, { fontBytes: roboto }),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("düzleştirince alanlar kalıcı içeriğe dönüşür", async () => {
    const cikti = await formuDoldur(
      await ornekForm(),
      { ad_soyad: "Ayşe Yılmaz" },
      { duzlestir: true, fontBytes: roboto },
    );
    expect(await formAlanlariniOku(cikti)).toEqual([]);
  });

  it("düzleştirmeden kaydedince alanlar düzenlenebilir kalır", async () => {
    const cikti = await formuDoldur(
      await ornekForm(),
      { ad_soyad: "Ayşe Yılmaz" },
      { fontBytes: roboto },
    );
    expect((await formAlanlariniOku(cikti)).length).toBeGreaterThan(0);
  });
});
