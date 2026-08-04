import { getSaasApiBase } from "./saasBase";

/** Belge Tarayıcı "Hesabıma kaydet" — kullanıcının son taramaları (bulut). */
export type ScanRecord = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Taramayı hesaba yükle (FIFO: FREE düşük, Pro yüksek limit). */
export async function uploadScanToLibrary(
  accessToken: string,
  blob: Blob,
  filename: string,
): Promise<{ scan: ScanRecord; limit: number }> {
  const fd = new FormData();
  fd.append("file", new File([blob], filename, { type: blob.type || "application/octet-stream" }));
  fd.append("filename", filename);
  const r = await fetch(`${getSaasApiBase()}/api/user/scans`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: fd,
  });
  if (!r.ok) {
    let msg = "Kaydedilemedi.";
    try { const j = await r.json(); if (j?.message) msg = String(j.message); } catch { /* */ }
    throw new Error(msg);
  }
  return r.json();
}

/** Kullanıcının son taramalarını listele. */
export async function listScans(
  accessToken: string,
): Promise<{ scans: ScanRecord[]; limit: number }> {
  const r = await fetch(`${getSaasApiBase()}/api/user/scans`, { headers: authHeaders(accessToken) });
  if (!r.ok) throw new Error("Taramalar alınamadı.");
  return r.json();
}

/** Bir taramayı blob olarak indir. */
export async function downloadScan(accessToken: string, id: string): Promise<Blob> {
  const r = await fetch(`${getSaasApiBase()}/api/user/scans/${encodeURIComponent(id)}/download`, {
    headers: authHeaders(accessToken),
  });
  if (!r.ok) throw new Error("İndirilemedi.");
  return r.blob();
}

/** Bir taramayı sil. */
export async function deleteScan(accessToken: string, id: string): Promise<void> {
  const r = await fetch(`${getSaasApiBase()}/api/user/scans/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  if (!r.ok) throw new Error("Silinemedi.");
}
