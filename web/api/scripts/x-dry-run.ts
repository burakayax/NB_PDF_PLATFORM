/**
 * X gönderilerini YAYINLAMADAN gösterir (dry-run). Hiçbir ağ isteği yapmaz, hiçbir yere yazmaz.
 *
 *   npx tsx scripts/x-dry-run.ts [yazı-adresi-parçası]
 *
 * Her tür için bir örnek üretir: ana gönderi (+ thread), link yanıtı, görsel, uzunluklar ve kural denetimi.
 * Kaynak: frontend/public/social-x.json (siteyi derleyince üretilir).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  checkXPlan,
  composeFactPost,
  composePoll,
  composeProductPost,
  composeTipPost,
  encodeXPlan,
  xLength,
} from "../src/modules/social/x-compose.js";
import type { XContent, XPlan } from "../src/modules/social/x-compose.js";

const SITE = "https://www.pdfplatform.app";
const file = fileURLToPath(new URL("../../frontend/public/social-x.json", import.meta.url));
const content = JSON.parse(readFileSync(file, "utf8")) as XContent;
const needle = process.argv[2] ?? "ogretmen-cv-ornegi";

function show(title: string, plan: XPlan, image: string | null) {
  console.log(`\n════ ${title} ════`);
  if (plan.kind === "poll") {
    console.log(`ANKET (24 saat)\n${plan.question}\n${plan.options.map((o) => `  ○ ${o}  (${o.length}/25)`).join("\n")}`);
  } else {
    plan.parts.forEach((p, i) => {
      console.log(`\n[${i === 0 ? "ANA GÖNDERİ" : `THREAD ${i + 1}`}]  ${xLength(p)}/280${i === 0 && image ? `  + görsel` : ""}\n${p}`);
    });
    if (plan.replyLink) console.log(`\n[LİNK YANITI → ${plan.parts.length > 1 ? "thread'in son gönderisine" : "ana gönderiye"}]  ${xLength(plan.replyLink)}/280\n${plan.replyLink}`);
  }
  if (image) console.log(`\nGörsel: ${image}`);
  const problems = checkXPlan(plan);
  console.log(`\nKural denetimi: ${problems.length === 0 ? "✓ uygun" : "✗ " + problems.join("; ")}`);
  console.log(`\n(panelde görünen gövde)\n${encodeXPlan(plan).split("\n").map((l) => `  | ${l}`).join("\n")}`);
}

const url = Object.keys(content.posts).find((u) => u.includes(needle));
const post = url ? content.posts[url] : undefined;
if (!url || !post) throw new Error(`Yazı bulunamadı: ${needle}`);

show("1) BLOG İPUCU gönderisi", composeTipPost({ post, link: url, seed: url }), `${SITE}${post.card}`);
const product = content.products[0];
if (product) show("2) ÜRÜN gönderisi", composeProductPost({ product, seed: `x-product:${product.id}` }), `${SITE}${product.card}`);
const poll = content.polls[0];
if (poll) show("3) ANKET", composePoll(poll), null);
const factIndex = post.factTips?.[0] ?? 1;
show("4) 'BUNU BİLİYOR MUYDUNUZ?' (linksiz)", composeFactPost({ post, tipIndex: factIndex, seed: `x-fact:${url}:${factIndex}` }), post.factCards[0] ? `${SITE}${post.factCards[0]}` : null);
