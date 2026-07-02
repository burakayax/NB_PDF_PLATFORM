import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** Tüm koordinatlar 0..1 normalize (sayfa genişlik/yüksekliğine göre). */
export type EditAnno =
  | { id: string; page: number; type: "text"; x: number; y: number; text: string; size: number; color: string }
  | { id: string; page: number; type: "highlight"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; page: number; type: "pen"; points: { x: number; y: number }[]; color: string; width: number }
  | { id: string; page: number; type: "image"; x: number; y: number; w: number; h: number; dataUrl: string };

let robotoBuf: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer> {
  if (robotoBuf) return robotoBuf;
  const buf = await fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer());
  robotoBuf = buf;
  return buf;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

/**
 * Orijinal PDF'e düzenleme katmanını (metin/kapatma/vurgu/kalem) düzleştirerek
 * yeni PDF üretir. Metin gömülü Roboto ile (Türkçe tam). Koordinatlar 0..1 →
 * PDF nokta uzayına çevrilir (Y ters çevrilir; ekran üst-sol, PDF alt-sol).
 */
export async function exportEditedPdf(
  original: ArrayBuffer | Uint8Array,
  annos: EditAnno[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFont(), { subset: true });
  const pages = pdf.getPages();

  for (const a of annos) {
    const page = pages[a.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();

    if (a.type === "image") {
      try {
        const isPng = a.dataUrl.startsWith("data:image/png");
        const bytes = Uint8Array.from(atob(a.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
        const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        page.drawImage(img, {
          x: a.x * W,
          y: H - (a.y + a.h) * H,
          width: a.w * W,
          height: a.h * H,
        });
      } catch {
        /* gömülemeyen görseli atla */
      }
    } else if (a.type === "highlight") {
      const [r, g, b] = hexToRgb(a.color);
      page.drawRectangle({
        x: a.x * W,
        y: H - (a.y + a.h) * H,
        width: a.w * W,
        height: a.h * H,
        color: rgb(r, g, b),
        opacity: 0.35,
      });
    } else if (a.type === "text") {
      const [r, g, b] = hexToRgb(a.color);
      const size = a.size * H; // size 0..1 (sayfa yüksekliğine göre)
      // Ekranda üst-sol köşeden yazıyoruz → PDF'te baseline'ı düşür.
      page.drawText(a.text, {
        x: a.x * W,
        y: H - a.y * H - size,
        size,
        font,
        color: rgb(r, g, b),
        lineHeight: size * 1.2,
      });
    } else if (a.type === "pen") {
      const [r, g, b] = hexToRgb(a.color);
      for (let i = 1; i < a.points.length; i++) {
        const p0 = a.points[i - 1];
        const p1 = a.points[i];
        page.drawLine({
          start: { x: p0.x * W, y: H - p0.y * H },
          end: { x: p1.x * W, y: H - p1.y * H },
          thickness: a.width * W,
          color: rgb(r, g, b),
        });
      }
    }
  }

  return pdf.save();
}
