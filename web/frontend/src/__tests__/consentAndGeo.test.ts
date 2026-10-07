import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ONAY KAPISI VE ÜÇÜNCÜ TARAF YOK.
 *  1. Analitik onayı yoksa yolculuk olayı/sayfa görüntüleme sunucuya GİTMEZ ve cihaza oturum kimliği yazılmaz.
 *  2. Onay varsa gider.
 *  3. Ülke tespiti yalnızca kendi alan adımızdaki Cloudflare ucundan okunur; ipwho.is / ipapi.co'ya istek ATILMAZ.
 */

const CONSENT_KEY = "nbpdf-cookie-consent-v3";
const SESSION_KEY = "nbpdf-analytics-session-id";

function setConsent(analytics: boolean | null) {
  if (analytics === null) return;
  window.localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ decided: true, necessary: true, analytics, errorMonitoring: false, paymentProcessing: true, marketing: false }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "loc=TR\n", json: async () => ({}) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("yolculuk ölçümü onay kapısı", () => {
  it("karar verilmemişse hiçbir şey göndermez ve oturum kimliği yazmaz", async () => {
    const { trackJourneyEvent } = await import("../api/analytics");
    trackJourneyEvent({ name: "sign_up_cta_shown" });
    expect(fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("analitik reddedilmişse göndermez", async () => {
    setConsent(false);
    const { trackJourneyEvent } = await import("../api/analytics");
    trackJourneyEvent({ name: "sign_up_cta_shown" });
    expect(fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("analitik onaylanmışsa gönderir", async () => {
    setConsent(true);
    const { trackJourneyEvent } = await import("../api/analytics");
    trackJourneyEvent({ name: "sign_up_cta_shown" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sayfa görüntüleme de onaysız gitmez", async () => {
    const { trackPageView } = await import("../api/analytics");
    await trackPageView({ view: "landing", path: "/", language: "tr" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ülke tespiti", () => {
  it("yalnızca kendi alan adımızdaki Cloudflare ucunu kullanır", async () => {
    const { getCountryCode } = await import("../lib/geoCountry");
    expect(await getCountryCode()).toBe("TR");
    const urls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes("/cdn-cgi/trace"))).toBe(true);
    expect(urls.join(" ")).not.toMatch(/ipwho\.is|ipapi\.co/);
  });

  it("uç yoksa null döner ve başka servise gitmez", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    const { getCountryCode } = await import("../lib/geoCountry");
    expect(await getCountryCode()).toBeNull();
    const urls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(1);
  });

  it("bilinmeyen ülke kodlarını (XX, T1) yok sayar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "ip=1.2.3.4\nloc=XX\n" })));
    const { getCountryCode } = await import("../lib/geoCountry");
    expect(await getCountryCode()).toBeNull();
  });
});
