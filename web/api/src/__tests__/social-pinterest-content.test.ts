import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let stored: Record<string, string> = {};
const tokenInfo = { env: "sandbox" as const, accessExpiresAt: Date.now() + 25 * 86_400_000, refreshExpiresAt: Date.now() + 55 * 86_400_000 };
let boards: Record<string, string> = {};

vi.mock("../modules/social/social.service.js", () => ({
  readAccountSecrets: vi.fn(async () => stored),
  readSocialConfig: vi.fn(async () => ({
    pinterestSandbox: true,
    pinterestToken: tokenInfo,
    pinterestBoards: boards,
    pinterestBoardsEnv: "sandbox",
    pinterestKeywords: {},
  })),
  writeSocialConfig: vi.fn(async () => ({})),
  saveAccount: vi.fn(async () => []),
}));
vi.mock("../modules/social/keywords.service.js", () => ({
  seoKeywordsFor: vi.fn(async () => ({ tr: ["cv örneği", "iş başvurusu cv"], en: [], tagsTr: [], tagsEn: [] })),
}));

import { socialLink } from "../modules/social/social-link.js";
import {
  buildPinAltText,
  buildPinDescription,
  buildPinTitle,
  cutAtWord,
  limitTags,
  PIN_LIMITS,
} from "../modules/social/pinterest-content.js";
import { createPinterestVideoPin, publishToPinterest } from "../modules/social/platforms/pinterest.platform.js";
import { withUtm, socialUtm } from "../lib/utm.js";

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  stored = { appId: "a", appSecret: "s", accessToken: "tok", refreshToken: "ref", boardId: "b-default" };
  boards = {};
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("UTM tek yerden", () => {
  it("Pinterest bağlantısı pinterest/social/<tür> taşır", () => {
    expect(socialLink("PINTEREST", "https://www.pdfplatform.app/tools/compress", "arac")).toBe(
      "https://www.pdfplatform.app/tools/compress?utm_source=pinterest&utm_medium=social&utm_campaign=arac",
    );
    expect(socialLink("PINTEREST", "https://www.pdfplatform.app/blog/x", "blog")).toContain("utm_campaign=blog");
  });
  it("adreste başka ağın etiketi varsa (linkedin) Pinterest'inkiyle değiştirilir", () => {
    const out = new URL(socialLink("PINTEREST", "https://x.app/a?utm_source=linkedin&utm_medium=social&utm_campaign=blog&ref=1", "blog"));
    expect(out.searchParams.get("utm_source")).toBe("pinterest");
    expect(out.searchParams.get("ref")).toBe("1");
    expect(out.searchParams.getAll("utm_source")).toHaveLength(1);
  });
  it("Pinterest etiketi zaten doğruysa aynen kalır; eski elle etiket (strict olmayan) ezilmez", () => {
    const own = "https://x.app/a?utm_source=pinterest&utm_medium=social&utm_campaign=blog";
    expect(socialLink("PINTEREST", own, "blog")).toBe(own);
    expect(withUtm("https://x.app/?utm_source=elle", socialUtm("X", "blog"))).toBe("https://x.app/?utm_source=elle");
  });
  it("diğer ağların kampanya adı değişmedi", () => {
    expect(socialLink("FACEBOOK", "https://x.app/t", "arac")).toContain("utm_campaign=arac-videosu");
    expect(socialLink("INSTAGRAM", "https://x.app/b", "blog")).toContain("utm_source=instagram");
  });
});

