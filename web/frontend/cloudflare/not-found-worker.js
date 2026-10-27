/**
 * Cloudflare Worker — bilinmeyen adreslere GERÇEK 404 durum kodu verir.
 *
 * NEDEN: Render statik sitesinde son kural ("/*" → "/index.html") her bilinmeyen adresi
 * 200 ile ana sayfaya düşürüyor; blog kuralı da dosya yoksa BOŞ gövdeli 200 dönüyor.
 * Arama motorları bunları "kopya sayfa" sayıyor.
 *
 * YÖNTEM (liste yerine CEVABA bakar): isteği önce Render'a iletir, cevap
 *   (a) boş gövdeli 200 (blog kuralı) ya da
 *   (b) /index.html ile birebir aynı gövde (catch-all) VE adres uygulamanın bilinen
 *       istemci rotası değilse
 * 404.html içeriğini 404 ile döndürür. Yeni eklenen sayfalar listeye gerek kalmadan çalışır.
 *
 * GÜVENLİK (fail-open): her hata, belirsizlik ya da beklenmeyen durumda Render cevabı
 * olduğu gibi geçer. /api/*, dosya uzantılı adresler ve GET/HEAD dışı istekler hiç
 * incelenmez.
 *
 * Bilinen istemci rotaları bölümü `node cloudflare/build-not-found-worker.mjs` ile
 * src/lib/appNavigation.ts + accountPaths.ts'ten üretilir (elle düzenleme).
 */

/*ROTALAR:BASLA*/
const BILINEN_TAM = ["/","/login","/register","/forgot-password","/about","/terms","/privacy","/kvkk","/workspace","/nbadmin","/admin","/team-invite","/pricing","/contact","/pdf-api","/blog","/taramalarim","/login-success","/login-error","/google-signup","/index.html","/reset-password","/verify-email","/hesap/profil","/hesap/api","/hesap/abonelik"];
const BILINEN_ONEK = ["/legal/","/admin/","/invite/","/fake-payment","/pdf-api/","/blog/","/hesap/","/imzala/","/tools/","/api/","/payment","/workspace/"];
/*ROTALAR:BITIS*/

/**
 * Gerçek istemci sayfaları ama statik dosyaları yok: Render bunlara ana sayfa kabuğunu
 * (canonical = ana sayfa, robots = index) verir. Worker kabuğun SEO etiketlerini düzeltir.
 * Giriş/kayıt gibi sayfalar dizine girmemeli; /about kendi adresini göstermeli.
 */
const NOINDEX_SAYFALAR = [
  "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/login-success", "/login-error", "/google-signup", "/team-invite", "/nbadmin",
];
const KENDI_KANONIK_SAYFALAR = ["/about"];

const KABUK_OMRU_MS = 5 * 60 * 1000;
const YEDEK_404 = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sayfa bulunamadı | PDF Platform</title><meta name="robots" content="noindex, nofollow"></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px"><h1>Sayfa bulunamadı</h1><p><a href="/">Ana sayfaya dön</a></p></body></html>`;
const YEDEK_404_EN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | PDF Platform</title><meta name="robots" content="noindex, nofollow"></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px"><h1>Page not found</h1><p><a href="/en">Back to home</a></p></body></html>`;

let kabuk = { metin: null, zaman: 0 };

/** Dil önekini (/en) soyar, sondaki eğik çizgiyi atar. */
export function yalinYol(yol) {
  return yol.replace(/\/+$/, "").replace(/^\/en(?=\/|$)/, "") || "/";
}

export function bilinenIstemciRotasiMi(yol, arama = "") {
  const p = yalinYol(yol);
  if (BILINEN_TAM.includes(p)) return true;
  if (BILINEN_ONEK.some((o) => p.startsWith(o))) return true;
  return new URLSearchParams(arama).has("view");
}

/** Statik dosya gibi görünen (uzantılı) ya da API adresi mi? İncelenmez. */
export function incelenmezMi(yol) {
  if (yol.startsWith("/api/")) return true;
  const son = yol.split("/").pop() || "";
  return /\.[a-z0-9]{1,8}$/i.test(son) && son !== "index.html";
}

/** Testler için önbelleği boşaltır. */
export function kabugiSifirla() {
  kabuk = { metin: null, zaman: 0 };
}

