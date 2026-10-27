/**
 * Elle yükleme paketi: bir araç videosunu ve her ağın açıklama metnini ayrı klasörlere koyar.
 *
 * NE ZAMAN: API ile paylaşılamayan ağlar (şimdilik TikTok; onaylı API erişimi yok) ve otomatik
 * paylaşım kapalıyken. Video, GitHub "Araç videosu üretimi" işinin çıktısıdır (Actions → işin
 * sonunda "arac-videosu-cikti" dosyası; 2 gün saklanır). İçinde iki dosya var:
 *   reel.mp4          → son karede "Bağlantı profilde"   (Instagram, TikTok)
 *   reel-aciklama.mp4 → son karede "Bağlantı açıklamada" (YouTube, Facebook)
 *
 * KULLANIM (web/api klasöründen):
 *   npx tsx scripts/export-manual-pack.ts --tool compress --dir "C:/indirilen/arac-videosu-cikti" --out "../../sosyal medya/yayin-paketi"
 *
 * Metinler katalogdaki elle yazılmış, doğrulanmış özetten kurulur; yapay zekâ kullanılmaz.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { TOOL_REEL_CATALOG } from "../src/modules/social/tool-reel-catalog.js";
import { ensureQuestion, toHashtag } from "../src/modules/social/copy.service.js";
import { socialUtm, withUtm } from "../src/lib/utm.js";

type Target = {
  folder: string;
  /** Hangi videoyu alır. */
  video: "reel.mp4" | "reel-aciklama.mp4";
  /** Açıklamadaki adres tıklanıyor mu? Hayırsa "profildeki bağlantı" denir. */
  linkInText: boolean;
  utmSource: string;
  maxTags: number;
  maxChars: number;
};

const TARGETS: Target[] = [
  { folder: "instagram", video: "reel.mp4", linkInText: false, utmSource: "INSTAGRAM", maxTags: 5, maxChars: 2200 },
  { folder: "tiktok", video: "reel.mp4", linkInText: false, utmSource: "tiktok", maxTags: 4, maxChars: 2200 },
  { folder: "youtube", video: "reel-aciklama.mp4", linkInText: true, utmSource: "YOUTUBE", maxTags: 3, maxChars: 5000 },
  { folder: "facebook", video: "reel-aciklama.mp4", linkInText: true, utmSource: "FACEBOOK", maxTags: 3, maxChars: 2200 },
];

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`Eksik: --${name}`);
    process.exit(1);
  }
  return v;
}

const toolId = arg("tool");
const srcDir = resolve(arg("dir"));
const outRoot = resolve(arg("out"));

const entry = TOOL_REEL_CATALOG.find((e) => e.id === toolId);
if (!entry) {
  console.error(`Katalogda yok: ${toolId}. Seçenekler: ${TOOL_REEL_CATALOG.map((e) => e.id).join(", ")}`);
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
const packDir = join(outRoot, `${day}-${toolId}`);

const side = { lang: "tr" as const, title: entry.tr.title, summary: entry.tr.summary, link: entry.tr.link, terms: [], tags: [] };

for (const t of TARGETS) {
  const dir = join(packDir, t.folder);
  mkdirSync(dir, { recursive: true });

  const src = join(srcDir, t.video);
  if (existsSync(src)) copyFileSync(src, join(dir, "video.mp4"));
  else console.warn(`Uyarı: ${src} bulunamadı; ${t.folder} klasörüne video konmadı.`);

  const link = withUtm(entry.tr.link, socialUtm(t.utmSource, "arac-videosu"));
  const tags = [...entry.keywords.tagsTr, "PDF", "PDFPlatform"]
    .map((x) => toHashtag(x, "tr"))
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, t.maxTags)
    .join(" ");
  const linkLine = t.linkInText ? link : `Bağlantı profilde: ${new URL(entry.tr.link).host.replace(/^www\./, "")}`;
  const body = ensureQuestion(`${entry.tr.title}\n\n${entry.tr.summary}`, side, 900);
  const text = [body, linkLine, tags, t.folder === "youtube" ? "#Shorts" : ""].filter(Boolean).join("\n\n").slice(0, t.maxChars);

  writeFileSync(join(dir, "aciklama.txt"), `${text}\n`, "utf8");
  if (t.folder === "youtube") writeFileSync(join(dir, "baslik.txt"), `${entry.tr.title.slice(0, 95)}\n`, "utf8");
}

writeFileSync(
  join(packDir, "OKU-BENI.txt"),
  [
    `Araç: ${entry.tr.title}`,
    "",
    "Her klasörde video.mp4 ve aciklama.txt var. Videoyu ağın uygulamasından yükle, açıklamayı olduğu gibi yapıştır.",
    "TikTok: bağlantı açıklamada tıklanmaz; profil biyografisindeki bağlantı pdfplatform.app olmalı.",
    "Paylaştıktan sonra ilk saat gelen yorumlara cevap ver: erken etkileşim erişimi artırır.",
  ].join("\n"),
  "utf8",
);
console.log(`Hazır: ${packDir}`);
