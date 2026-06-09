/*
 * PDF PLATFORM — Service Worker (elden yazılmış, Vite public/ üzerinden köke servis edilir).
 * Strateji (SaaS'a göre):
 *   - Navigasyon (HTML): network-first → çevrimdışı: önbellekteki app shell → offline.html
 *   - Hash'li statik varlıklar (js/css/font/img): cache-first + arka planda tazeleme
 *   - /api/*: network-only (asla önbelleğe alınmaz; kimlik/ödeme/PDF işlemleri taze olmalı)
 *   - POST/PUT vb. ve çapraz-köken istekleri: dokunulmaz, tarayıcıya bırakılır
 * Sürüm değişince activate'te eski önbellekler silinir.
 */
const SW_VERSION = "v1.0.2";
const STATIC_CACHE = `nbpdf-static-${SW_VERSION}`;
const RUNTIME_CACHE = `nbpdf-runtime-${SW_VERSION}`;
const APP_SHELL_URL = "/";
const OFFLINE_URL = "/offline.html";

// install'da öncelikli önbelleğe alınacak çekirdek kabuk.
const PRECACHE_URLS = [
  APP_SHELL_URL,
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Tek tek ekle: biri 404 olsa bile install'ı bozma.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null),
        ),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      // Gezinti önyükleme optimizasyonu (destekleyen tarayıcılarda).
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

// Sayfa "yeni sürümü hemen etkinleştir" derse beklemeyi atla.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico)$/i.test(
    url.pathname,
  );
}

async function networkFirstNavigation(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) {
      return preload;
    }
    const fresh = await fetch(event.request);
    // App shell'i güncel tut (çevrimdışı geri dönüş için).
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(STATIC_CACHE).then((c) => c.put(APP_SHELL_URL, copy));
    }
    return fresh;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    // start_url dahil tüm navigasyonlar için kabuğu (sorgu yok sayılarak) döndür → çevrimdışı 200.
    const shell = await cache.match(APP_SHELL_URL);
    if (shell) {
      return shell;
    }
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Offline", { status: 503, statusText: "Offline" })
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Arka planda tazele (hash'li dosyalar değişmez; hash'siz olanlar güncellenir).
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          cache.put(request, res.clone());
        }
      })
      .catch(() => {});
    return cached;
  }
  const res = await fetch(request);
  if (res && res.ok) {
    cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);

  // Yalnızca kendi kökenimiz; çapraz köken (fontlar, ipapi, analytics) tarayıcıya bırakılır.
  if (url.origin !== self.location.origin) {
    return;
  }

  // API: asla önbelleğe alma, asla çevrimdışı sahte yanıt verme.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      cacheFirstAsset(request).catch(
        () => new Response("", { status: 504, statusText: "Asset offline" }),
      ),
    );
  }
});
