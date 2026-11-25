import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BackToTopButton } from "./components/common/BackToTopButton";
import { PwaPrompts } from "./components/common/PwaPrompts";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary";
import { SettingsProvider } from "./contexts/SettingsContext";
import { installProductionGuards, installChunkReloadGuard } from "./lib/productionGuards";
import { getCountryCode } from "./lib/geoCountry";
import { NotFoundPage } from "./components/common/NotFoundPage";
import { GoogleSignupPage } from "./components/auth/GoogleSignupPage";
import { TOOL_SLUGS } from "./seo/seoLight.mjs";
import { isLandingPath, loadToolSeo } from "./seo/toolSeoRuntime";
import { toolSlugToTr } from "./seo/enSlugs.mjs";
import { getExplicitLanguage, isEnglishPath, isPublicSeoPath } from "./hooks/usePreferredLanguage";
import { getSaasApiBase } from "./api/saasBase";
import { isKnownAppPath } from "./lib/appNavigation";
import "./styles/app.css";

// İmza sayfası yalnız imza bağlantısında gerekir; yasal metinleri (~100 KB) ana sayfaya yüklememek için tembel.
const SignDocumentPage = React.lazy(() =>
  import("./components/tools/SignDocumentPage").then((m) => ({ default: m.SignDocumentPage })),
);

// PayTR ödeme sayfası iframe içinde açılır; ödeme bitince PayTR bizim dönüş adresimizi (/workspace?payment=...)
// aynı iframe'in İÇİNDE yükler. Uygulama iframe içinde kalmasın diye üst pencereyi o adrese götür.
try {
  if (window.top && window.top !== window.self && /[?&]payment=(success|failed)/.test(window.location.search)) {
    window.top.location.replace(window.location.href);
  }
} catch {
  /* üst pencereye erişilemezse normal çalış */
}
import "./styles/readability.css";
import "./styles/theme-light.css";

// Eski e-postalardaki doğrulama bağlantısı SPA'nın kendi alanına (/api/auth/verify-email) düşüyordu
// ve ana sayfaya atıyordu. API adresi biliniyorsa isteği API'ye ilet; API doğrular ve
// kullanıcıyı giriş ekranına "e-posta doğrulandı" bildirimiyle döndürür.
if (window.location.pathname === "/api/auth/verify-email") {
  const apiBase = getSaasApiBase();
  if (apiBase && !apiBase.startsWith(window.location.origin)) {
    window.location.replace(`${apiBase}/api/auth/verify-email${window.location.search}`);
  }
}

// Belge dilini kullanıcı konumu ve tercihine göre ayarlar.
// Geolokasyon paylaşılan, önbellekli `getCountryCode` ile yapılır (CheckoutCurrency ile tek istek paylaşılır).
async function setDocumentLanguage() {
  // Herkese açık SEO sayfasında dil URL'den gelir (Google en-US ile işler; IP/tarayıcı dili
  // Türkçe sayfayı İngilizce etiketlememeli). Elle seçim yoksa: /en → en, öneksiz → tr.
  if (isPublicSeoPath(window.location.pathname)) {
    document.documentElement.lang = isEnglishPath(window.location.pathname)
      ? "en"
      : (getExplicitLanguage() ?? "tr");
    return;
  }

  const storedLang = localStorage.getItem("nbpdf-language");

  // Kullanıcının kayıtlı tercihi varsa onu kullan (ağ beklemeden).
  if (storedLang === "tr" || storedLang === "en") {
    document.documentElement.lang = storedLang;
    return;
  }

  // Önce hızlı tarayıcı sinyaliyle başla; IP gelince gerekirse düzelt.
  const browserLang = navigator.language.toLowerCase();
  document.documentElement.lang = browserLang.startsWith("tr") ? "tr" : "en";

  try {
    const cc = await getCountryCode();
    if (cc === "TR") {
      document.documentElement.lang = "tr";
    } else if (cc) {
      document.documentElement.lang = "en";
    }
  } catch {
    // IP araması başarısız → tarayıcı dili zaten ayarlı.
  }
}

// Kritik render yolundan çıkar: ilk boyamayı bloklamasın.
void setDocumentLanguage();

installProductionGuards();
installChunkReloadGuard();

