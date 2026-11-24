/**
 * KONSOL GÜNLÜĞÜ (Render'da görünsün diye) — dosya günlüğünün KİŞİSEL VERİSİZ aynası.
 *
 * Dosya günlüğü e-posta, IP, tarayıcı bilgisi gibi alanlar içerir ve Render'ın ekranında görünmez. Burada aynı satır
 * konsola yazılmadan ÖNCE temizlenir: bu alanlar atılır, metin içindeki e-posta adresleri maskelenir (a***@alanadi.com).
 * Kullanıcı yalnız iç kimliğiyle (userId) kalır; bu, bir olayı panelde kişiyle eşleştirmeye yeter.
 * Yalnız üretimde açıktır (NODE_ENV=production); CONSOLE_LOG=off ile kapatılır.
 */

const DROP_KEYS = new Set([
  "ip",
  "useragent",
  "user_agent",
  "phone",
  "password",
  "passwordhash",
  "token",
  "refreshtoken",
  "accesstoken",
  "authorization",
  "cookie",
  "stack",
]);

const EMAIL_RE = /([A-Z0-9._%+-])[A-Z0-9._%+-]*@([A-Z0-9.-]+\.[A-Z]{2,})/gi;

export function maskEmails(text: string): string {
  return text.replace(EMAIL_RE, "$1***@$2");
}

function clean(value: unknown, depth: number): unknown {
  if (typeof value === "string") return maskEmails(value).slice(0, 500);
  if (depth > 3 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => clean(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.has(k.toLowerCase())) continue;
    // E-posta alanı: adresin kendisi değil maskelenmişi yazılır.
    out[k] = clean(v, depth + 1);
  }
  return out;
}

/** Bir NDJSON günlük satırını kişisel veriden arındırır; ayrıştırılamazsa yalnız e-postaları maskeler. */
export function sanitizeLogLine(line: string): string {
  try {
    const parsed = JSON.parse(line) as unknown;
    return JSON.stringify(clean(parsed, 0)).slice(0, 2000);
  } catch {
    return maskEmails(line).slice(0, 2000);
  }
}

export function consoleLogEnabled(): boolean {
  return process.env["NODE_ENV"] === "production" && (process.env["CONSOLE_LOG"] ?? "").toLowerCase() !== "off";
}

/** Temizlenmiş satırı stdout'a yazar (Render günlüğüne düşer). Hata asla uygulamayı etkilemez. */
export function mirrorToConsole(line: string): void {
  if (!consoleLogEnabled()) return;
  try {
    process.stdout.write(`${sanitizeLogLine(line)}\n`);
  } catch {
    /* konsol yazımı asla işi bozmaz */
  }
}
