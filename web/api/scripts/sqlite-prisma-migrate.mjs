/**
 * Geliştirme ortamında yeni migration oluşturur (`prisma migrate dev`).
 *
 * Kullanım:
 *   node scripts/sqlite-prisma-migrate.mjs --name <açıklama>
 *   npm run prisma:migrate -- --name add_new_column
 *
 * Bu script:
 *   1. Şemayı mevcut migration geçmişiyle karşılaştırır.
 *   2. Fark varsa prisma/migrations/ altına yeni SQL dosyası oluşturur.
 *   3. Migration'ı dev.db'ye uygular.
 *   4. Prisma Client'ı yeniden oluşturur.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

const env = { ...process.env, DATABASE_URL: "file:./dev.db" };

// Komut satırından --name argümanını ilet
const extraArgs = process.argv.slice(2);

const r = spawnSync(process.execPath, [prismaCli, "migrate", "dev", ...extraArgs], {
  cwd: apiRoot,
  env,
  stdio: "inherit",
});

process.exit(r.status ?? 1);
