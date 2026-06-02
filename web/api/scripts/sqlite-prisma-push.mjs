/**
 * Geliştirme ortamı için SQLite DATABASE_URL'sini Prisma CLI'ye zorla ve
 * `prisma migrate deploy` çalıştır (bekleyen migration'ları uygular).
 *
 * Neden migrate deploy, db push değil?
 *   - `db push` migration geçmişi oluşturmaz; şema değişiklikleri takip edilemez.
 *   - `migrate deploy` mevcut migration dosyalarını sırayla uygular ve idempotent'tir
 *     (zaten uygulanmış olanları atlar). Mevcut veriler korunur.
 *
 * Yeni migration oluşturmak için (şema değişikliği sonrası):
 *   npm run prisma:migrate --name <açıklama>
 * Üretimde uygulamak için:
 *   npm run prisma:deploy
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

const env = { ...process.env, DATABASE_URL: "file:./dev.db" };

const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: apiRoot,
  env,
  stdio: "inherit",
});

process.exit(r.status ?? 1);
