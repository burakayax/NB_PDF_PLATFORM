/**
 * Google Analytics 4 (gtag.js) — SPA sayfa görünümleri.
 * Varsayılan olarak çerez onayı (`useCookieConsent`) verilmeden script yüklenmez;
 * `App.tsx` içindeki geçici test bayrağı ile bu kural devre dışı bırakılabilir.
 */

import { trackJourneyEvent } from "../api/analytics";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_PLACEHOLDER = "G-XXXXXXXXXX";

/**
 * KULLANICININ SİTEYE GİRDİĞİ İLK ADRES ve GELDİĞİ YER — modül yüklenir yüklenmez,
 * React çalışmadan ve adres çubuğu değişmeden yakalanır.
 *
 * NEDEN GEREKLİ: Analytics yalnızca kullanıcı çerez onayı verdikten SONRA
 * başlatılıyor. O ana kadar kullanıcı sayfalar arasında gezinmiş, uygulama da
 * adresi birkaç kez değiştirmiş oluyor. Onay geldiğinde ölçüm aracı O ANKİ
 * adresi "giriş sayfası" sanıyor; arama motorundan ya da reklamdan gelen
 * kampanya bilgisi (utm_source, gclid gibi) çoktan silinmiş oluyor.
 *
 * Sonuç: oturum hiçbir kanala eşlenemiyor ve raporlarda "Unassigned"
 * (atanmamış) olarak görünüyor. Aşağıdaki iki değer ilk yapılandırmaya
 * verilerek kaynak bilgisi korunur.
 */
const LANDING_HREF = typeof window !== "undefined" ? window.location.href : "";
const LANDING_REFERRER = typeof document !== "undefined" ? document.referrer : "";

function normalizeMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  if (!id || id === GA_PLACEHOLDER) {
    return null;
  }
  if (!/^G-[A-Z0-9]+$/i.test(id)) {
    return null;
  }
  return id;
}