/** Kabuk HTML'inin canonical/hreflang/og:url/robots etiketlerini bu sayfaya göre yazar. */
export function kabukSeoDuzelt(metin, origin, yol, noindex) {
  const bare = yalinYol(yol);
  const tr = origin + bare;
  const en = origin + "/en" + bare;
  const kendi = /^\/en(\/|$)/.test(yol) ? en : tr;
  let m = metin
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + kendi + b)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + kendi + b)
    .replace(/(<link rel="alternate" hreflang="tr" href=")[^"]*(")/, (_, a, b) => a + tr + b)
    .replace(/(<link rel="alternate" hreflang="en" href=")[^"]*(")/, (_, a, b) => a + en + b)
    .replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, (_, a, b) => a + tr + b);
  if (noindex) {
    m = m.replace(/(<meta name="robots" content=")[^"]*(")/, (_, a, b) => a + "noindex, nofollow" + b);
  }
  return m;
}

async function kabukMetni(kok, getir) {
  if (kabuk.metin !== null && Date.now() - kabuk.zaman < KABUK_OMRU_MS) return kabuk.metin;
  const r = await getir(new URL("/index.html", kok).toString(), { cf: { cacheTtl: 300 } });
  if (!r.ok) return null;
  const metin = await r.text();
  kabuk = { metin, zaman: Date.now() };
  return metin;
}

async function bulunamadiCevabi(kok, yol, getir) {
  const ingilizce = /^\/en(\/|$)/.test(yol);
  let govde = null;
  try {
    const r = await getir(new URL("/404.html", kok).toString(), { cf: { cacheTtl: 300 } });
    const t = r.ok ? await r.text() : "";
    if (t.includes("<html") && t.toLowerCase().includes("noindex")) govde = t;
  } catch {
    /* yedek metne düş */
  }
  if (!govde) govde = ingilizce ? YEDEK_404_EN : YEDEK_404;
  return new Response(govde, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=60",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function isle(request, getir = fetch) {
  const orijinal = await getir(request);
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return orijinal;
    const url = new URL(request.url);
    if (incelenmezMi(url.pathname) || yalinYol(url.pathname) === "/") return orijinal;
    if (orijinal.status !== 200) return orijinal;

    const tur = (orijinal.headers.get("content-type") || "").toLowerCase();
    const uzunluk = orijinal.headers.get("content-length");

    // (a) Blog kuralının boş 200'ü: gövde 0 bayt (dosya uzantılı adresler zaten dışarıda).
    if (uzunluk === "0") {
      return await bulunamadiCevabi(url.origin, url.pathname, getir);
    }

    // (c) Bilinen istemci sayfaları (giriş/kayıt/hakkımızda): kabuğun SEO etiketlerini düzelt.
    const bare = yalinYol(url.pathname);
    const noindex = NOINDEX_SAYFALAR.includes(bare);
    if ((noindex || KENDI_KANONIK_SAYFALAR.includes(bare)) && tur.includes("text/html")) {
      const govdeCevabi =
        request.method === "HEAD" ? await getir(new Request(request.url, { method: "GET" })) : orijinal.clone();
      const [metin, kabukIcerigi] = await Promise.all([govdeCevabi.text(), kabukMetni(url.origin, getir)]);
      if (kabukIcerigi !== null && metin.length > 0 && metin === kabukIcerigi) {
        const basliklar = new Headers(orijinal.headers);
        ["content-length", "content-encoding", "etag"].forEach((h) => basliklar.delete(h));
        if (noindex) basliklar.set("x-robots-tag", "noindex, nofollow");
        const yeni = kabukSeoDuzelt(metin, url.origin, url.pathname, noindex);
        return new Response(request.method === "HEAD" ? null : yeni, { status: 200, headers: basliklar });
      }
      return orijinal;
    }

    // (b) Catch-all: gövde /index.html ile birebir aynı ve bilinen istemci rotası değil.
    if (tur.includes("text/html") && !bilinenIstemciRotasiMi(url.pathname, url.search)) {
      // HEAD cevabında gövde yok: karşılaştırma için aynı adresi GET ile çek.
      const govdeCevabi =
        request.method === "HEAD" ? await getir(new Request(request.url, { method: "GET" })) : orijinal.clone();
      const [metin, kabukIcerigi] = await Promise.all([
        govdeCevabi.text(),
        kabukMetni(url.origin, getir),
      ]);
      if (kabukIcerigi !== null && metin.length > 0 && metin === kabukIcerigi) {
        return await bulunamadiCevabi(url.origin, url.pathname, getir);
      }
    }
    return orijinal;
  } catch {
    return orijinal; // fail-open
  }
}

export default {
  async fetch(request) {
    return isle(request);
  },
};
