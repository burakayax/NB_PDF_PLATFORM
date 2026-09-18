/**
 * İMZA İSTEKLERİ — istemci.
 *
 * İki taraf vardır: isteği GÖNDEREN (oturum açmış kullanıcı) ve İMZALAYAN
 * (hesabı yoktur; kimliği e-postasına giden tek kullanımlık bağlantıyla kurulur).
 */
import { saasFetch } from "./saasHttp";

/** Sunucunun döndürdüğü hata metnini kullanıcıya olduğu gibi taşır. */
async function ensureOk(response: Response, varsayilan: string): Promise<void> {
  if (response.ok) return;
  try {
    const tip = response.headers.get("content-type") ?? "";
    if (tip.includes("application/json")) {
      const govde = (await response.json()) as { message?: string; error?: string };
      throw new Error(govde.message || govde.error || varsayilan);
    }
    const metin = (await response.text()).trim();
    throw new Error(metin || varsayilan);
  } catch (e) {
    throw e instanceof Error ? e : new Error(varsayilan);
  }
}

export type ImzaDurumu = "PENDING" | "VIEWED" | "SIGNED" | "DECLINED" | "CANCELLED" | "EXPIRED";

export type ImzaIstegi = {
  id: string;
  title: string;
  filename: string;
  status: ImzaDurumu;
  signerEmail: string;
  signerName: string | null;
  createdAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  expiresAt: string;
};

export type ImzaOlayi = { type: string; at: string; detail: string | null; actor: string | null };

export type ImzaIstegiDetay = ImzaIstegi & {
  message: string | null;
  originalHash: string;
  signedHash: string | null;
  events: ImzaOlayi[];
};

export async function imzaIstegiGonder(
  accessToken: string,
  girdi: { file: File; title: string; signerEmail: string; signerName?: string; message?: string },
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", girdi.file);
  form.append("title", girdi.title);
  form.append("signerEmail", girdi.signerEmail);
  if (girdi.signerName) form.append("signerName", girdi.signerName);
  if (girdi.message) form.append("message", girdi.message);
  const r = await saasFetch(`/api/signatures`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  await ensureOk(r, "İmza isteği gönderilemedi.");
  return (await r.json()) as { id: string };
}

export async function imzaIstekleriniGetir(accessToken: string): Promise<ImzaIstegi[]> {
  const r = await saasFetch(`/api/signatures`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(r, "İmza istekleri getirilemedi.");
  return ((await r.json()) as { requests: ImzaIstegi[] }).requests ?? [];
}

export async function imzaIstegiDetayiGetir(
  accessToken: string,
  id: string,
): Promise<ImzaIstegiDetay> {
  const r = await saasFetch(`/api/signatures/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(r, "İmza isteği getirilemedi.");
  return (await r.json()) as ImzaIstegiDetay;
}

export async function imzaIstegiIptalEt(accessToken: string, id: string): Promise<void> {
  const r = await saasFetch(`/api/signatures/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(r, "İmza isteği iptal edilemedi.");
}

export async function imzaBelgesiniIndir(accessToken: string, id: string): Promise<Blob> {
  const r = await saasFetch(`/api/signatures/${encodeURIComponent(id)}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(r, "Belge indirilemedi.");
  return r.blob();
}

/* ── İmzalayan tarafı (oturum yok) ── */

export type ImzaSayfasi = {
  id: string;
  title: string;
  filename: string;
  message: string | null;
  status: ImzaDurumu;
  signerEmail: string;
  signerName: string | null;
  isteyen: string;
  isteyenEposta: string;
  belgeBase64: string;
  imzalandiMi: boolean;
};

export async function imzaSayfasiniGetir(token: string): Promise<ImzaSayfasi> {
  const r = await saasFetch(`/api/sign/${encodeURIComponent(token)}`);
  await ensureOk(r, "İmza bağlantısı açılamadı.");
  return (await r.json()) as ImzaSayfasi;
}

export async function imzayiGonder(
  token: string,
  govde: {
    signaturePng: string;
    signerName: string;
    consent: boolean;
    placement: { sayfa: number; xOran: number; yOran: number; genislikOran: number };
  },
): Promise<void> {
  const r = await saasFetch(`/api/sign/${encodeURIComponent(token)}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  await ensureOk(r, "İmza gönderilemedi.");
}

export async function imzayiReddetGonder(token: string, reason: string): Promise<void> {
  const r = await saasFetch(`/api/sign/${encodeURIComponent(token)}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  await ensureOk(r, "İşlem tamamlanamadı.");
}

export async function imzalayanKopyasiniIndir(token: string): Promise<Blob> {
  const r = await saasFetch(`/api/sign/${encodeURIComponent(token)}/download`);
  await ensureOk(r, "İmzalı belge indirilemedi.");
  return r.blob();
}
