// Uzun süre önbellekte tutulan ("immutable") büyük dosyaların parmak izi koruması.
//
// KAPSAM: yalnız git'te izlenen ve 30 gün önbellekli klasörler (şu an: fonts). Model klasörleri
// (tts-tr, photo-ai, tesseract, scanic-ml) git'te DEĞİL; derlemede indirilir ve 7 gün önbellekli.
// Onlarda sürüm yöntemi: kaynak değişirse setup-*.mjs'de ve koddaki dosya ADINA sürüm ekle
// (örn. modnet.onnx → modnet-v2.onnx); eski ad en geç 7 gün sonra tazelenir.
//
// NEDEN: render.yaml fonts klasörüne 30 günlük önbellek veriyor. Dosya adı aynı kalıp içerik
// değişirse ziyaretçilerin tarayıcısı eski dosyayı 30 gün boyunca kullanır. Bu denetim,
// içerik değiştiği halde ad değişmediyse CI'yı durdurur ve ne yapılacağını söyler.
//
// Kullanım (web/frontend içinden):
//   node scripts/static-asset-hashes.mjs           → denetle (hata varsa çıkış kodu 1)
//   node scripts/static-asset-hashes.mjs --update  → listeyi yeniden yaz (dosya ADI sürümlendikten sonra)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.resolve(here, "..", "public");
export const MANIFEST_PATH = path.resolve(here, "static-asset-hashes.json");
// render.yaml'daki 30 günlük kuralla AYNI klasörler.
export const GUARDED_DIRS = ["fonts"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function currentHashes() {
  const result = {};
  for (const d of GUARDED_DIRS) {
    const root = path.join(PUBLIC_DIR, d);
    if (!existsSync(root)) continue;
    for (const file of walk(root).sort()) {
      const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join("/");
      let data = readFileSync(file);
      // Metin dosyalarında Windows (CRLF) ile Linux (LF) satır sonu farkı parmak izini bozmasın.
      if (/\.(css|txt|json|md)$/i.test(file)) data = Buffer.from(data.toString("utf8").replaceAll(String.fromCharCode(13, 10), String.fromCharCode(10)));
      result[rel] = createHash("sha256").update(data).digest("hex");
    }
  }
  return result;
}

/** Kayıtlı listeyle karşılaştırır; sorunları okunur cümleler olarak döner. */
export function findProblems() {
  const saved = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) : {};
  const now = currentHashes();
  const problems = [];
  for (const [file, hash] of Object.entries(now)) {
    if (saved[file] === undefined) {
      problems.push(`Yeni dosya listede yok: ${file} (liste güncellenmeli: node scripts/static-asset-hashes.mjs --update)`);
    } else if (saved[file] !== hash) {
      problems.push(
        `İçerik değişmiş ama adı aynı: ${file}. Bu klasör 30 gün önbellekte tutulur; ziyaretçiler eski dosyayı görür. ` +
          `Dosyanın ADINA sürüm ekleyin (örn. model-v2.onnx), koddaki yolu güncelleyin, sonra listeyi yenileyin.`,
      );
    }
  }
  for (const file of Object.keys(saved)) {
    if (now[file] === undefined) problems.push(`Listede olan dosya yok: ${file} (listeyi güncelleyin)`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--update")) {
    const now = currentHashes();
    writeFileSync(MANIFEST_PATH, JSON.stringify(now, null, 2) + "\n");
    console.log(`${Object.keys(now).length} dosya kaydedildi.`);
  } else {
    const problems = findProblems();
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log("Uzun önbellekli dosyalar kayıtla tutarlı.");
  }
}