describe("Pin başlığı, açıklaması, alt metni", () => {
  it("ana anahtar kelime başlıkta BAŞTA olur ve 100 karakteri geçmez", () => {
    const t = buildPinTitle("PDF Sıkıştır: büyük dosyayı saniyeler içinde küçült", { main: "pdf sıkıştırma", extra: [] });
    expect(t).toBe("PDF sıkıştırma – Büyük dosyayı saniyeler içinde küçült");
    expect(t.length).toBeLessThanOrEqual(PIN_LIMITS.title);
    const long = buildPinTitle("x ".repeat(80), { main: "pdf word çevirme", extra: [] });
    expect(long.length).toBeLessThanOrEqual(PIN_LIMITS.title);
  });
  it("başlık zaten ana kelimeyle başlıyorsa dokunulmaz; kelime yoksa başlık aynen", () => {
    expect(buildPinTitle("PDF Sıkıştırma: hızlı", { main: "pdf sıkıştırma", extra: [] })).toBe("PDF Sıkıştırma: hızlı");
    expect(buildPinTitle("Başlık", null)).toBe("Başlık");
  });
  it("açıklamaya kısa çağrı eklenir, en fazla 3 etiket kalır, adresler silinir, 800'ü geçmez", () => {
    const d = buildPinDescription("PDF'i küçült. Tek tıkla. https://spam.example #a #b #c #d #e");
    expect(d).toContain("Ücretsiz dene: pdfplatform.app");
    expect((d.match(/#/g) ?? []).length).toBe(3);
    expect(d).not.toContain("spam.example");
    expect(buildPinDescription("kelime ".repeat(300)).length).toBeLessThanOrEqual(PIN_LIMITS.description);
    expect(buildPinDescription("kelime ".repeat(300))).toContain("pdfplatform.app");
  });
  it("çağrı zaten varsa tekrarlanmaz; İngilizcede İngilizce çağrı", () => {
    const d = buildPinDescription("Küçült. Ücretsiz dene: pdfplatform.app");
    expect(d.match(/pdfplatform\.app/g)).toHaveLength(1);
    expect(buildPinDescription("Shrink it.", "en")).toContain("Try it free: pdfplatform.app");
  });
  it("alt metin kapağı anlatır ve 500'ü geçmez", () => {
    const a = buildPinAltText("PDF Sıkıştır", { main: "pdf sıkıştırma", extra: [] });
    expect(a).toContain("PDF Sıkıştır");
    expect(a.length).toBeLessThanOrEqual(PIN_LIMITS.altText);
  });
  it("yardımcılar", () => {
    expect(cutAtWord("bir iki üç dört beş", 12)).toBe("bir iki üç");
    expect(limitTags("a #x #y #z", 2)).toBe("a #x #y");
  });
});

describe("Video pin", () => {
  const input = {
    boardId: "b1",
    title: "Başlık",
    description: "Açıklama",
    link: "https://www.pdfplatform.app/tools/compress?utm_source=pinterest",
    altText: "alt",
    videoUrl: "https://api.pdfplatform.app/files/v.mp4",
    coverImageUrl: "https://www.pdfplatform.app/reel-covers/compress.jpg",
  };

  function wireHappyPath(statuses: string[]) {
    let polls = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u === input.videoUrl) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      if (u.endsWith("/v5/media") && init?.method === "POST") {
        return json(201, {
          media_id: "m1",
          media_type: "video",
          upload_url: "https://pinterest-media-upload.s3-accelerate.amazonaws.com/",
          upload_parameters: { "Content-Type": "multipart/form-data", key: "uploads/k", policy: "p", "x-amz-signature": "sig" },
        });
      }
      if (u.startsWith("https://pinterest-media-upload")) return new Response(null, { status: 204 });
      if (u.includes("/v5/media/m1")) return json(200, { media_id: "m1", status: statuses[Math.min(polls++, statuses.length - 1)] });
      if (u.endsWith("/v5/pins")) return json(201, { id: "99" });
      throw new Error(`beklenmeyen istek: ${u}`);
    });
  }

  it("dört adım sırayla çalışır; yüklemede Bearer yok, parametreler dosyadan önce; pinde cover_image_url var", async () => {
    wireHappyPath(["processing", "succeeded"]);
    const sleeps: number[] = [];
    const pin = await createPinterestVideoPin(stored, input, async (ms) => void sleeps.push(ms));

    const calls = fetchMock.mock.calls as Array<[string, RequestInit | undefined]>;
    const urls = calls.map((c) => String(c[0]));
    // indir → kayıt → yükle → durum (2 kez) → pin
    expect(urls[1]).toBe("https://api-sandbox.pinterest.com/v5/media");
    expect(JSON.parse(String(calls[1]![1]!.body))).toEqual({ media_type: "video" });
    expect(urls[2]).toBe("https://pinterest-media-upload.s3-accelerate.amazonaws.com/");
    expect(urls.filter((u) => u.includes("/v5/media/m1"))).toHaveLength(2);
    expect(sleeps).toEqual([4000]);

    const upload = calls[2]![1]!;
    expect(upload.headers).toBeUndefined(); // Bearer anahtarı GÖNDERİLMEZ
    const keys = [...(upload.body as FormData).keys()];
    expect(keys).toEqual(["Content-Type", "key", "policy", "x-amz-signature", "file"]);

    const pinCall = calls[calls.length - 1]!;
    expect(String(pinCall[0])).toBe("https://api-sandbox.pinterest.com/v5/pins");
    expect(JSON.parse(String(pinCall[1]!.body))).toMatchObject({
      board_id: "b1",
      link: input.link,
      alt_text: "alt",
      media_source: { source_type: "video_id", media_id: "m1", cover_image_url: input.coverImageUrl },
    });
    expect(pin).toEqual({ id: "99", url: "https://www.pinterest.com/pin/99/", sandbox: true });
  });

  it("kapak yoksa videonun 1. saniyesindeki kare istenir (kapaksız istek gönderilmez)", async () => {
    wireHappyPath(["succeeded"]);
    await createPinterestVideoPin(stored, { ...input, coverImageUrl: null }, async () => {});
    const last = (fetchMock.mock.calls as Array<[string, RequestInit]>).at(-1)!;
    const media = JSON.parse(String(last[1].body)).media_source;
    expect(media.cover_image_url).toBeUndefined();
    expect(media.cover_image_key_frame_time).toBe(1);
  });

  it("Pinterest videoyu işleyemezse (failed) okunur hata verir ve pin oluşturmaz", async () => {
    wireHappyPath(["processing", "failed"]);
    await expect(createPinterestVideoPin(stored, input, async () => {})).rejects.toThrow(/işleyemedi/);
    expect((fetchMock.mock.calls as Array<[string]>).some((c) => String(c[0]).endsWith("/v5/pins"))).toBe(false);
  });

  it("yükleme reddedilirse hata verir", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u === input.videoUrl) return new Response(new Uint8Array([1]), { status: 200 });
      if (u.endsWith("/v5/media")) return json(201, { media_id: "m1", upload_url: "https://up.example/", upload_parameters: { key: "k" } });
      return new Response("denied", { status: 403 });
    });
    await expect(createPinterestVideoPin(stored, input, async () => {})).rejects.toThrow(/video yükleme/);
  });
});

