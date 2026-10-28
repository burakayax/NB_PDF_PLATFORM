/**
 * Sonuç sahnesi için kart üretir: indirilen sonuç dosyasının (ZIP'teki görseller, PDF sayfaları, metin) küçük
 * resimleri ve GERÇEK özet satırı (sayfa/görsel sayısı). Kart yoksa (ör. Word çıktısı) sahne eklenmez.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @returns {{ png: string, caption: string } | null} */
export function makeResultCard({ file, workDir }) {
  const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const out = `${workDir}/result/card.png`;
  const r = spawnSync(
    python,
    ["-I", resolve(here, "../fixtures/make-result-card.py"), file, out, resolve(here, "../../../public/fonts")],
    { encoding: "utf8" },
  );
  if (r.status !== 0 || !existsSync(out)) {
    console.log("SONUC-KARTI yok:", (r.stderr || r.stdout || "").trim().slice(0, 200));
    return null;
  }
  return JSON.parse(readFileSync(`${workDir}/result/card.json`, "utf8"));
}