export function getGaMeasurementId(): string | null {
  return normalizeMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

/**
 * Uygulama tarayıcıdan mı yoksa **kurulu PWA** (ana ekrana eklenmiş "app")
 * olarak mı açıldı? `standalone` = kullanıcı siteyi program gibi yüklemiş.
 */
export function getDisplayMode(): "standalone" | "browser" {
  if (typeof window === "undefined") return "browser";
  const mm = window.matchMedia;
  const standalone =
    (mm && mm("(display-mode: standalone)").matches) ||
    (mm && mm("(display-mode: window-controls-overlay)").matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone ? "standalone" : "browser";
}

const INTERNAL_FLAG_KEY = "nb_internal_traffic";

/**
 * KENDİ ZİYARETLERİMİZ ANALİTİĞİ KİRLETMESİN.
 *
 * Site sahibinin ve test amaçlı tarayıcı oturumlarının girişleri gerçek
 * kullanıcı sayılırsa raporlar (kullanıcı sayısı, kaynaklar, şehirler,
 * etkileşim süresi) yanıltıcı olur. Bir tarayıcıda `?internal=1` ile açıp
 * bayrak kaydedilir; bundan sonra o tarayıcının ölçümü GA4'te
 * `traffic_type=internal` ile işaretlenir. `?internal=0` bayrağı kaldırır.
 * GA4 tarafında "Dahili trafik" veri filtresi etkinleştirilince bu oturumlar
 * raporlardan çıkar. Kişisel veri içermez; yalnızca yerel bir işarettir.
 */
export function isInternalTraffic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("internal");
    if (q === "1") window.localStorage.setItem(INTERNAL_FLAG_KEY, "1");
    else if (q === "0") window.localStorage.removeItem(INTERNAL_FLAG_KEY);
    return window.localStorage.getItem(INTERNAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Modül yüklenirken okunur: SPA yönlendirmesi `?internal=` parametresini silmeden önce. */
const INTERNAL_TRAFFIC = isInternalTraffic();

let gaInitialized = false;
/** İlk sayfa görüntülemesi `config` ile zaten gönderildi mi? */
let firstPageViewSent = false;

/** gtag.js ekler ve ilk config ile GA4’ü başlatır. Çoklu çağrıda yalnızca bir kez çalışır. */
export function initializeGA(): boolean {
  const id = getGaMeasurementId();
  if (!id || gaInitialized) {
    return gaInitialized;
  }

  window.dataLayer = window.dataLayer ?? [];
  // KRİTİK: gtag.js, dataLayer'a push edilen her komut kaydının `arguments` NESNESİ
  // olmasını bekler. Rest-param ile gerçek bir Array push edilirse (eski hata) gtag.js
  // `js`/`config` komutlarını TANIMAZ → page_view/collect hiç gönderilmez. Bu yüzden
  // Google'ın resmi snippet'i `dataLayer.push(arguments)` kullanır; biz de aynısını yaparız.
  if (!window.gtag) {
    const gtag: (...args: unknown[]) => void = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag = gtag;
  }

  window.gtag("js", new Date());
  // Giriş adresi + yönlendiren AÇIKÇA verilir; onay geç geldiğinde bile oturum
  // doğru kanala (arama, sosyal, reklam, doğrudan) atanır.
  window.gtag("config", id, {
    page_location: LANDING_HREF || undefined,
    page_referrer: LANDING_REFERRER || undefined,
    ...(INTERNAL_TRAFFIC ? { traffic_type: "internal" } : {}),
  });
  // Bu `config` çağrısı giriş sayfası için bir görüntüleme kaydı gönderir;
  // aynı sayfa iki kez sayılmasın diye ilk `trackGAPageView` atlanır.
  firstPageViewSent = true;

  // "App olarak mı, tarayıcıdan mı açıldı?" — her oturuma kullanıcı-özelliği olarak
  // etiket (GA4'te boyut/segment) + bir kez `app_open` olayı (kurulu app açılışları).
  const mode = getDisplayMode();
  window.gtag("set", "user_properties", { display_mode: mode });
  window.gtag("event", "app_open", { display_mode: mode });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  gaInitialized = true;
  return true;
}

/**
 * GA4 özel olay (event) gönderir. Çerez onayı verilip gtag.js yüklenene kadar
 * sessizce yok sayılır. Ödeme hunisi (view_pricing → select_plan → add_payment_info
 * → purchase) ve terk (checkout_abandoned) olaylarını izlemek için kullanılır.
 *
 * GA4'te: Yönetici → Etkinlikler altında görünür; Keşfet → Huni Keşfi ile
 * adım-adım düşüş (kim hangi adımda vazgeçti) raporlanır.
 */
export function trackGAEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  const id = getGaMeasurementId();
  if (!id || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", name, params ?? {});
}

/**
 * HUNİ OLAYI — hem GA'ya (mevcut davranış DEĞİŞMEZ) hem kendi backend'imize
 * gider. Admin panelindeki "Kullanıcı Yolculuğu" sekmesi, misafirin hangi
 * aracı kullanıp başarılı olduğunu ve üye-ol/ödeme ekranına ne yaptığını GA'ya
 * gitmeden GÖREMİYORDU; bu sarmalayıcı aynı olayı backend'e de (sessionId ile)
 * yazarak oturum bazında okunabilir bir hikaye kurulmasını sağlar.
 *
 * Yalnızca huniyle ilgili çağrı noktalarında (ValueMomentNudge, QuotaMeter,
 * PlanUpgradeModal, PaymentSummaryModal, AuthPage, App.tsx ödeme akışı)
 * `trackGAEvent` yerine kullanılır — GA'ya giden diğer olaylar (ör.
 * `tool_result_ready`, `pwa_installed`) bu ekranla ilgisiz, değiştirilmedi.
 */
export function trackFunnelEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  trackGAEvent(name, params);
  const toolId = typeof params?.source === "string" ? params.source : undefined;
  const extra: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "source" || value === undefined) continue;
    extra[key] = value;
  }
  trackJourneyEvent({ name, toolId, extra: Object.keys(extra).length ? extra : undefined });
}

/**
 * SPA rota / sorgu değişiminde sayfa görüntülemesi gönderir.
 *
 * ÖNEMLİ İKİ DÜZELTME:
 *  • Artık her geçişte yeniden YAPILANDIRMA yapılmıyor. Eskiden her sayfa
 *    değişiminde ölçüm aracı baştan kuruluyordu; bu, oturum ve kaynak
 *    bilgisinin bozulmasına yol açabiliyordu. Doğrusu, tek seferlik
 *    yapılandırmadan sonra yalnızca "sayfa görüntülendi" olayı göndermektir.
 *  • Sayfa kimliği olarak kısa yol yerine TAM ADRES gönderiliyor. Ölçüm aracı
 *    kampanya bilgisini adresin tamamından okur; kısa yol verildiğinde bu
 *    bilgi kaybolur.
 */
export function trackGAPageView(pagePath: string, pageTitle?: string): void {
  const id = getGaMeasurementId();
  if (!id || typeof window.gtag !== "function") {
    return;
  }
  // Giriş sayfası ilk yapılandırmada zaten sayıldı — çift saymayı önle.
  if (firstPageViewSent) {
    firstPageViewSent = false;
    return;
  }
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  const payload: Record<string, string> = {
    page_location:
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path,
  };
  if (pageTitle?.trim()) {
    payload.page_title = pageTitle.trim();
  }
  window.gtag("event", "page_view", payload);
}
