import { getSaasApiBase } from "./saasBase";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
export type CreatedApiKey = ApiKeyRow & { key: string };

function headers(token: string | null): Record<string, string> {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function listApiKeys(token: string | null): Promise<ApiKeyRow[]> {
  const res = await fetch(`${getSaasApiBase()}/api/api-keys`, { headers: headers(token), credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as { apiKeys?: ApiKeyRow[] };
  return data.apiKeys ?? [];
}

export async function createApiKey(name: string, token: string | null): Promise<CreatedApiKey> {
  const res = await fetch(`${getSaasApiBase()}/api/api-keys`, {
    method: "POST", headers: headers(token), credentials: "include", body: JSON.stringify({ name }),
  });
  const data = (await res.json().catch(() => ({}))) as { apiKey?: CreatedApiKey; message?: string };
  if (!res.ok) throw new Error(data?.message || "Anahtar oluşturulamadı.");
  return data.apiKey as CreatedApiKey;
}

export async function revokeApiKey(id: string, token: string | null): Promise<void> {
  const res = await fetch(`${getSaasApiBase()}/api/api-keys/${id}`, { method: "DELETE", headers: headers(token), credentials: "include" });
  if (!res.ok) throw new Error("İptal edilemedi.");
}
