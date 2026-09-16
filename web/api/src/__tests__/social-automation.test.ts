/**
 * Sosyal medya otomasyonunun saf mantığı: metin kısaltma, etiket üretimi,
 * besleme ayrıştırma ve bir sonraki yayın anının hesabı.
 *
 * Bu dört nokta sessizce bozulduğunda sonuç yayına çıkmış kusurlu bir gönderi
 * olur (yarım bağlantı, yanlış saat, kayıp görsel) — bu yüzden testleniyorlar.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

beforeAll(() => {
  process.env.FRONTEND_ORIGIN = "https://example.test";
});

// ─── Metin kısaltma ───────────────────────────────────────────────────────────

describe("clamp — gönderi metnini sınıra sığdırma", () => {
  it("sınırın altındaki metne dokunmaz", async () => {
    const { clamp } = await import("../modules/social/copy.service.js");
    expect(clamp("kısa metin", 100)).toBe("kısa metin");
  });

  it("uzun gövdeyi keser ama sondaki bağlantıyı bozmadan korur", async () => {
    const { clamp } = await import("../modules/social/copy.service.js");
    const url = "https://example.test/blog/uzun-bir-yazi-adresi";
    const text = `${"kelime ".repeat(80).trim()}\n\n${url}`;

    const out = clamp(text, 250);

    expect(out.length).toBeLessThanOrEqual(250);
    expect(out).toContain(url);
    expect(out.endsWith(url)).toBe(true);
  });

  it("bağlantıyı ve etiket satırını birlikte korur", async () => {
    const { clamp } = await import("../modules/social/copy.service.js");
    const url = "https://example.test/blog/yazi";
    const tags = "#PdfAraclari #Belge";
    const text = `${"kelime ".repeat(60).trim()}\n\n${url}\n\n${tags}`;

    const out = clamp(text, 200);

    expect(out.length).toBeLessThanOrEqual(200);
    expect(out).toContain(url);
    expect(out).toContain(tags);
  });

  it("gövde içinde kalan yarım adresi tamamen atar", async () => {
    const { clamp } = await import("../modules/social/copy.service.js");
    const text = `${"a".repeat(60)} https://example.test/cok/uzun/bir/adres/olsun/da/kesilsin`;

    const out = clamp(text, 80);

    expect(out.length).toBeLessThanOrEqual(80);
    // Yarım bir adres tıklanmaz ve yanlış sayfaya gidebilir: hiç kalmamalı.
    expect(out).not.toMatch(/https?:\/\//);
  });
});

// ─── Etiketler ────────────────────────────────────────────────────────────────

describe("toHashtag", () => {
  it("kelimeleri birleştirir ve Türkçe harfleri KORUR", async () => {
    const { toHashtag } = await import("../modules/social/copy.service.js");
    // Türk kullanıcı "#PDFKırpma" arıyor; harfleri sadeleştirmek erişimi düşürür.
    expect(toHashtag("PDF kırpma")).toBe("#PDFKırpma");
    expect(toHashtag("pdf tablo görseli")).toBe("#PdfTabloGörseli");
  });

  it("etikette geçersiz karakterleri ayıklar", async () => {
    const { toHashtag } = await import("../modules/social/copy.service.js");
    expect(toHashtag("pdf'ten resim kesme")).toBe("#PdfTenResimKesme");
  });

  it("harfle başlamayan ya da boş kalan adayı eler", async () => {
    const { toHashtag } = await import("../modules/social/copy.service.js");
    expect(toHashtag("2026")).toBe("");
    expect(toHashtag("!!!")).toBe("");
  });
});

describe("sanitizeHashtags", () => {
  it("modelin yazdığı bozuk etiketi geçerli hâle getirir", async () => {
    const { sanitizeHashtags } = await import("../modules/social/copy.service.js");
    // Etikete yapışık noktalama etiketin parçası sayılır ve temizlenir;
    // aksi hâlde platformda etiket değil düz metin olarak görünür.
    expect(sanitizeHashtags("Deneme #pdf-kırpma! son")).toBe("Deneme #PdfKırpma son");
    expect(sanitizeHashtags("#PDFAraçları")).toBe("#PDFAraçları");
  });

  it("gövde metnine dokunmaz", async () => {
    const { sanitizeHashtags } = await import("../modules/social/copy.service.js");
    const body = "Bulanık ekran görüntüsü mü? Şu adrese bak: https://a.test/x";
    expect(sanitizeHashtags(body)).toBe(body);
  });
});

// ─── Besleme ayrıştırma ───────────────────────────────────────────────────────

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Kanal</title>
    <item>
      <title>Bir&apos;inci Yazı &amp; Başlık</title>
      <link>https://example.test/blog/bir</link>
      <guid isPermaLink="true">https://example.test/blog/bir</guid>
      <pubDate>Thu, 10 Sep 2026 20:54:00 GMT</pubDate>
      <description><![CDATA[Özet metni]]></description>
      <category>PDF</category>
      <category>Belge</category>
      <enclosure url="https://example.test/covers/bir.png" type="image/png" length="100" />
      <media:content url="https://example.test/covers/bir.png" medium="image" width="1200" height="630" />
      <media:content url="https://example.test/covers/square/bir.png" medium="image" width="1080" height="1080" />
      <media:content url="https://example.test/covers/tall/bir.png" medium="image" width="1000" height="1500" />
    </item>
    <item>
      <title>İkinci Yazı</title>
      <link>https://example.test/blog/iki</link>
      <guid isPermaLink="true">https://example.test/blog/iki</guid>
      <pubDate>Fri, 11 Sep 2026 08:00:00 GMT</pubDate>
      <description>Kısa özet</description>
    </item>
  </channel>
</rss>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFeedItems", () => {
  function stubFeed(xml: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );
  }

  it("yazıları okur, yeniden eskiye sıralar ve kaçış dizilerini çözer", async () => {
    stubFeed(FEED_XML);
    const { fetchFeedItems } = await import("../modules/social/rss.service.js");

    const items = await fetchFeedItems("tr");

    expect(items).toHaveLength(2);
    // 11 Eylül, 10 Eylül'den yeni: başa gelmeli.
    expect(items[0]?.title).toBe("İkinci Yazı");
    expect(items[1]?.title).toBe("Bir'inci Yazı & Başlık");
    expect(items[1]?.summary).toBe("Özet metni");
    expect(items[1]?.categories).toEqual(["PDF", "Belge"]);
  });

  it("görselleri en-boy oranına göre ayırır", async () => {
    stubFeed(FEED_XML);
    const { fetchFeedItems } = await import("../modules/social/rss.service.js");

    const withImages = (await fetchFeedItems("tr")).find((i) => i.guid.endsWith("/bir"));

    expect(withImages?.images).toEqual({
      wide: "https://example.test/covers/bir.png",
      square: "https://example.test/covers/square/bir.png",
      tall: "https://example.test/covers/tall/bir.png",
    });
  });

  it("görsel etiketi yoksa enclosure'a düşer", async () => {
    stubFeed(FEED_XML);
    const { fetchFeedItems } = await import("../modules/social/rss.service.js");

    const plain = (await fetchFeedItems("tr")).find((i) => i.guid.endsWith("/iki"));

    expect(plain?.images.wide).toBeUndefined();
  });

  it("besleme okunamazsa hata fırlatır", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("yok", { status: 404 })));
    const { fetchFeedItems } = await import("../modules/social/rss.service.js");

    await expect(fetchFeedItems("tr")).rejects.toThrow(/RSS okunamadı/);
  });
});

// ─── Çift dil eşleştirme ──────────────────────────────────────────────────────

const TR_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <item>
      <title>Türkçe Yazı</title>
      <link>https://example.test/blog/tr-yazi</link>
      <guid isPermaLink="true">https://example.test/blog/tr-yazi</guid>
      <pubDate>Fri, 11 Sep 2026 08:00:00 GMT</pubDate>
      <description>Türkçe özet</description>
      <atom:link rel="alternate" hreflang="en" href="https://example.test/en/blog/en-post" />
    </item>
    <item>
      <title>Eşi Olmayan Yazı</title>
      <link>https://example.test/blog/yalniz</link>
      <guid isPermaLink="true">https://example.test/blog/yalniz</guid>
      <pubDate>Thu, 10 Sep 2026 08:00:00 GMT</pubDate>
      <description>Tek dil</description>
    </item>
  </channel>
</rss>`;

const EN_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <item>
      <title>English Post</title>
      <link>https://example.test/en/blog/en-post</link>
      <guid isPermaLink="true">https://example.test/en/blog/en-post</guid>
      <pubDate>Fri, 11 Sep 2026 08:00:00 GMT</pubDate>
      <description>English summary</description>
      <atom:link rel="alternate" hreflang="tr" href="https://example.test/blog/tr-yazi" />
    </item>
  </channel>
</rss>`;

describe("fetchPairedFeedItems — çift dilli eşleştirme", () => {
  function stubBothFeeds() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        const xml = url.includes("/en/") ? EN_FEED : TR_FEED;
        return new Response(xml, { status: 200 });
      }),
    );
  }

  it("yazının diğer dildeki hâlini bağlantı üzerinden eşleştirir", async () => {
    stubBothFeeds();
    const { fetchPairedFeedItems } = await import("../modules/social/rss.service.js");

    const items = await fetchPairedFeedItems("tr");
    const paired = items.find((i) => i.link.endsWith("/tr-yazi"));

    // Sıraya veya tarihe değil, beslemedeki alternate bağlantısına güvenilir.
    expect(paired?.alt).toEqual({
      lang: "en",
      title: "English Post",
      summary: "English summary",
      link: "https://example.test/en/blog/en-post",
    });
  });

  it("karşılığı olmayan yazı tek dilli kalır", async () => {
    stubBothFeeds();
    const { fetchPairedFeedItems } = await import("../modules/social/rss.service.js");

    const lonely = (await fetchPairedFeedItems("tr")).find((i) => i.link.endsWith("/yalniz"));

    expect(lonely?.alt).toBeUndefined();
  });

  it("diğer besleme okunamazsa tek dile düşer, hata fırlatmaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) =>
        String(input).includes("/en/")
          ? new Response("yok", { status: 500 })
          : new Response(TR_FEED, { status: 200 }),
      ),
    );
    const { fetchPairedFeedItems } = await import("../modules/social/rss.service.js");

    const items = await fetchPairedFeedItems("tr");

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.alt === undefined)).toBe(true);
  });
});

// ─── Sonraki yayın anı ────────────────────────────────────────────────────────

describe("nextRunAt", () => {
  const base = {
    enabled: true,
    hour: 10,
    minute: 0,
    timeZone: "Europe/Istanbul",
    lang: "tr" as const,
    recycleOldPosts: true,
    bilingual: true,
    singleLang: "en" as const,
    researchKeywords: false,
  };

  it("otomasyon kapalıyken null döner", async () => {
    const { nextRunAt } = await import("../modules/social/social.service.js");
    expect(nextRunAt({ ...base, enabled: false })).toBeNull();
  });

  it("saat henüz gelmediyse bugünü verir", async () => {
    const { nextRunAt } = await import("../modules/social/social.service.js");
    // 15 Eylül 2026, 06:00 UTC = İstanbul'da 09:00 → hedef 10:00 henüz gelmedi.
    const next = nextRunAt(base, new Date("2026-09-15T06:00:00Z"));
    expect(next?.toISOString()).toBe("2026-09-15T07:00:00.000Z");
  });

  it("saat geçtiyse ertesi güne kayar", async () => {
    const { nextRunAt } = await import("../modules/social/social.service.js");
    // İstanbul'da 11:00 → bugünün 10:00'ı geçti.
    const next = nextRunAt(base, new Date("2026-09-15T08:00:00Z"));
    expect(next?.toISOString()).toBe("2026-09-16T07:00:00.000Z");
  });

  it("yaz saati uygulayan bir bölgede yerel saati korur", async () => {
    const { nextRunAt } = await import("../modules/social/social.service.js");
    const cfg = { ...base, timeZone: "Europe/Berlin" };

    // Yaz saatinde (UTC+2) ve kış saatinde (UTC+1) aynı YEREL saat beklenir.
    const summer = nextRunAt(cfg, new Date("2026-07-15T05:00:00Z"));
    const winter = nextRunAt(cfg, new Date("2026-01-15T05:00:00Z"));

    expect(summer?.toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(winter?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });
});

// ─── Takvim günü ──────────────────────────────────────────────────────────────

describe("calendarDayKey", () => {
  it("günü sunucunun değil, ayarlanan bölgenin saatine göre belirler", async () => {
    const { calendarDayKey } = await import("../modules/social/social.service.js");
    // UTC'de hâlâ 15 Eylül, İstanbul'da 16 Eylül olmuş.
    expect(calendarDayKey(new Date("2026-09-15T22:30:00Z"), "Europe/Istanbul")).toBe("2026-09-16");
    expect(calendarDayKey(new Date("2026-09-15T22:30:00Z"), "UTC")).toBe("2026-09-15");
  });

  it("geçersiz saat dilimini UTC'ye düşürür", async () => {
    const { calendarDayKey } = await import("../modules/social/social.service.js");
    expect(calendarDayKey(new Date("2026-09-15T22:30:00Z"), "Yok/Boyle_Bir_Yer")).toBe("2026-09-15");
  });
});

// ─── Bakiye reddi mi, yanlış anahtar mı? ─────────────────────────────────────

describe("PlatformError.looksLikeBilling", () => {
  it("ödeme kaynaklı retleri anahtar hatasından ayırır", async () => {
    const { PlatformError } = await import("../modules/social/platforms/common.js");

    // X bakiye bitince okumayı da kesiyor; bu ret anahtarla ilgili değildir.
    expect(new PlatformError("X", 402, "Payment required").looksLikeBilling).toBe(true);
    expect(new PlatformError("X", 403, "insufficient credit balance").looksLikeBilling).toBe(true);
    expect(new PlatformError("X", 429, "Usage cap exceeded").looksLikeBilling).toBe(true);

    // Gerçek kimlik hatası bakiyeye yıkılmamalı.
    expect(new PlatformError("X", 401, "Unauthorized").looksLikeBilling).toBe(false);
    expect(new PlatformError("X", 403, "Read-only application cannot POST").looksLikeBilling).toBe(false);
    expect(new PlatformError("X", 500, "Internal error").looksLikeBilling).toBe(false);
  });
});
