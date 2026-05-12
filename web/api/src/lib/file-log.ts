import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const RETENTION_DAYS = 14;
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

let writeChain: Promise<void> = Promise.resolve();
let currentLogDate = "";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function rotatedPath(base: string, date: string): string {
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  return `${stem}.${date}${ext}`;
}

async function rotateLogs(abs: string): Promise<void> {
  const date = currentLogDate;
  const dest = rotatedPath(abs, date);
  try {
    await fs.rename(abs, dest);
  } catch {
    // Mevcut dosya yoksa veya yeniden adlandırma başarısız olursa devam et.
  }
  await pruneOldLogs(abs);
}

async function pruneOldLogs(abs: string): Promise<void> {
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  let entries: { name: string; mtime: number; size: number }[] = [];
  try {
    const dirents = await fs.readdir(dir);
    for (const name of dirents) {
      // Rotated files match stem.<YYYY-MM-DD>.ext pattern
      if (!name.startsWith(stem + ".") || !name.endsWith(ext) || name === base) continue;
      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        entries.push({ name: full, mtime: stat.mtimeMs, size: stat.size });
      } catch {
        // ignore
      }
    }
  } catch {
    return;
  }

  // Tarih bazlı silme: 14 günden eski dosyaları kaldır.
  for (const e of entries) {
    if (e.mtime < cutoff) {
      await fs.unlink(e.name).catch(() => undefined);
    }
  }

  // Toplam boyut limiti: en eski dosyaları sil.
  const remaining = entries.filter((e) => e.mtime >= cutoff);
  remaining.sort((a, b) => a.mtime - b.mtime);
  let total = remaining.reduce((s, e) => s + e.size, 0);
  for (const e of remaining) {
    if (total <= MAX_TOTAL_SIZE_BYTES) break;
    await fs.unlink(e.name).catch(() => undefined);
    total -= e.size;
  }
}

// Dosya günlüğü açıksa hedef yolun üst dizinini oluşturur; ilk append öncesi çağrılır.
// Dizin yoksa yazma işlemi hata verir ve üretim izleri kaybolur.
// Bu adım atlanırsa veya yanlış path verilirse günlük dosyası hiç oluşmayabilir.
export async function prepareLogFile(): Promise<void> {
  if (!env.LOG_FILE_ENABLED) {
    return;
  }
  const abs = path.resolve(env.LOG_FILE_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  currentLogDate = todayStamp();
}

// Tek bir NDJSON satırını dosyanın sonuna ekler; yazımları Promise zinciriyle sıraya alır.
// Eşzamanlı isteklerde satırların birbirine karışmasını önlemek için gereklidir.
// Gün değişiminde mevcut dosyayı tarihli isimle arşivler (günlük rotasyon).
export function appendLogLine(line: string): void {
  if (!env.LOG_FILE_ENABLED) {
    return;
  }
  const abs = path.resolve(env.LOG_FILE_PATH);
  writeChain = writeChain
    .then(async () => {
      const today = todayStamp();
      if (currentLogDate && today !== currentLogDate) {
        await rotateLogs(abs);
        currentLogDate = today;
      }
      await fs.appendFile(abs, `${line}\n`, "utf8");
    })
    .catch((err: unknown) => {
      console.error("[file-log] append failed", err);
    });
}
