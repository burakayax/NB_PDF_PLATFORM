/**
 * PDF ÜSTVERİ (METADATA) OKUMA VE TEMİZLEME — cihazda.
 *
 * Bir PDF, sayfada görünenin dışında üç katman bilgi taşır ve paylaşan kişi
 * bunların çoğunun farkında değildir:
 *
 *  1) BELGE ÖZELLİKLERİ (/Info): başlık, YAZAR, konu, anahtar kelimeler,
 *     belgeyi üreten program ve oluşturma/değiştirme tarihleri.
 *  2) XMP AKIŞI: XML biçiminde ayrı bir üstveri bloğu. Belge kimlikleri, sürüm
 *     geçmişi ve programa özel alanlar burada durur. ÇOĞU ARAÇ YALNIZCA (1)'i
 *     temizler, bu blok dosyada kalır.
 *  3) GÖMÜLÜ GÖRSELLERİN EXIF'İ: PDF'e JPEG olarak gömülen fotoğraflar kendi
 *     EXIF bloklarını (makine modeli, çekim tarihi, GPS KONUMU) koruyabilir.
 *
 * Ayrıca dosyanın "belge kimliği" (/ID) benzersiz bir parmak izidir; aynı
 * belgenin farklı kopyalarını birbirine bağlamaya yarar.
 *
 * Bu modül dördünü de ele alır ve her şeyi TARAYICIDA yapar; belge sunucuya
 * gitmez — zaten amacı gizlilik olan bir araçta dosyayı yüklemek çelişki olurdu.
 *
 * KÜTÜPHANE TUZAĞI: pdf-lib bir PDF'i açarken varsayılan olarak üstveriyi
 * GÜNCELLER: "Producer" alanına kendi adını, "ModDate" alanına o anın tarihini
 * yazar. Temizleme aracında bu, sildiğimiz bilginin yerine yenisini koymak
 * demektir. Bu yüzden belge `updateMetadata: false` ile açılır.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray } from "pdf-lib";

export type UstveriOzeti = {
  /** Belge özelliklerinde dolu olan alanlar (ad → değer). */
  alanlar: Record<string, string>;
  /** XMP üstveri bloğu var mı. */
  xmpVar: boolean;
  /** Benzersiz belge kimliği var mı. */
  kimlikVar: boolean;
  /** İçinde EXIF taşıyan gömülü JPEG sayısı. */
  exifliGorsel: number;
};

const ALAN_ADLARI: Record<string, { tr: string; en: string }> = {
  Title: { tr: "Başlık", en: "Title" },
  Author: { tr: "Yazar", en: "Author" },
  Subject: { tr: "Konu", en: "Subject" },
  Keywords: { tr: "Anahtar kelimeler", en: "Keywords" },
  Creator: { tr: "Oluşturan program", en: "Creator" },
  Producer: { tr: "Üreten program", en: "Producer" },
  CreationDate: { tr: "Oluşturma tarihi", en: "Created" },
  ModDate: { tr: "Değiştirme tarihi", en: "Modified" },
};

export function alanAdi(anahtar: string, dil: "tr" | "en"): string {
  return ALAN_ADLARI[anahtar]?.[dil] ?? anahtar;
}

/** JPEG'te EXIF/yorum bloğu var mı (APP1..APP15 ve COM işaretleri). */
function jpegMi(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * JPEG'ten üstveri bloklarını ayıklar.
 *
 * JPEG, art arda gelen "işaret bloklarından" oluşur. Görüntünün kendisi SOS
 * (0xFFDA) işaretinden sonra başlar; ondan önceki APPn (0xFFE0–0xFFEF) ve COM
 * (0xFFFE) blokları üstveridir: EXIF, GPS konumu, küçük önizleme görseli, düzenleme
 * geçmişi. Bunları atmak görüntüyü BOZMAZ; yalnız renk profili (APP2/ICC) atılırsa
 * renkler kayabileceği için o blok KORUNUR.
 */
export function jpegUstveriSil(bytes: Uint8Array): { cikti: Uint8Array; temizlendi: boolean } {
  if (!jpegMi(bytes)) return { cikti: bytes, temizlendi: false };
  const parcalar: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let i = 2;
  let temizlendi = false;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) break; // beklenmeyen yapı → dokunma
    const isaret = bytes[i + 1]!;
    if (isaret === 0xd8 || isaret === 0x01 || (isaret >= 0xd0 && isaret <= 0xd7)) {
      parcalar.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (isaret === 0xda) {
      // Görüntü verisi başlıyor — kalan her şey olduğu gibi korunur.
      parcalar.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }
    const uzunluk = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (uzunluk < 2 || i + 2 + uzunluk > bytes.length) break; // bozuk → dokunma
    const ustveriBlogu =
      (isaret >= 0xe0 && isaret <= 0xef && isaret !== 0xe2) || isaret === 0xfe;
    if (ustveriBlogu) {
      temizlendi = true;
    } else {
      parcalar.push(bytes.subarray(i, i + 2 + uzunluk));
    }
    i += 2 + uzunluk;
  }
  if (!temizlendi) return { cikti: bytes, temizlendi: false };
  const toplam = parcalar.reduce((t, p) => t + p.length, 0);
  const cikti = new Uint8Array(toplam);
  let konum = 0;
  for (const p of parcalar) {
    cikti.set(p, konum);
    konum += p.length;
  }
  return { cikti, temizlendi: true };
}

