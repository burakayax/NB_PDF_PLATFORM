import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tokenInfo = { env: "sandbox" as const, accessExpiresAt: Date.now() + 25 * 86_400_000, refreshExpiresAt: Date.now() + 55 * 86_400_000 };

vi.mock("../modules/social/social.service.js", () => ({
  readAccountSecrets: vi.fn(async () => ({})),
  readSocialConfig: vi.fn(async () => ({ pinterestSandbox: true, pinterestToken: tokenInfo, pinterestBoards: {}, pinterestKeywords: {} })),
  writeSocialConfig: vi.fn(async () => ({})),
  saveAccount: vi.fn(async () => []),
}));
vi.mock("../modules/social/keywords.service.js", () => ({
  seoKeywordsFor: vi.fn(async () => ({ tr: [], en: [], tagsTr: [], tagsEn: [] })),
}));

import { TOOL_REEL_CATALOG } from "../modules/social/tool-reel-catalog.js";
import { PIN_BOARDS, PIN_BOARD_KEYS, TOOL_BOARD, DEFAULT_PIN_BOARD, type PinBoardKey } from "../modules/social/pinterest-boards.config.js";
import { boardIdFor, chooseBoard, foldText, hasTerm, toolSlugFromLink } from "../modules/social/pinterest-board.js";
import { computeBoardSetup, syncBoards } from "../modules/social/pinterest-board-setup.js";

const blog = (title: string, extra: { categories?: string[]; summary?: string; link?: string } = {}) =>
  chooseBoard({ guid: "https://www.pdfplatform.app/blog/x", title, link: extra.link ?? "https://www.pdfplatform.app/tr/blog/x", ...extra });

describe("Her pano için en az iki örnek başlık doğru panoya gider", () => {
  const cases: [PinBoardKey, string[]][] = [
    ["cv", ["ATS uyumlu CV nasıl hazırlanır", "Europass özgeçmiş nasıl doldurulur", "Öğretmen CV örneği"]],
    ["pdf-duzenleme", ["PDF dosyası nasıl küçültülür", "Word'e çevirme: ücretsiz yöntemler", "İki PDF'i tek dosyada birleştirme"]],
    ["tarama", ["Telefonla belge tarama rehberi", "Taranmış PDF'i aranabilir yapma", "Fotoğraftan PDF yapma yolları"]],
    ["gizlilik", ["PDF paylaşmadan önce kimlik numarası nasıl gizlenir", "PDF üstveri (metadata) nasıl temizlenir", "KVKK'ya uygun belge paylaşımı"]],
    ["hukuk", ["Kira sözleşmesi nasıl kontrol edilir", "UYAP belgeleriyle çalışma rehberi", "Cezai şart nasıl hesaplanır"]],
    ["ogrenci", ["Ödev teslimi için PDF birleştirme", "Tez PDF'i nasıl küçültülür", "Üniversite ders notlarını düzenleme"]],
  ];
  for (const [board, titles] of cases) {
    for (const title of titles) {
      it(`${board} ← "${title}"`, () => {
        const c = blog(title);
        expect(c.key).toBe(board);
        if (board === DEFAULT_PIN_BOARD) expect(c.reason).toBe("varsayılan pano");
        else expect(c.reason).toMatch(/^(blog kategorisi\/etiketi|anahtar kelime): /);
      });
    }
  }
});