if (import.meta.env.VITE_BLOCK_SEARCH_INDEXING === "true") {
  const tag = document.querySelector('meta[name="robots"]');
  if (!tag) {
    const m = document.createElement("meta");
    m.setAttribute("name", "robots");
    m.setAttribute("content", "noindex, nofollow");
    document.head.appendChild(m);
  }
}

/**
 * Tanınmayan bir araç adresi mi? (ör. /tools/olmayan-sey)
 *
 * NEDEN BURADA, UYGULAMANIN İÇİNDE DEĞİL: Uygulama bilmediği bir araç
 * adresinde seçili aracı varsayılana düşürüp adresi ana sayfaya taşıyor; bu
 * yüzden uygulamanın içine konan "sayfa bulunamadı" ekranı hiç görünmüyordu
 * (canlıda ölçüldü: kullanıcı ana sayfaya düşüyordu). Karar uygulama mount
 * edilmeden, tek bakışta burada veriliyor.
 */
function taninmayanAracAdresiMi(): boolean {
  const yol = window.location.pathname.replace(/\/+$/, "");
  const m = /^(?:\/en)?\/tools\/([^/]+)$/.exec(yol);
  if (!m) return false;
  const slug = toolSlugToTr(m[1] ?? "");
  return Boolean(slug) && !TOOL_SLUGS.includes(slug);
}

/**
 * İmza bağlantısı (/imzala/<anahtar>) — imzalayacak kişinin hesabı YOKTUR.
 *
 * Uygulamanın tamamını (oturum, çalışma alanı, araç kataloğu) yüklemek yerine
 * yalnız imza sayfası açılır: karşı taraf çoğu zaman telefonundan, tek seferlik
 * bir iş için giriyor; onu ürün arayüzüyle karşılamak gereksiz.
 */
function imzaAnahtari(): string | null {
  const m = /^\/imzala\/([A-Za-z0-9_-]{16,})\/?$/.exec(window.location.pathname);
  return m?.[1] ?? null;
}

const kok = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
const imzaToken = imzaAnahtari();
const googleKayitSayfasi = window.location.pathname.replace(/\/+$/, "") === "/google-signup";

if (googleKayitSayfasi) {
  kok.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <GoogleSignupPage />
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
} else if (imzaToken) {
  kok.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <React.Suspense fallback={null}>
          <SignDocumentPage token={imzaToken} />
        </React.Suspense>
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
} else if (taninmayanAracAdresiMi() || !isKnownAppPath(window.location.pathname)) {
  const dil = isEnglishPath(window.location.pathname) || document.documentElement.lang === "en" ? "en" : "tr";
  kok.render(
    <React.StrictMode>
      <NotFoundPage
        kind={taninmayanAracAdresiMi() ? "tool" : "page"}
        language={dil}
        onGoHome={() => {
          window.location.href = "/";
        }}
      />
    </React.StrictMode>,
  );
} else {
  const uygulamayiCiz = () =>
    kok.render(
      <React.StrictMode>
        <GlobalErrorBoundary>
          <BrowserRouter>
            <SettingsProvider>
              <App />
              <BackToTopButton />
              <PwaPrompts />
            </SettingsProvider>
          </BrowserRouter>
        </GlobalErrorBoundary>
      </React.StrictMode>,
    );

  if (isLandingPath(window.location.pathname)) {
    // Ana sayfa: ağır araç metinleri açılışı geciktirmesin; çizimden sonra arka planda, ya da ziyaretçi
    // ilk etkileşimi yaptığında (hangisi önce) indirilir.
    uygulamayiCiz();
    const arkaPlandaYukle = () => void loadToolSeo().catch(() => undefined);
    window.addEventListener("load", () => window.setTimeout(arkaPlandaYukle, 800), { once: true });
    for (const olay of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(olay, arkaPlandaYukle, { once: true, passive: true, capture: true });
    }
  } else {
    // Araç sayfası / çalışma alanı: "bu araç var mı" kontrolleri boş veriyle çalışmasın diye önce veri gelir.
    // Hazır HTML (ön-çizim) bu sırada görünmeye devam eder. İndirme başarısız olsa bile uygulama açılır.
    void loadToolSeo()
      .catch(() => undefined)
      .then(uygulamayiCiz);
  }
}
