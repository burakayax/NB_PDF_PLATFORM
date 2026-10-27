// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
// @ts-expect-error — düz JS Worker dosyası, tipi yok
import { isle, bilinenIstemciRotasiMi, kabugiSifirla } from "../../cloudflare/not-found-worker.js";

const KABUK =
  '<!doctype html><html><head><meta name="robots" content="index, follow" />' +
  '<link rel="canonical" href="https://www.pdfplatform.app" />' +
  '<link rel="alternate" hreflang="tr" href="https://www.pdfplatform.app" />' +
  '<link rel="alternate" hreflang="en" href="https://www.pdfplatform.app/en" />' +
  '<link rel="alternate" hreflang="x-default" href="https://www.pdfplatform.app" />' +
  '<meta property="og:url" content="https://www.pdfplatform.app" /></head><body>SPA kabuğu</body></html>';
const ANA = "<!doctype html><html><body>gerçek prerender sayfası</body></html>";
const HTML = { "content-type": "text/html; charset=utf-8" };

/** Render'ı taklit eder: sadece belirli adresler gerçek, gerisi catch-all / boş 200. */
function render(kural: (yol: string) => Response): (istek: Request | string) => Promise<Response> {
  const getir = async (istek: Request | string): Promise<Response> => {
    const yol = new URL(typeof istek === "string" ? istek : istek.url).pathname;
    if (typeof istek !== "string" && istek.method === "HEAD") {
      const r: Response = await getir(new Request(istek.url));
      return new Response(null, { status: r.status, headers: r.headers });
    }
    if (yol === "/index.html") return new Response(KABUK, { status: 200, headers: HTML });
    if (yol === "/404.html")
      return new Response('<html lang="tr"><meta name="robots" content="noindex">404</html>', { status: 200, headers: HTML });
    return kural(yol);
  };
  return getir;
}
const kural = (yol: string) => {
  if (yol === "/about/index.html" || yol === "/en/about/index.html")
    return new Response('<html lang="x"><title>Hakkımızda</title><h1>Hakkımızda</h1></html>', { status: 200, headers: HTML });
  if (yol === "/tools/merge-pdf" || yol === "/en/blog/convert-pdf-to-word") return new Response(ANA, { status: 200, headers: HTML });
  if (yol.startsWith("/en/blog/")) return new Response(null, { status: 200, headers: { "content-length": "0" } });
  return new Response(KABUK, { status: 200, headers: HTML }); // catch-all
};
const iste = (yol: string, getir = render(kural), method = "GET") =>
  isle(new Request(`https://www.pdfplatform.app${yol}`, { method }), getir);

describe("Cloudflare 404 Worker", () => {
  it("bilinmeyen adresler gerçek 404 + noindex", async () => {
    for (const yol of ["/bu-sayfa-yok-xyz", "/en/bu-yok", "/en/blog/bu-yok-xyz"]) {
      const r = await iste(yol);
      expect(r.status, yol).toBe(404);
      expect(r.headers.get("x-robots-tag")).toContain("noindex");
      expect(r.headers.get("cache-control")).toContain("max-age=60");
    }
  });
  it("gerçek sayfalar ve istemci rotaları 200 kalır", async () => {
    for (const yol of ["/", "/tools/merge-pdf", "/en/blog/convert-pdf-to-word", "/login", "/register", "/en/register", "/about", "/workspace/x", "/hesap/profil", "/?view=login"]) {
      expect((await iste(yol)).status, yol).toBe(200);
    }
  });
  it("HEAD isteği (curl -I) de aynı sonucu verir", async () => {
    expect((await iste("/bu-sayfa-yok-xyz", render(kural), "HEAD")).status).toBe(404);
    expect((await iste("/tools/merge-pdf", render(kural), "HEAD")).status).toBe(200);
    expect((await iste("/login", render(kural), "HEAD")).status).toBe(200);
  });
  it("giriş/kayıt sayfaları noindex + kendi canonical'ı; /about kendi canonical'ı", async () => {
    const reg = await iste("/en/register");
    const rm = await reg.text();
    expect(reg.status).toBe(200);
    expect(reg.headers.get("x-robots-tag")).toContain("noindex");
    expect(rm).toContain('content="noindex, nofollow"');
    expect(rm).toContain('rel="canonical" href="https://www.pdfplatform.app/en/register"');
    expect(rm).toContain('hreflang="tr" href="https://www.pdfplatform.app/register"');
    const ab = await iste("/about");
    const am = await ab.text();
    expect(ab.status).toBe(200);
    expect(ab.headers.get("x-robots-tag")).toBeNull();
    expect(am).toContain("<h1>Hakkımızda</h1>"); // prerender dosyası sunulur
    expect((await (await iste("/en/about")).text())).toContain("<h1>Hakkımızda</h1>");
    const ct = await iste("/contact");
    expect(ct.headers.get("x-robots-tag")).toContain("noindex");
    const head = await iste("/register", render(kural), "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("deploy sonrası derleme farkı (hash) olsa da catch-all yine yakalanır", async () => {
    kabugiSifirla();
    const eski = KABUK.replace("</head>", '<script src="/assets/index-AAA111.js"></script></head>');
    const yeni = KABUK.replace("</head>", '<script src="/assets/index-BBB222.js"></script></head>');
    const getir = async (i: Request | string) => {
      const yol = new URL(typeof i === "string" ? i : i.url).pathname;
      if (yol === "/index.html") return new Response(yeni, { status: 200, headers: HTML });
      if (yol === "/404.html") return new Response("x", { status: 404 });
      return new Response(eski, { status: 200, headers: HTML });
    };
    expect((await iste("/bu-yok-hash", getir)).status).toBe(404);
    expect((await (await iste("/register", getir)).text())).toContain('content="noindex, nofollow"');
  });
  it("API, dosya uzantılı adres ve POST dokunulmaz", async () => {
    expect((await iste("/api/yok")).status).toBe(200);
    expect((await iste("/assets/x.js")).status).toBe(200);
    expect((await iste("/bu-yok", render(kural), "POST")).status).toBe(200);
  });
  it("Render'dan gelen 404/301 ve hatalar olduğu gibi geçer (fail-open)", async () => {
    expect((await iste("/x", async () => new Response("", { status: 404 }))).status).toBe(404);
    expect((await iste("/x", async () => new Response("", { status: 301 }))).status).toBe(301);
    kabugiSifirla();
    const bozuk = async (i: Request | string) => {
      if (new URL(typeof i === "string" ? i : i.url).pathname === "/index.html") throw new Error("ağ hatası");
      return new Response(KABUK, { status: 200, headers: HTML });
    };
    // kabuk alınamazsa 404'e çevirme riski alma
    expect((await iste("/bu-yok-2", bozuk)).status).toBe(200);
  });
  it("/en altında İngilizce yedek 404 gövdesi", async () => {
    const getir = async (i: Request | string) => {
      const yol = new URL(typeof i === "string" ? i : i.url).pathname;
      if (yol === "/404.html") throw new Error("yok");
      return render(kural)(i);
    };
    const r = await iste("/en/yok-sayfa", getir);
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("Page not found");
  });
  it("bilinen rota listesi uygulamanın kaynağıyla senkron", () => {
    execFileSync("node", ["cloudflare/build-not-found-worker.mjs", "--kontrol"], { stdio: "pipe" });
    expect(bilinenIstemciRotasiMi("/en/register")).toBe(true);
  });
});