describe("Otomatik yayıncı", () => {
  const baseItem = {
    guid: "tool-reel:compress",
    lang: "tr" as const,
    title: "PDF Sıkıştır: büyük dosyayı saniyeler içinde küçült",
    summary: "s",
    link: "https://www.pdfplatform.app/tools/compress?utm_source=linkedin",
    images: { wide: null, square: null, tall: null },
    categories: [],
  };

  it("araç videosu video pin olur; bağlantıya pinterest/arac UTM'i, açıklamaya çağrı, ana kelime başlığa girer", async () => {
    boards = { "pdf-duzenleme": "b-pdf" };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith(".mp4")) return new Response(new Uint8Array([1]), { status: 200 });
      if (u.includes("/reel-covers/")) return new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } });
      if (u.endsWith("/v5/media") && init?.method === "POST") {
        return json(201, { media_id: "m1", upload_url: "https://up.example/", upload_parameters: { key: "k" } });
      }
      if (u === "https://up.example/") return new Response(null, { status: 204 });
      if (u.includes("/v5/media/m1")) return json(200, { status: "succeeded" });
      if (u.endsWith("/v5/pins")) return json(201, { id: "7" });
      throw new Error(`beklenmeyen: ${u}`);
    });
    const res = await publishToPinterest({
      body: "PDF'i küçült. Tek tıkla.",
      imageUrl: "https://api.pdfplatform.app/files/abc.mp4",
      item: baseItem as never,
      secrets: stored,
    });
    expect(res.externalId).toBe("7");
    const pinCall = (fetchMock.mock.calls as Array<[string, RequestInit]>).find((c) => String(c[0]).endsWith("/v5/pins"))!;
    const sent = JSON.parse(String(pinCall[1].body));
    expect(sent.board_id).toBe("b-pdf");
    expect(sent.title.toLowerCase().startsWith("pdf sıkıştırma")).toBe(true);
    expect(sent.description).toContain("pdfplatform.app");
    const link = new URL(sent.link);
    expect(link.searchParams.get("utm_source")).toBe("pinterest");
    expect(link.searchParams.get("utm_campaign")).toBe("arac");
    expect(sent.media_source.source_type).toBe("video_id");
    expect(sent.alt_text).toBeTruthy();
  });

  it("görsel gönderi görsel pin olur ve CV yazısı CV panosuna gider", async () => {
    boards = { cv: "b-cv" };
    fetchMock.mockImplementation(async () => json(201, { id: "5" }));
    await publishToPinterest({
      body: "CV hazırlarken dikkat et.",
      imageUrl: "https://www.pdfplatform.app/covers/cv.jpg",
      item: { ...baseItem, guid: "blog-1", title: "Ats uyumlu cv örnekleri", link: "https://www.pdfplatform.app/tr/blog/cv" } as never,
      secrets: stored,
    });
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent.board_id).toBe("b-cv");
    expect(sent.media_source).toEqual({ source_type: "image_url", url: "https://www.pdfplatform.app/covers/cv.jpg" });
    expect(new URL(sent.link).searchParams.get("utm_campaign")).toBe("blog");
  });

  it("pano hiç seçilmemişse net hata verir", async () => {
    stored = { ...stored, boardId: "" };
    await expect(
      publishToPinterest({ body: "x", imageUrl: "https://x/y.jpg", item: baseItem as never, secrets: stored }),
    ).rejects.toThrow(/Pano seçilmemiş/);
  });
});
