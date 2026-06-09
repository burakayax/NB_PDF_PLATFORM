// Dosya türü doğrulaması: bir aracın `accept` tanımına göre izinli uzantıları çıkarır
// ve seçilen dosyaları uzantıya göre ayırır. `accept` HTML attribute'u yalnızca dosya
// seçicide ipucu verir (kullanıcı "tüm dosyalar"ı seçip ya da sürükle-bırakla yanlış tür
// ekleyebilir); bu yüzden istemci tarafında ayrıca doğrulama gerekir.

const MIME_TO_EXTS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/jpg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/bmp": ["bmp"],
  "image/tiff": ["tif", "tiff"],
};

/**
 * `accept` string'inden (örn. ".ppt,.pptx,application/vnd...") izinli uzantı kümesi.
 * `.ext` token'ları doğrudan; bilinen görsel/pdf MIME'ları uzantıya eşlenir.
 * `application/octet-stream` gibi genel MIME'lar yok sayılır → uzantıya güvenilir.
 * Sonuç boşsa doğrulama uygulanmamalıdır (ör. accept="" olan html-to-pdf).
 */
export function allowedExtensionsFromAccept(
  accept: string | undefined | null,
): Set<string> {
  const exts = new Set<string>();
  if (!accept) return exts;
  for (const raw of accept.split(",")) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (t.startsWith(".")) {
      exts.add(t.slice(1));
    } else {
      const mapped = MIME_TO_EXTS[t];
      if (mapped) {
        for (const e of mapped) exts.add(e);
      }
    }
  }
  return exts;
}

/** Dosya adından küçük harfli uzantı (noktasız). Uzantı yoksa boş string. */
export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Dosyaları izinli uzantıya göre ayırır. `allowed` boşsa doğrulama yapılmaz
 * (hepsi kabul edilir) — accept tanımsız araçlar için güvenli varsayılan.
 */
export function partitionByAllowedExtensions(
  files: File[],
  allowed: Set<string>,
): { accepted: File[]; rejected: File[] } {
  if (allowed.size === 0) {
    return { accepted: files, rejected: [] };
  }
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const f of files) {
    if (allowed.has(fileExtension(f.name))) {
      accepted.push(f);
    } else {
      rejected.push(f);
    }
  }
  return { accepted, rejected };
}

/** İzinli uzantıları kullanıcıya gösterilecek etikete çevirir (".pdf, .docx"). */
export function allowedExtensionsLabel(allowed: Set<string>): string {
  return [...allowed].map((e) => `.${e}`).join(", ");
}
