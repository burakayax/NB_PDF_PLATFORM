import { getSaasApiBase } from "./saasBase";
import { saasAuthorizedFetch } from "./subscription";
import { readAccessToken } from "../lib/accessTokenStore";

/** Yönetim: kendi hizmet sağlık kaydımız (kesinti, sinyal yok, 5xx) ve pencere seçmeli itiraz dosyası. */

export type ComponentStatus = {
  uptimePct: number | null;
  okMinutes: number;
  downMinutes: number;
  noSignalMinutes: number;
  incidents: Array<{ start: string; end: string; minutes: number; type: "down" | "no-signal" }>;
};

export type ServiceStatus = {
  from: string;
  to: string;
  components: { api: ComponentStatus; db: ComponentStatus; pdf: ComponentStatus };
  failures: Array<{ path: string; status: number; count: number; first: string; last: string }>;
};

async function adminGet(accessToken: string, path: string): Promise<Response> {
  const token = readAccessToken() ?? accessToken;
  return saasAuthorizedFetch(token, (t) =>
    fetch(`${getSaasApiBase()}/api/admin${path}`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    }),
  );
}

export async function fetchServiceStatus(accessToken: string, days: number): Promise<ServiceStatus> {
  const r = await adminGet(accessToken, `/service-status?days=${encodeURIComponent(String(days))}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<ServiceStatus>;
}

/** İtiraz dosyasını (düz metin) indirir; from/to (YYYY-MM-DD) verilirse hizmet durumu o pencere için hesaplanır. */
export async function downloadDisputeFileForWindow(accessToken: string, userIdOrEmail: string, from?: string, to?: string): Promise<void> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const qs = q.toString();
  const r = await adminGet(accessToken, `/users/${encodeURIComponent(userIdOrEmail.trim())}/dispute-file${qs ? `?${qs}` : ""}`);
  if (!r.ok) throw new Error(r.status === 404 ? "Kullanıcı bulunamadı." : await r.text());
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "itiraz-dosyasi.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