describe("Seçim sırası", () => {
  it("1) elle seçim her şeyi geçer; geçersiz anahtar yok sayılır", () => {
    expect(chooseBoard({ guid: "tool-reel:compress", title: "x" }, "hukuk")).toEqual({ key: "hukuk", reason: "elle seçim" });
    expect(chooseBoard({ guid: "tool-reel:compress", title: "x" }, "yok-boyle-pano").key).toBe("pdf-duzenleme");
  });
  it("2) araç eşleştirmesi başlıktaki anahtar kelimeden önce gelir ve nedeni araç adını söyler", () => {
    const c = chooseBoard({ guid: "tool-reel:compress", title: "Ödev için PDF küçült", link: "https://www.pdfplatform.app/tools/compress" });
    expect(c).toEqual({ key: "pdf-duzenleme", reason: "araç eşleştirmesi: compress" });
  });
  it("araç videosu katalog adresinden, araç sayfası bağlantısından tanınır", () => {
    expect(chooseBoard({ guid: "tool-reel:merge", title: "Birleştir" })).toEqual({ key: "pdf-duzenleme", reason: "araç eşleştirmesi: merge-pdf" });
    expect(chooseBoard({ guid: "x", title: "t", link: "https://www.pdfplatform.app/en/tools/udf-to-pdf" }).key).toBe("hukuk");
    expect(toolSlugFromLink("https://www.pdfplatform.app/tools/cv-olustur?a=1")).toBe("cv-olustur");
    expect(toolSlugFromLink("https://www.pdfplatform.app/tr/blog/cv")).toBeNull();
  });
  it("pdf-ozetle aracı öğrenci panosuna gider", () => {
    expect(chooseBoard({ guid: "x", title: "PDF Özetle", link: "https://www.pdfplatform.app/tools/pdf-ozetle" })).toEqual({
      key: "ogrenci",
      reason: "araç eşleştirmesi: pdf-ozetle",
    });
    expect(TOOL_BOARD["pdf-ozetle"]).toBe("ogrenci");
  });
  it("3) blog kategorisi/etiketi, başlıktaki kelimeden önce gelir", () => {
    const c = blog("Yeni başlayanlar için rehber", { categories: ["CV", "Kariyer"] });
    expect(c).toEqual({ key: "cv", reason: "blog kategorisi/etiketi: cv" });
    expect(blog("Ödev rehberi", { categories: ["Sözleşme"] }).key).toBe("hukuk");
  });
  it("4) kategori yoksa başlık + açıklamadaki anahtar kelime", () => {
    expect(blog("Rehber", { summary: "Üniversite öğrencileri için tez teslimi" })).toEqual({ key: "ogrenci", reason: "anahtar kelime: tez" });
  });
  it("5) hiçbiri tutmazsa pdf-duzenleme", () => {
    expect(blog("Rastgele bir başlık")).toEqual({ key: "pdf-duzenleme", reason: "varsayılan pano" });
  });
  it("kısa terimler tam sözcük arar: 'ats' kelimenin içinde tutmaz, 'CV'ni' tutar", () => {
    expect(blog("Kats ve ocr gibi kelimeler").key).toBe("tarama"); // ocr tam sözcük
    expect(blog("Kayıtsız şartsız rehber").key).toBe("pdf-duzenleme"); // "ats" yok sayılır
    expect(blog("CV'ni nasıl yazarsın").key).toBe("cv");
    expect(hasTerm(foldText("Tezgah"), "tez")).toBe(false);
    expect(hasTerm(foldText("Sözleşmesi"), "sozlesme")).toBe(true);
  });
});

