// Node tarafı PDF → metin çıkarımı (pdfjs-dist legacy; worker yok). API dosya yükleme
// uçları için. Dinamik import → pdfjs Node'da yüklenemezse tüm servis çökmez, yalnız
// bu çağrı hata verir. Taranmış/görüntü PDF'lerde metin çıkmaz → çağıran taraf uyarır.

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  try {
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
        .join(" ");
      parts.push(line);
      page.cleanup();
    }
    return parts.join("\n").replace(/[ \t]+/g, " ").trim();
  } finally {
    await doc.destroy();
  }
}
