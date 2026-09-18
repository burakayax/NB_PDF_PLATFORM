/**
 * PDF FORM DOLDURMA — cihazda, dosya sunucuya gitmeden.
 *
 * Doldurulabilir PDF formları (AcroForm) tarayıcıda okunur, alanları listelenir,
 * kullanıcının girdiği değerlerle doldurulur ve istenirse "düzleştirilir"
 * (alanlar sabit içeriğe dönüşür, artık değiştirilemez).
 *
 * TÜRKÇE KARAKTER TUZAĞI: pdf-lib alan görünümlerini varsayılan olarak
 * Helvetica/WinAnsi ile üretir; bu kodlama "ğ, ş, İ, ı" gibi harfleri
 * TANIMADIĞINDAN görünüm üretimi hata verir ya da harfler kaybolur. Çözüm,
 * kütüphanenin belgelerinde yazdığı gibi Unicode bir fontu gömüp görünüm
 * üretimine ONU vermektir: `form.updateFieldAppearances(font)`.
 *
 * ALT KÜME (subset) GÜVENLİ Mİ: Evet. Görünüm üretimi metni fontun
 * `encodeText` yoluyla işler; kullanılan harfler böylece kaydedilmeden ÖNCE alt
 * kümeye eklenir (kütüphane kaynağında doğrulandı). Yani `subset: true` ile
 * dosya küçük kalır, harfler kaybolmaz.
 *
 * XFA FORMLARI: Adobe LiveCycle'ın XFA formları AcroForm değildir; alanları bu
 * yolla doldurulamaz. Böyle bir dosya geldiğinde kullanıcıya açıkça söylenir —
 * sessizce boş çıktı vermek en kötüsü olurdu.
 */
import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type FormAlanTipi = "metin" | "onay" | "liste" | "secim" | "coklu-liste" | "buton";

export type FormAlani = {
  ad: string;
  tip: FormAlanTipi;
  deger: string | boolean | string[] | null;
  secenekler?: string[];
  saltOkunur: boolean;
  cokSatirli?: boolean;
  enFazlaKarakter?: number;
};

export type FormDegerleri = Record<string, string | boolean | string[]>;

/** XFA formu tespit edildiğinde fırlatılır; çağıran taraf kullanıcıya açıklar. */
export class XfaFormuHatasi extends Error {
  constructor() {
    super("XFA");
    this.name = "XfaFormuHatasi";
  }
}

function alanTipi(alan: unknown): FormAlanTipi {
  if (alan instanceof PDFTextField) return "metin";
  if (alan instanceof PDFCheckBox) return "onay";
  if (alan instanceof PDFDropdown) return "liste";
  if (alan instanceof PDFRadioGroup) return "secim";
  if (alan instanceof PDFOptionList) return "coklu-liste";
  return "buton";
}

/**
 * Formdaki alanları okur. Doldurulabilir alan yoksa boş dizi döner —
 * "bu PDF'te form yok" mesajını çağıran taraf verir.
 */
export async function formAlanlariniOku(bytes: ArrayBuffer | Uint8Array): Promise<FormAlani[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  if (form.hasXFA()) throw new XfaFormuHatasi();

  return form.getFields().map((alan) => {
    const tip = alanTipi(alan);
    const ortak = {
      ad: alan.getName(),
      tip,
      saltOkunur: alan.isReadOnly(),
    };
    if (alan instanceof PDFTextField) {
      return {
        ...ortak,
        deger: alan.getText() ?? "",
        cokSatirli: alan.isMultiline(),
        enFazlaKarakter: alan.getMaxLength(),
      };
    }
    if (alan instanceof PDFCheckBox) {
      return { ...ortak, deger: alan.isChecked() };
    }
    if (alan instanceof PDFDropdown) {
      return { ...ortak, deger: alan.getSelected()[0] ?? "", secenekler: alan.getOptions() };
    }
    if (alan instanceof PDFRadioGroup) {
      return { ...ortak, deger: alan.getSelected() ?? "", secenekler: alan.getOptions() };
    }
    if (alan instanceof PDFOptionList) {
      return { ...ortak, deger: alan.getSelected(), secenekler: alan.getOptions() };
    }
    return { ...ortak, deger: null };
  });
}

export type DoldurSecenekleri = {
  /** true ise alanlar sabit içeriğe dönüşür (bir daha değiştirilemez). */
  duzlestir?: boolean;
  /** Türkçe karakterler için Unicode font (ör. Roboto). Verilmezse harf kaybolabilir. */
  fontBytes?: ArrayBuffer | Uint8Array;
};

/**
 * Alanları doldurur. Bilinmeyen alan adları ve salt-okunur alanlar atlanır;
 * listelerde olmayan bir seçenek gönderilirse o alan sessizce atlanır (dosyayı
 * bozmaktansa o alanı boş bırakmak daha az zarar verir).
 *
 * @returns doldurulmuş PDF baytları
 */
export async function formuDoldur(
  bytes: ArrayBuffer | Uint8Array,
  degerler: FormDegerleri,
  secenekler: DoldurSecenekleri = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  if (form.hasXFA()) throw new XfaFormuHatasi();

  let font: PDFFont | undefined;
  if (secenekler.fontBytes) {
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(secenekler.fontBytes, { subset: true });
  }

  for (const [ad, deger] of Object.entries(degerler)) {
    const alan = form.getFieldMaybe(ad);
    if (!alan || alan.isReadOnly()) continue;
    try {
      if (alan instanceof PDFTextField) {
        alan.setText(typeof deger === "string" ? deger : String(deger ?? ""));
      } else if (alan instanceof PDFCheckBox) {
        if (deger) alan.check();
        else alan.uncheck();
      } else if (alan instanceof PDFDropdown || alan instanceof PDFRadioGroup) {
        const secim = typeof deger === "string" ? deger : Array.isArray(deger) ? deger[0] : "";
        if (secim && alan.getOptions().includes(secim)) alan.select(secim);
      } else if (alan instanceof PDFOptionList) {
        const secimler = (Array.isArray(deger) ? deger : [String(deger)]).filter((s) =>
          alan.getOptions().includes(s),
        );
        if (secimler.length) alan.select(secimler[0]!);
      }
    } catch {
      // Tek bir alan kabul etmezse (bozuk alan tanımı) diğerleri yazılmaya devam etsin.
    }
  }

  // Görünüm akışları değerlerden SONRA üretilmeli; düzleştirme de bundan sonra.
  form.updateFieldAppearances(font);
  if (secenekler.duzlestir) form.flatten();

  return pdf.save({ useObjectStreams: false });
}
