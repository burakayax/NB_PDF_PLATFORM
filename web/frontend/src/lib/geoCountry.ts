// Tek noktadan ülke kodu çözümü — IP geolokasyon çağrılarını oturum başına bir kez yapar,
// sonucu 24 saat localStorage'da önbelleğe alır ve sağlayıcı zinciri başarısız olursa null döner.
// Hem dil tespiti (main.tsx) hem para birimi (CheckoutCurrency) bunu paylaşır → tekrarlı istek yok.

const CACHE_KEY = "nbpdf-geo-country-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 saat
const TIMEOUT_MS = 6000;

type CacheEntry = { cc: string | null; ts: number };

/** Aynı sayfa yaşam döngüsünde paralel çağrıları tek isteğe indirger. */
let inFlight: Promise<string | null> | null = null;

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cc: string | null): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cc, ts: Date.now() } satisfies CacheEntry));
  } catch {
    /* yoksay (özel mod / kota) */
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

// Ülke, KENDİ alan adımızdaki Cloudflare ucundan (/cdn-cgi/trace) okunur: istek zaten bizim CDN'imize
// gider, ek bir üçüncü tarafa IP adresi gönderilmez. (Eskiden ipwho.is / ipapi.co'ya gidiyordu; onaysız ve
// gizlilik metninde yoktu — KVKK md. 9 ve aydınlatma sorunu.) Yerelde (dev) uç yoktur → null döner, sorun değil.
const PROVIDERS: Array<() => Promise<string | null>> = [
  async () => {
    const r = await fetchWithTimeout(`${window.location.origin}/cdn-cgi/trace`);
    if (!r.ok) return null;
    const m = /^loc=([A-Z]{2})$/m.exec(await r.text());
    return m?.[1] && m[1] !== "XX" && m[1] !== "T1" ? m[1] : null;
  },
];

/**
 * Ülke kodunu (ISO-3166 alpha-2) döner; ağ erişimi yoksa veya tüm sağlayıcılar
 * başarısızsa `null`. Sonuç (null dahil) 24 saat önbelleğe alınır → tekrar istek atılmaz.
 */
export async function getCountryCode(): Promise<string | null> {
  const cached = readCache();
  if (cached) {
    return cached.cc;
  }
  if (inFlight) {
    return inFlight;
  }
  inFlight = (async () => {
    for (const provider of PROVIDERS) {
      try {
        const cc = await provider();
        if (cc) {
          writeCache(cc);
          return cc;
        }
      } catch {
        /* sıradaki sağlayıcıyı dene */
      }
    }
    // Tümü başarısız: null'ı da önbelleğe al ki bu kullanıcı için tekrar denenmesin.
    writeCache(null);
    return null;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
