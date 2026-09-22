/**
 * CİHAZ İÇİ ARAÇ ÇALIŞTIRMA — yapısal PDF işlerini sunucuya hiç göndermeden
 * tarayıcıda yapar.
 *
 * Ana uygulama dosyasındaki işlem başlatma akışının içinde duruyordu. Ekran
 * durumuna dokunmaz: dosyaları ve form değerlerini alır, üretilen dosyayı
 * döndürür. Üretemezse `null` döner ve çağıran sunucu akışına düşer — bu,
 * şifreli veya beklenmedik dosyalarda sessiz ve güvenli bir geri çekilmedir.
 *
 * "Nereye kaydedilsin?" sorusu BURADA SORULMAZ: o soru kullanıcı tıklamasının
 * hemen ardından, herhangi bir bekleme başlamadan sorulmak zorunda (tarayıcı
 * kuralı), bu yüzden çağıranda kalır.
 */
import type { FeatureKey } from "../api/subscription";
import type { Language } from "../i18n/landing";
import {
  mergePdfs,
  imagesToPdf,
  rotatePdf,
  deletePages,
  reorderPages,
  splitPagesToZip,
  getPdfPageCount,
  pdfBytesToBlob,
  zipBytesToBlob,
} from "./clientPdfWorker";

export type ClientToolInput = {
  toolId: FeatureKey;
  files: File[];
  /**
   * Yükleme sırasındaki ön kontrolden gelen sayfa sayısı. Yoksa dosya elimizde
   * olduğu için burada sayılır — ön kontrol başarısız olduğunda da araç çalışsın.
   */
  pageCountHint: number | null;
  /** Sayfa numarası (1'den başlar) → derece. */
  rotatePageRotations: Record<string, number>;
  deletePagesText: string;
  /** Yeni sıralama, 1'den başlayan sayfa numaraları. */
  organizePageOrder: number[];
  pagesText: string;
  splitMode: string;
  language: Language;
  fallbackFilename: string;
  /** "1-3,5" gibi bir metni sayfa numaralarına çevirir. */
  expandPages: (
    text: string,
    pageCount: number,
    language: Language,
  ) => number[] | null;
};

export type ClientToolOutput = { blob: Blob; filename: string };

export async function runClientPdfTool(
  input: ClientToolInput,
): Promise<ClientToolOutput | null> {
  const {
    toolId,
    files,
    pageCountHint,
    rotatePageRotations,
    deletePagesText,
    organizePageOrder,
    pagesText,
    splitMode,
    language,
    fallbackFilename,
    expandPages,
  } = input;

  if (toolId === "merge") {
    const buffers = await Promise.all(files.map((f) => f.arrayBuffer()));
    return {
      blob: pdfBytesToBlob(await mergePdfs(buffers)),
      filename: fallbackFilename,
    };
  }

  if (toolId === "image-to-pdf") {
    const images = await Promise.all(
      files.map(async (f) => ({ bytes: await f.arrayBuffer(), mime: f.type })),
    );
    return {
      blob: pdfBytesToBlob(await imagesToPdf(images)),
      filename: fallbackFilename,
    };
  }

  const first = files[0];
  if (!first) {
    return null;
  }

  const src = new Uint8Array(await first.arrayBuffer());
  const pageCount =
    pageCountHint ?? (await getPdfPageCount(src).catch(() => 0));

  if (toolId === "rotate-pdf") {
    // Ekranda 1'den sayılır, kitaplık 0'dan; tam tur dönüşler işe yaramaz.
    const rotations: Record<number, number> = {};
    for (const [page, degrees] of Object.entries(rotatePageRotations)) {
      const d = Number(degrees);
      if (d % 360 !== 0) {
        rotations[Number(page) - 1] = d;
      }
    }
    if (Object.keys(rotations).length === 0) {
      return null;
    }
    return {
      blob: pdfBytesToBlob(await rotatePdf(src, rotations)),
      filename: fallbackFilename,
    };
  }

  if (toolId === "delete-pages" && pageCount > 0) {
    const pages = expandPages(deletePagesText, pageCount, language) ?? [];
    // Tüm sayfaları silmek boş belge demek — o isteği cihazda karşılamayız.
    if (pages.length === 0 || pages.length >= pageCount) {
      return null;
    }
    return {
      blob: pdfBytesToBlob(await deletePages(src, pages.map((p) => p - 1))),
      filename: fallbackFilename,
    };
  }

  if (toolId === "organize-pdf" && organizePageOrder.length > 0) {
    return {
      blob: pdfBytesToBlob(
        await reorderPages(src, organizePageOrder.map((p) => p - 1)),
      ),
      filename: fallbackFilename,
    };
  }

  if (toolId === "split" && pageCount > 0) {
    const pages = expandPages(pagesText, pageCount, language) ?? [];
    if (pages.length === 0) {
      return null;
    }
    const zeroBased = pages.map((p) => p - 1);
    if (splitMode === "separate") {
      return {
        blob: zipBytesToBlob(await splitPagesToZip(src, zeroBased, "sayfa")),
        filename: "sayfalar.zip",
      };
    }
    return {
      blob: pdfBytesToBlob(await reorderPages(src, zeroBased)),
      filename: fallbackFilename,
    };
  }

  return null;
}
