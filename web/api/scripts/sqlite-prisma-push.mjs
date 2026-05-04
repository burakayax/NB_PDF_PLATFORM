/**
 * Force SQLite DATABASE_URL for Prisma CLI (does not load Node env.ts).
 * Matches runtime coercion in src/config/env.ts (file:./dev.db).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

const env = { ...process.env, DATABASE_URL: "file:./dev.db" };

const r = spawnSync(process.execPath, [prismaCli, "db", "push", "--accept-data-loss"], {
  cwd: apiRoot,
  env,
  stdio: "inherit",
});

process.exit(r.status ?? 1);
