import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BackToTopButton } from "./components/common/BackToTopButton";
import { PwaPrompts } from "./components/common/PwaPrompts";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary";
import { SettingsProvider } from "./contexts/SettingsContext";
import { installProductionGuards } from "./lib/productionGuards";
import { getCountryCode } from "./lib/geoCountry";
import "react-phone-number-input/style.css";
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

if (import.meta.env.VITE_BLOCK_SEARCH_INDEXING === "true") {
  const tag = document.querySelector('meta[name="robots"]');
  if (!tag) {
    const m = document.createElement("meta");
    m.setAttribute("name", "robots");
    m.setAttribute("content", "noindex, nofollow");
    document.head.appendChild(m);
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
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
