/**
 * Üretim (PostgreSQL) veritabanı güncellemesi — VERİ SİLMEZ.
 *
 * Eskiden deploy'da `prisma db push --accept-data-loss` çalışıyordu: şemadan kalkan bir
 * alan/tablo, içindeki veriyle birlikte sormadan silinirdi. Artık yalnız elle yazılıp
 * incelenmiş migration dosyaları (prisma/migrations-postgres) uygulanır.
 *
 * Bu betik sırayla:
 *  1. Veritabanı daha önce `db push` ile kurulmuşsa (tablolar var, ama migration kayıt tablosu yok)
 *     → "başlangıç (baseline) zaten uygulandı" kaydını düşer. Bunu ANCAK canlı şema,
 *     baseline ile birebir aynıysa yapar; aynı değilse DURUR (deploy başarısız olur, eski sürüm
 *     çalışmaya devam eder) ve farkı yazdırır.
 *  2. `prisma migrate deploy` çalıştırır (yalnız bekleyen migration'ları uygular).
 *
 * Her adımda hata olursa çıkış kodu != 0 → Render build'i başarısız sayar → yeni sürüm yayına çıkmaz.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");
const SCHEMA = path.join("prisma", "schema.postgres.prisma");
const BASELINE = "00000000000000_baseline";

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:/i.test(url)) {
  console.error("DATABASE_URL bir PostgreSQL adresi değil — bu betik yalnız üretim içindir.");
  process.exit(1);
}

function prisma(args, { capture = false } = {}) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: apiRoot,
    env: process.env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
}

async function inspect() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         (SELECT count(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations')::int AS tables,
         (to_regclass('public._prisma_migrations') IS NOT NULL) AS has_history`,
    );
    return { tables: rows[0].tables, hasHistory: rows[0].has_history };
  } finally {
    await client.end();
  }
}

const { tables, hasHistory } = await inspect();
console.log(`[db] tablo sayısı: ${tables}, migration kaydı var mı: ${hasHistory}`);

if (!hasHistory && tables > 0) {
  console.log("[db] Eski (db push ile kurulmuş) veritabanı bulundu — baseline hizalaması kontrol ediliyor...");
  const diff = prisma(
    ["migrate", "diff", "--from-config-datasource", "--to-schema", SCHEMA, "--exit-code"],
    { capture: true },
  );
  if (diff.status === 2) {
    console.error("[db] DURDU: canlı veritabanı şemadan farklı. Hiçbir değişiklik yapılmadı. Fark:");
    console.error(diff.stdout);
    process.exit(1);
  }
  if (diff.status !== 0) {
    console.error("[db] DURDU: şema karşılaştırması çalıştırılamadı:");
    console.error(diff.stdout, diff.stderr);
    process.exit(1);
  }
  console.log("[db] Canlı şema baseline ile birebir aynı. 'Uygulandı' kaydı düşülüyor (veriye dokunulmaz).");
  const resolve = prisma(["migrate", "resolve", "--applied", BASELINE]);
  if (resolve.status !== 0) process.exit(resolve.status ?? 1);
}

const deploy = prisma(["migrate", "deploy"]);
process.exit(deploy.status ?? 1);
