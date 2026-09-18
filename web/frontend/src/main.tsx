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
import { SignDocumentPage } from "./components/tools/SignDocumentPage";
import { TOOL_SLUGS } from "./seo/seoContent.mjs";
import { toolSlugToTr } from "./seo/enSlugs.mjs";
import "./styles/app.css";

// Belge dilini kullanıcı konumu ve tercihine göre ayarlar.
// Geolokasyon paylaşılan, önbellekli `getCountryCode` ile yapılır (CheckoutCurrency ile tek istek paylaşılır).
async function setDocumentLanguage() {
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

if (imzaToken) {
  kok.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <SignDocumentPage token={imzaToken} />
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
} else if (taninmayanAracAdresiMi()) {
  const dil = document.documentElement.lang === "en" ? "en" : "tr";
  kok.render(
    <React.StrictMode>
      <NotFoundPage
        language={dil}
        onGoHome={() => {
          window.location.href = "/";
        }}
      />
    </React.StrictMode>,
  );
} else {
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
}