describe("Araç → pano tablosu", () => {
  const toolsDir = resolve(process.cwd(), "../frontend/public/tools");
  const siteTools = readdirSync(toolsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

  it("sitedeki HER araç tabloda var (yeni araç eklenince bu test unutulmayı yakalar)", () => {
    expect(siteTools.length).toBeGreaterThan(40);
    expect(siteTools.filter((s) => !TOOL_BOARD[s])).toEqual([]);
  });
  it("tablodaki her ad gerçek bir araç (yazım hatası yok) ve pano anahtarı geçerli", () => {
    expect(Object.keys(TOOL_BOARD).filter((s) => !siteTools.includes(s))).toEqual([]);
    for (const board of Object.values(TOOL_BOARD)) expect(PIN_BOARD_KEYS).toContain(board);
  });
  it("her video kataloğu aracının sayfası tabloda", () => {
    for (const entry of TOOL_REEL_CATALOG) {
      const slug = toolSlugFromLink(entry.tr.link);
      expect(slug && TOOL_BOARD[slug], entry.id).toBeTruthy();
    }
  });
  it("7 pano tanımlı, adlar ve açıklamalar dolu", () => {
    expect(PIN_BOARD_KEYS).toHaveLength(7);
    for (const k of PIN_BOARD_KEYS) {
      expect(PIN_BOARDS[k].name.length).toBeGreaterThan(5);
      expect(PIN_BOARDS[k].description.length).toBeGreaterThan(20);
    }
  });
});

describe("Pano kimliği ve ortam", () => {
  it("eşleme varsa kimlik döner; yoksa ya da ortam değiştiyse null", () => {
    expect(boardIdFor("cv", { cv: "b1" }, "sandbox", "sandbox")).toBe("b1");
    expect(boardIdFor("cv", { cv: "b1" }, null, "production")).toBe("b1");
    expect(boardIdFor("cv", { cv: "b1" }, "sandbox", "production")).toBeNull();
    expect(boardIdFor("hukuk", { cv: "b1" }, "sandbox", "sandbox")).toBeNull();
    expect(boardIdFor("bilinmeyen", { cv: "b1" }, null, "sandbox")).toBeNull();
  });
});

describe("Pano kurulumu", () => {
  const exists = [
    { id: "p1", name: "pdf düzenleme ipuçları", privacy: "PUBLIC" }, // küçük harf + Türkçe karakter farkı
    { id: "p2", name: "BELGE GİZLİLİĞİ VE KİŞİSEL VERİ", privacy: "PUBLIC" },
    { id: "px", name: "Başka bir pano", privacy: "PUBLIC" },
  ];

  it("aynı adlı panolar harf/Türkçe farkı yok sayılarak bulunur, diğerleri eksik sayılır", () => {
    const s = computeBoardSetup(exists, {}, null, true);
    const by = Object.fromEntries(s.rows.map((r) => [r.key, r]));
    expect(by["pdf-duzenleme"]).toMatchObject({ boardId: "p1", source: "adla bulundu" });
    expect(by["gizlilik"]).toMatchObject({ boardId: "p2", source: "adla bulundu" });
    expect(by["cv"]).toMatchObject({ boardId: null, source: "eksik" });
    expect(s.missingCount).toBe(5);
    expect(s.envMismatch).toBe(false);
  });
  it("kayıtlı kimlik hâlâ hesapta duruyorsa 'kayıtlı' kalır; silinmişse ada bakılır", () => {
    expect(computeBoardSetup(exists, { cv: "p1" }, "sandbox", true).rows[0]).toMatchObject({ key: "cv", boardId: "p1", source: "kayıtlı" });
    expect(computeBoardSetup(exists, { cv: "yok" }, "sandbox", true).rows[0]).toMatchObject({ key: "cv", boardId: null, source: "eksik" });
  });
  it("kutu değişince (kum havuzu → gerçek) eski kimlikler geçersiz sayılır ve uyarı verilir", () => {
    const s = computeBoardSetup(exists, { cv: "p1" }, "sandbox", false);
    expect(s.envMismatch).toBe(true);
    expect(s.rows[0]).toMatchObject({ key: "cv", boardId: null, source: "eksik" });
  });

  describe("sync (ağ çağrılarıyla)", () => {
    const fetchMock = vi.fn();
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    const config = { pinterestSandbox: true, pinterestToken: tokenInfo, pinterestBoards: {}, pinterestBoardsEnv: null, pinterestKeywords: {} };
    const secrets = { appId: "a", appSecret: "s", accessToken: "t", refreshToken: "r" };
    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("createMissing=false: yeni pano AÇILMAZ, bulunanlar bağlanır", async () => {
      fetchMock.mockResolvedValue(reply(200, { items: exists }));
      const r = await syncBoards(secrets, config as never, false);
      expect(r.created).toEqual([]);
      expect(r.boards).toEqual({ "pdf-duzenleme": "p1", gizlilik: "p2" });
      expect(fetchMock.mock.calls.every((c) => (c[1] as RequestInit).method === "GET")).toBe(true);
    });
    it("createMissing=true: eksik 5 pano ad + açıklamayla ve HERKESE AÇIK oluşturulur", async () => {
      let n = 0;
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") return reply(201, { id: `new${++n}`, name: JSON.parse(String(init.body)).name });
        return reply(200, { items: exists });
      });
      const r = await syncBoards(secrets, config as never, true);
      expect(r.created.sort()).toEqual(["cv", "donusum", "hukuk", "ogrenci", "tarama"]);
      const posts = (fetchMock.mock.calls as Array<[string, RequestInit]>).filter((c) => c[1].method === "POST");
      expect(posts).toHaveLength(5);
      const sent = JSON.parse(String(posts[0]![1].body));
      expect(sent.privacy).toBe("PUBLIC");
      expect(sent.description).toBeTruthy();
      expect(Object.keys(r.boards)).toHaveLength(7);
      expect(r.state.missingCount).toBe(0);
    });
  });
});
