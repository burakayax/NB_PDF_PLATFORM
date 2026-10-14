/**
 * Bağlantıyla paylaşım — sunucusuz.
 * CV, adresin "#" kısmına (fragment) sıkıştırılıp yazılır. Tarayıcılar "#" sonrasını sunucuya GÖNDERMEZ;
 * yani gizlilik sözü bozulmaz. Fotoğraf çok büyük olduğu için bağlantıya konmaz.
 */
import { normalizeCv, type CvData } from "./cvModel";

const PREFIX = "#cv=";

const b64u = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const buf = await new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } }).pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer();
  return new Uint8Array(buf);
}

/** Paylaşılacak sade veri: fotoğraf yok, boş alanlar atılır. */
export function shareablePayload(d: CvData): string {
  const { photo: _photo, ...rest } = d;
  void _photo;
  return JSON.stringify({ v: 1, d: { ...rest, photo: null } });
}

export async function encodeCvLink(d: CvData, origin: string, path: string): Promise<{ url: string; length: number }> {
  const raw = new TextEncoder().encode(shareablePayload(d));
  let tag = "z";
  let body: Uint8Array = raw;
  if (typeof CompressionStream !== "undefined") body = await pipe(raw, new CompressionStream("gzip"));
  else tag = "r";
  const url = `${origin}${path}${PREFIX}${tag}.${b64u(body)}`;
  return { url, length: url.length };
}

export function hasCvLink(hash: string): boolean {
  return hash.startsWith(PREFIX);
}

export async function decodeCvLink(hash: string): Promise<CvData | null> {
  try {
    if (!hasCvLink(hash)) return null;
    const rest = hash.slice(PREFIX.length);
    const dot = rest.indexOf(".");
    const tag = rest.slice(0, dot);
    let bytes = unb64u(rest.slice(dot + 1));
    if (tag === "z") {
      if (typeof DecompressionStream === "undefined") return null;
      bytes = await pipe(bytes, new DecompressionStream("gzip"));
    }
    const obj = JSON.parse(new TextDecoder().decode(bytes)) as { v?: number; d?: Partial<CvData> };
    if (obj.v !== 1 || !obj.d || typeof obj.d !== "object") return null;
    return normalizeCv({ ...obj.d, photo: null });
  } catch {
    return null;
  }
}
