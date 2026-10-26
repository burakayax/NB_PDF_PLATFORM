/**
 * X (Twitter) kuralları: link yanıtta, ipucu madde madde, 280 aşılırsa thread, en fazla 1 etiket, haftalık döngü, spam'den kaçınma.
 * Gerçek içerik kaynağı (frontend/public/social-x.json) üzerinde sınanır; dosya yoksa (ilk build öncesi) gerçek-içerik testleri atlanır.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  X_CYCLE,
  checkXPlan,
  composeFactPost,
  composePoll,
  composeProductPost,
  composeTipPost,
  decodeXBody,
  encodeXPlan,
  xLength,
} from "../modules/social/x-compose.js";
import type { XContent } from "../modules/social/x-compose.js";
import { kindForCount, pickXPost } from "../modules/social/x-queue.js";
import { publishToX } from "../modules/social/platforms/x.platform.js";

const FILE = fileURLToPath(new URL("../../../frontend/public/social-x.json", import.meta.url));
const REAL: XContent | null = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as XContent) : null;
const realIt = REAL ? it : it.skip;

describe("X uzunluk ölçümü", () => {
  it("adres 23, emoji 2, Türkçe harf 1 sayılır", () => {
    expect(xLength("Çalışkan öğrenci")).toBe(16);
    expect(xLength("👇")).toBe(2);
    expect(xLength("bak https://www.pdfplatform.app/blog/cok-uzun-bir-adres-yazi-icin?utm_source=x")).toBe(4 + 23);
  });
});

describe("X gönderi kuralları (gerçek içerik)", () => {
  realIt("her blog gönderisi: link ana metinde YOK, yanıtta; ≤280; ≤1 etiket; soru ile biter", () => {
    const entries = Object.entries(REAL!.posts);
    expect(entries.length).toBeGreaterThan(50);
    for (const [url, post] of entries) {
      const plan = composeTipPost({ post, link: url, seed: url });
      expect(checkXPlan(plan), url).toEqual([]);
      if (plan.kind !== "tweets") throw new Error("tweets bekleniyordu");
      const all = plan.parts.join("\n");
      expect(all.includes("http")).toBe(false);
      expect(plan.replyLink?.startsWith("Detaylı rehber 👇 https://")).toBe(true);
      expect(plan.replyLink?.includes("utm_source=x")).toBe(true);
      expect(plan.parts[plan.parts.length - 1]?.includes("?")).toBe(true);
      // maddeler yazının kendi bölüm başlıklarıdır (uydurma yok)
      expect(all.includes("•")).toBe(true);
    }
  });

  it("uzun ipuçlarında thread: numaralar 1/N … N/N, hepsi ≤280, link en son yanıtta, soru + 1 etiket son parçada", () => {
    const long = "Bu çok uzun bir ipucu başlığıdır ve gönderiyi tek parçaya sığdırmaz çünkü gerçekten epey uzun yazıldı";
    const post = {
      slug: "uzun",
      topic: "cv",
      tags: ["#CV", "#İşArama"],
      hook: "Uzun ipuçlu bir yazı",
      tips: [0, 1, 2, 3].map((i) => ({ title: `${long} ${i}`, text: "" })),
      card: "c",
      factTips: [],
      factCards: [],
    };
    const plan = composeTipPost({ post, link: "https://x.test/blog/uzun", seed: "uzun" });
    if (plan.kind !== "tweets") throw new Error("tweets bekleniyordu");
    expect(plan.parts.length).toBeGreaterThanOrEqual(2);
    plan.parts.forEach((p, i) => {
      expect(p.trimEnd().endsWith(`${i + 1}/${plan.parts.length}`)).toBe(true);
      expect(xLength(p)).toBeLessThanOrEqual(280);
      expect(p.includes("http")).toBe(false);
    });
    expect(checkXPlan(plan)).toEqual([]);
    const lastPart = plan.parts[plan.parts.length - 1] ?? "";
    expect(lastPart.includes("?")).toBe(true);
    expect((plan.parts.join(" ").match(/#[^\s#]+/gu) ?? []).length).toBeLessThanOrEqual(1);
    expect(plan.replyLink?.startsWith("Detaylı rehber 👇 https://x.test/blog/uzun")).toBe(true);
  });

  realIt("'Bunu biliyor muydunuz?' linksizdir ve en fazla 1 etiket taşır", () => {
    for (const [url, post] of Object.entries(REAL!.posts)) {
      const tipIndex = post.factTips?.[0];
      if (tipIndex === undefined || !post.tips[tipIndex]) continue;
      const plan = composeFactPost({ post, tipIndex, seed: url });
      expect(checkXPlan(plan), url).toEqual([]);
      if (plan.kind !== "tweets") throw new Error("tweets bekleniyordu");
      expect(plan.replyLink).toBeNull();
      expect(plan.parts[0]?.startsWith("Bunu biliyor muydunuz?")).toBe(true);
    }
  });

  realIt("ürün gönderileri: link yanıtta, görsel var, örnek rakam metinde açıkça 'Örnek'", () => {
    for (const product of REAL!.products) {
      const plan = composeProductPost({ product, seed: product.id });
      expect(checkXPlan(plan), product.id).toEqual([]);
      expect(product.card.endsWith(".png")).toBe(true);
      if (plan.kind === "tweets") expect(plan.replyLink?.startsWith("Hemen dene 👇 https://")).toBe(true);
    }
    const compress = REAL!.products.find((p) => p.id === "compress");
    expect(compress?.text.includes("Örnek")).toBe(true);
  });

  realIt("anketler 2–4 seçenek, seçenek ≤25 karakter", () => {
    expect(REAL!.polls.length).toBeGreaterThan(0);
    for (const poll of REAL!.polls) expect(checkXPlan(composePoll(poll)), poll.id).toEqual([]);
  });
});

describe("X gövde kodlama", () => {
  it("planı yazıya çevirip geri okur (thread + link yanıtı, anket)", () => {
    const thread = { kind: "tweets" as const, parts: ["bir 1/2", "iki 2/2"], replyLink: "Detaylı rehber 👇 https://x.test/a" };
    expect(decodeXBody(encodeXPlan(thread))).toEqual(thread);
    const poll = { kind: "poll" as const, question: "Soru?", options: ["A", "B", "C"] };
    expect(decodeXBody(encodeXPlan(poll))).toEqual(poll);
  });

  it("eski tek metinli gönderi (linkli) olduğu gibi yayınlanır", () => {
    expect(decodeXBody("Eski gönderi https://x.test")).toEqual({ kind: "tweets", parts: ["Eski gönderi https://x.test"], replyLink: null });
  });
});

describe("X haftalık döngü ve tekrar önleme", () => {
  const content: XContent = {
    posts: Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        `https://s.test/blog/yazi-${i}`,
        {
          slug: `yazi-${i}`,
          topic: "pdf",
          tags: ["#PDF"],
          hook: `Yazı ${i}`,
          tips: [0, 1, 2, 3].map((k) => ({ title: `İpucu ${i}-${k}`, text: `Açıklama ${i}-${k}` })),
          card: `https://s.test/x-cards/tip/yazi-${i}.png`,
          factTips: [1, 2],
          factCards: [`https://s.test/x-cards/fact/yazi-${i}-1.png`, `https://s.test/x-cards/fact/yazi-${i}-2.png`],
        },
      ]),
    ),
    products: [
      { id: "compress", text: "PDF sıkıştır", link: "https://s.test/tools/compress", card: "https://s.test/c.png" },
      { id: "merge", text: "PDF birleştir", link: "https://s.test/tools/merge-pdf", card: "https://s.test/m.png" },
    ],
    polls: [
      { id: "a", question: "A?", options: ["x", "y"] },
      { id: "b", question: "B?", options: ["x", "y", "z"] },
    ],
  };
  const postUrls = Object.keys(content.posts);

  it("6'lık döngü: 2 ipucu, 2 ürün, 1 anket, 1 'biliyor muydunuz'", () => {
    expect(X_CYCLE).toHaveLength(6);
    const kinds = Array.from({ length: 6 }, (_, i) => kindForCount(i));
    expect(kinds.filter((k) => k === "blog" || k === "blog2")).toHaveLength(2);
    expect(kinds.filter((k) => k === "product" || k === "product2")).toHaveLength(2);
    expect(kinds.filter((k) => k === "poll")).toHaveLength(1);
    expect(kinds.filter((k) => k === "fact")).toHaveLength(1);
  });

  it("40 gönderi boyunca aynı içerik (guid) yakın zamanda tekrarlanmaz; art arda aynı metin yok", () => {
    const usage = new Map<string, number>();
    const bodies: string[] = [];
    const guids: string[] = [];
    for (let i = 0; i < 40; i++) {
      const pick = pickXPost({ kind: kindForCount(i), content, usage, postUrls, recycle: true, siteOrigin: "https://s.test" });
      expect(pick).not.toBeNull();
      if (!pick) return;
      guids.push(pick.guid);
      bodies.push(pick.body);
      usage.set(pick.guid, i + 1);
      if (i > 0) expect(pick.body).not.toBe(bodies[i - 1]);
    }
    // anket havuzu 2 → 7 ankette en fazla 2 farklı; ama ipucu gönderisi 8 yazıda 16 gönderi boyunca hiç tekrar etmez
    const tips = guids.filter((g) => g.startsWith("https://"));
    expect(new Set(tips.slice(0, 8)).size).toBe(8);
  });

  it("geri dönüşüm kapalıyken içerik biterse null döner (gönderi uydurulmaz)", () => {
    const usage = new Map<string, number>(content.polls.map((p, i) => [`x-poll:${p.id}`, i + 1]));
    expect(pickXPost({ kind: "poll", content, usage, postUrls, recycle: false, siteOrigin: "https://s.test" })).toBeNull();
  });
});

describe("X yayıncısı (sahte API)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const SECRETS = { apiKey: "k", apiSecret: "s", accessToken: "t", accessSecret: "ts" };
  const ITEM = { guid: "g", lang: "tr" as const, title: "t", summary: "", link: "https://x.test", publishedAt: 0, categories: [], images: {} };

  function stubApi() {
    const tweets: { text: string; reply?: { in_reply_to_tweet_id: string }; media?: unknown; poll?: { options: string[]; duration_minutes: number } }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("/reel-covers/") || url.includes("/x-cards/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
      if (url.includes("/media/upload")) return new Response(JSON.stringify({ data: { id: "m1" } }));
      if (url.endsWith("/2/tweets")) {
        tweets.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: { id: `t${tweets.length}` } }));
      }
      return new Response("{}");
    });
    return tweets;
  }

  it("thread + link: görsel yalnız ilk gönderide; her parça öncekine yanıt; link EN SON yanıtta", async () => {
    const tweets = stubApi();
    const body = encodeXPlan({ kind: "tweets", parts: ["ilk 1/2", "ikinci 2/2"], replyLink: "Detaylı rehber 👇 https://x.test/a?utm_source=x" });
    const out = await publishToX({ body, imageUrl: "https://x.test/x-cards/tip/a.png", secrets: SECRETS, item: ITEM });
    expect(out.externalId).toBe("t1");
    expect(tweets).toHaveLength(3);
    expect(tweets[0]?.media).toBeTruthy();
    expect(tweets[0]?.text.includes("http")).toBe(false);
    expect(tweets[1]?.reply?.in_reply_to_tweet_id).toBe("t1");
    expect(tweets[1]?.media).toBeUndefined();
    expect(tweets[2]?.reply?.in_reply_to_tweet_id).toBe("t2");
    expect(tweets[2]?.text).toBe("Detaylı rehber 👇 https://x.test/a?utm_source=x");
  });

  it("tek gönderi + link: link ana gönderiye YANIT olarak gider", async () => {
    const tweets = stubApi();
    const body = encodeXPlan({ kind: "tweets", parts: ["ipucu"], replyLink: "Hemen dene 👇 https://x.test/t" });
    await publishToX({ body, imageUrl: null, secrets: SECRETS, item: ITEM });
    expect(tweets.map((t) => t.text)).toEqual(["ipucu", "Hemen dene 👇 https://x.test/t"]);
    expect(tweets[1]?.reply?.in_reply_to_tweet_id).toBe("t1");
  });

  it("anket: soru + seçenekler + 24 saat; görsel anketin ALTINA yanıt, link yok", async () => {
    const tweets = stubApi();
    const body = encodeXPlan({ kind: "poll", question: "PDF'i en çok ne için kullanıyorsunuz?", options: ["Birleştirme", "Sıkıştırma"] });
    await publishToX({ body, imageUrl: "https://x.test/x-cards/a.png", secrets: SECRETS, item: ITEM });
    expect(tweets).toHaveLength(2);
    expect(tweets[0]?.poll).toEqual({ options: ["Birleştirme", "Sıkıştırma"], duration_minutes: 1440 });
    expect(tweets[0]?.media).toBeUndefined();
    expect(tweets[1]?.reply?.in_reply_to_tweet_id).toBe("t1");
    expect(tweets[1]?.media).toBeTruthy();
    expect(tweets[1]?.text.includes("http")).toBe(false);
  });

  it("link yanıtı başarısız olursa gönderi yine BAŞARILI sayılır (aynı gönderi iki kez çıkmaz)", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/2/tweets")) {
        n++;
        return n === 1 ? new Response(JSON.stringify({ data: { id: "t1" } })) : new Response("hata", { status: 500 });
      }
      return new Response("{}");
    });
    vi.useFakeTimers();
    const body = encodeXPlan({ kind: "tweets", parts: ["ipucu"], replyLink: "Detaylı rehber 👇 https://x.test/a" });
    const p = publishToX({ body, imageUrl: null, secrets: SECRETS, item: ITEM });
    await vi.runAllTimersAsync();
    const out = await p;
    vi.useRealTimers();
    expect(out.externalId).toBe("t1");
  });
});
