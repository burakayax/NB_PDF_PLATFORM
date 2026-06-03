import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BackToTopButton } from "./components/common/BackToTopButton";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary";
import { SettingsProvider } from "./contexts/SettingsContext";
import { installProductionGuards } from "./lib/productionGuards";
import "react-phone-number-input/style.css";
import "./styles/app.css";

// Set document language based on user location and preference
async function setDocumentLanguage() {
  const storedLang = localStorage.getItem("nbpdf-language");

  // If user has a stored preference, use it
  if (storedLang === "tr" || storedLang === "en") {
    document.documentElement.lang = storedLang;
    return;
  }

  // Try to detect from IP geolocation
  try {
    const response = (await Promise.race([
      fetch("https://ipapi.co/json/"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000))
    ])) as Response;

    if (response.ok) {
      const data = (await response.json()) as { country_code?: string };
      const cc = data.country_code?.trim().toUpperCase();

      if (cc === "TR") {
        document.documentElement.lang = "tr";
        return;
      }
    }
  } catch {
    // IP lookup failed, fall back to browser language
  }

  // Fall back to browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("tr")) {
    document.documentElement.lang = "tr";
  } else {
    document.documentElement.lang = "en";
  }
}

setDocumentLanguage();

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
        </SettingsProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