/** Bir akışın JPEG görsel olup olmadığını süzgeçinden anlar. */
function dctFiltresiVar(dict: PDFDict): boolean {
  const filtre = dict.get(PDFName.of("Filter"));
  if (filtre instanceof PDFName) return filtre.asString() === "/DCTDecode";
  if (filtre instanceof PDFArray) {
    for (let i = 0; i < filtre.size(); i++) {
      const f = filtre.get(i);
      if (f instanceof PDFName && f.asString() === "/DCTDecode") return true;
    }
  }
  return false;
}

async function belgeAc(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  // updateMetadata: false — yoksa kütüphane kendi adını ve o anın tarihini yazar.
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
}

/** Dosyada hangi izlerin bulunduğunu çıkarır (hiçbir şey değiştirmez). */
export async function ustveriOku(bytes: ArrayBuffer | Uint8Array): Promise<UstveriOzeti> {
  const pdf = await belgeAc(bytes);
  const alanlar: Record<string, string> = {};
  const oku = (ad: string, deger: string | Date | undefined) => {
    if (deger === undefined || deger === null) return;
    const metin = deger instanceof Date ? deger.toLocaleString() : String(deger);
    if (metin.trim()) alanlar[ad] = metin;
  };
  oku("Title", pdf.getTitle());
  oku("Author", pdf.getAuthor());
  oku("Subject", pdf.getSubject());
  oku("Keywords", pdf.getKeywords());
  oku("Creator", pdf.getCreator());
  oku("Producer", pdf.getProducer());
  oku("CreationDate", pdf.getCreationDate());
  oku("ModDate", pdf.getModificationDate());

  const xmpVar = Boolean(pdf.catalog.get(PDFName.of("Metadata")));
  const kimlikVar = Boolean(pdf.context.trailerInfo.ID);

  let exifliGorsel = 0;
  for (const [, nesne] of pdf.context.enumerateIndirectObjects()) {
    if (!(nesne instanceof PDFRawStream) || !dctFiltresiVar(nesne.dict)) continue;
    if (jpegUstveriSil(nesne.contents).temizlendi) exifliGorsel += 1;
  }

  return { alanlar, xmpVar, kimlikVar, exifliGorsel };
}

export type TemizlemeSecenekleri = {
  /** Belgeye yeni bir başlık/yazar yazmak isteyen kullanıcı için (boşsa yazılmaz). */
  yeniAlanlar?: Partial<Record<"Title" | "Author" | "Subject" | "Keywords", string>>;
  /** Gömülü JPEG'lerin EXIF/GPS bloklarını da temizle. */
  gorselleriTemizle?: boolean;
};

export type TemizlemeSonucu = {
  bytes: Uint8Array;
  /** Kaç gömülü görselin üstverisi silindi. */
  temizlenenGorsel: number;
};

/**
 * Belge özelliklerini, XMP akışını ve belge kimliğini siler; istenirse gömülü
 * JPEG'lerin EXIF bloklarını da temizler.
 */
export async function ustveriTemizle(
  bytes: ArrayBuffer | Uint8Array,
  secenekler: TemizlemeSecenekleri = {},
): Promise<TemizlemeSonucu> {
  const pdf = await belgeAc(bytes);

  // 1) Belge özellikleri — alanları boşaltmak yerine sözlüğün KENDİSİ kaldırılır;
  //    boş bırakılan alanlar dosyada "Author: " olarak durmaya devam ederdi.
  pdf.context.trailerInfo.Info = undefined;

  // 2) XMP akışı — birçok araç bunu atlar, blok dosyada kalır.
  pdf.catalog.delete(PDFName.of("Metadata"));

  // 3) Belge kimliği — aynı belgenin kopyalarını birbirine bağlayan parmak izi.
  pdf.context.trailerInfo.ID = undefined;

  // 4) Gömülü JPEG'lerin EXIF/GPS blokları.
  let temizlenenGorsel = 0;
  if (secenekler.gorselleriTemizle) {
    for (const [ref, nesne] of pdf.context.enumerateIndirectObjects()) {
      if (!(nesne instanceof PDFRawStream) || !dctFiltresiVar(nesne.dict)) continue;
      const { cikti, temizlendi } = jpegUstveriSil(nesne.contents);
      if (!temizlendi) continue;
      pdf.context.assign(ref, PDFRawStream.of(nesne.dict, cikti));
      temizlenenGorsel += 1;
    }
  }

  // 5) Kullanıcı yeni değer yazmak isterse (ör. kurumsal başlık) burada yazılır.
  const yeni = secenekler.yeniAlanlar ?? {};
  if (yeni.Title?.trim()) pdf.setTitle(yeni.Title.trim());
  if (yeni.Author?.trim()) pdf.setAuthor(yeni.Author.trim());
  if (yeni.Subject?.trim()) pdf.setSubject(yeni.Subject.trim());
  if (yeni.Keywords?.trim())
    pdf.setKeywords(yeni.Keywords.split(",").map((k) => k.trim()).filter(Boolean));

  return { bytes: await pdf.save({ useObjectStreams: false }), temizlenenGorsel };
}
