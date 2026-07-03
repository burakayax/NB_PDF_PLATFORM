import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";

const MAX_KEYS_PER_USER = 10;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Yeni anahtar üret: nb_live_<yüksek entropili>. Ham anahtar yalnız bir kez döner. */
function generateRawKey(): { raw: string; hash: string; prefix: string; last4: string } {
  const secret = randomBytes(24).toString("base64url");
  const raw = `nb_live_${secret}`;
  return { raw, hash: sha256(raw), prefix: raw.slice(0, 12), last4: raw.slice(-4) };
}

export type ApiKeyPublic = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export async function createApiKey(userId: string, name: string): Promise<ApiKeyPublic & { key: string }> {
  const active = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_KEYS_PER_USER) {
    throw new Error("API_KEY_LIMIT");
  }
  const { raw, hash, prefix, last4 } = generateRawKey();
  const row = await prisma.apiKey.create({
    data: { userId, name: name.slice(0, 60) || "API Key", keyHash: hash, prefix, last4 },
  });
  return {
    id: row.id, name: row.name, prefix, last4,
    createdAt: row.createdAt, lastUsedAt: null, revokedAt: null,
    key: raw, // yalnız bu yanıtta — bir daha gösterilmez
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeyPublic[]> {
  const rows = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, last4: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return rows;
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const res = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** Ham anahtardan kullanıcıyı çöz (v1 kimlik doğrulama). İptal edilmişse null. */
export async function resolveApiKeyUser(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith("nb_live_")) return null;
  const hash = sha256(rawKey);
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hash }, select: { id: true, userId: true, revokedAt: true } });
  if (!row || row.revokedAt) return null;
  // Son kullanım zamanı (fire-and-forget).
  void prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: row.userId, keyId: row.id };
}
