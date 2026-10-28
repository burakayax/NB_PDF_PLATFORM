/**
 * Kaydırmalı gönderi TASARIM ÖNİZLEMESİ: seçilen yazılar için yeni slaytları bir klasöre çizer (siteye/manifest'e dokunmaz).
 * Kullanım: node scripts/preview-carousel.mjs <çıktı klasörü> <slug> [<slug>...]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { curatedCarousel } from "../src/blog/carouselCopy.mjs";
import { CAROUSEL_COPY, extractCarousel } from "../src/blog/carouselSlides.mjs";
import { loadFont, measure, textPath, wrap } from "./generate-covers.mjs";
import { blogLayoutMap, fitHook, renderBlogCover } from "./lib/blog-cover.mjs";
import { fitBlock, linesToPath, spaced } from "./generate-carousels.mjs";
import { planIcons, visualCtaSvg, visualStepSvg } from "./lib/slide-visuals.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [out, ...slugs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const bold = loadFont(ROOT, "Roboto-Bold.ttf");
const regular = loadFont(ROOT, "Roboto-Regular.ttf");
const copy = CAROUSEL_COPY.tr;
const publicDir = join(ROOT, "public");
const logo = await sharp(join(publicDir, "logo.png")).resize({ width: 170 }).png().toBuffer();
const posts = getBlogPostsSorted();
const layouts = blogLayoutMap(posts);

for (const slug of slugs) {
  const post = posts.find((p) => p.slug === slug);
  const tr = post.tr;
  const curated = curatedCarousel(slug);
  const auto = curated ? null : extractCarousel(tr.blocks);
  const slides = curated ? curated.slides : auto.slides;
  const kind = curated ? "points" : auto.kind;
  const hook = curated ? curated.hook : tr.title;
  const tool = (tr.blocks.find((b) => b?.t === "cta" && typeof b.tool === "string") ?? {}).tool ?? null;
  const total = slides.length + 2;
  const tools = { fitBlock, linesToPath, spaced, measure, textPath, wrap, swipe: copy.swipe };
  const icons = planIcons(slides);
  const fonts = { bold, regular };
  const dir = join(out, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "1.jpg"), await renderBlogCover({ title: fitHook(hook), post, layout: layouts.get(slug), w: 1080, h: 1350, key: "carousel", cta: copy.swipe, format: "jpeg", publicDir, badge: { big: String(slides.length), small: kind === "steps" ? "ADIM" : "İPUCU" } }));
  for (let i = 0; i < slides.length; i++) {
    const label = (kind === "steps" ? copy.stepLabel : copy.pointLabel)(i + 1, slides.length);
    const svg = visualStepSvg({ slide: slides[i], index: i + 1, count: slides.length, total, accent: post.accent, label, fonts, tools, icons: icons[i] });
    await sharp(Buffer.from(svg)).composite([{ input: logo, top: 34, left: 84 }]).jpeg({ quality: 90 }).toFile(join(dir, `${i + 2}.jpg`));
  }
  const cta = visualCtaSvg({ accent: post.accent, total, fonts, tools, copy, target: tool ? `pdfplatform.app${tool}` : "pdfplatform.app" });
  await sharp(Buffer.from(cta)).composite([{ input: logo, top: 34, left: 84 }]).jpeg({ quality: 90 }).toFile(join(dir, `${total}.jpg`));
  console.log(slug, total, "slayt");
}
