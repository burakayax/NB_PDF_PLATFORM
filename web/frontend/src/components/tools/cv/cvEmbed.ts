/**
 * Kendi CV PDF'imizin içine, ekranda görünmeyen bir "künye alanı" olarak CV bilgilerini gömer.
 * Kişi aynı PDF'i sonra yeniden yüklediğinde tüm alanlar birebir (tahmin yürütmeden) geri gelir.
 * Her şey cihazda olur; sunucuya hiçbir şey gönderilmez.
 *
 * Gizlilik: kullanıcının GİZLEDİĞİ bölümlerin içeriği PDF'e gömülmez (PDF'te görünmeyen bilgi
 * karşı tarafa dosyayla birlikte gitmesin). Fotoğraf yalnız CV'de gösteriliyorsa gömülür.
 */
import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } from "pdf-lib";
import { gunzipBytes, gzipBytes } from "./cvShare";
import { CV_TEMPLATES } from "./cvTemplates";
import { normalizeCv, type CvData } from "./cvModel";

const KEY = "NBCvData";
const TAG = "nbcv1:";
const MAX_PHOTO_CHARS = 700_000;
const MAX_PAYLOAD_CHARS = 3_000_000;

/** PDF'te görünmeyen (gizlenmiş) bölümlerin içeriğini boşaltır. */
function visibleOnly(d: CvData): CvData {
  const out: CvData = { ...d };
  for (const k of d.settings.hidden) {
    if (k === "summary") out.summary = "";
    else if (k === "interests") out.interests = "";
    else if (k === "experience") out.experience = [];
    else if (k === "education") out.education = [];
    else if (k === "skills") out.skills = [];
    else if (k === "languages") out.languages = [];
    else if (k === "certs") out.certs = [];
    else if (k === "projects") out.projects = [];
    else if (k === "references") out.references = [];
    else if (k.startsWith("custom:")) out.customSections = out.customSections.filter((c) => `custom:${c.id}` !== k);
  }
  if (!out.showPhoto || (out.photo && out.photo.src.length > MAX_PHOTO_CHARS)) out.photo = null;
  return out;
}

const toB64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const b = atob(s);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

/** PDF'e yazılacak metin (sıkıştırılmış + base64). Sıkıştırma yoksa gömme atlanır (null). */
export async function buildEmbedPayload(data: CvData, templateId: string): Promise<string | null> {
  if (typeof CompressionStream === "undefined") return null;
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, t: templateId, d: visibleOnly(data) }));
  const text = TAG + toB64(await gzipBytes(raw));
  return text.length > MAX_PAYLOAD_CHARS ? null : text;
}

/** Kendi PDF'imizden CV bilgilerini okur; bizim PDF'imiz değilse (ya da bozuksa) null. */
export async function readCvFromPdf(bytes: Uint8Array): Promise<{ data: CvData; templateId: string | null } | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (!(info instanceof PDFDict)) return null;
    const v = info.get(PDFName.of(KEY));
    const text = v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : "";
    if (!text.startsWith(TAG) || text.length > MAX_PAYLOAD_CHARS) return null;
    const json = new TextDecoder().decode(await gunzipBytes(fromB64(text.slice(TAG.length))));
    const obj = JSON.parse(json) as { v?: number; t?: string; d?: Partial<CvData> };
    if (obj.v !== 1 || !obj.d || typeof obj.d !== "object") return null;
    const data = normalizeCv(obj.d);
    // Güvenlik: fotoğraf yalnız gömülü görsel olabilir (dışarı bağlantı olamaz)
    if (data.photo && !/^data:image\/(png|jpe?g|webp);base64,/i.test(String(data.photo.src))) data.photo = null;
    const templateId = CV_TEMPLATES.some((t) => t.id === obj.t) ? (obj.t as string) : null;
    return { data, templateId };
  } catch {
    return null;
  }
}

export const EMBED_INFO_KEY = KEY;
