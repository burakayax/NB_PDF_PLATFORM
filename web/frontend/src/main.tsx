import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BackToTopButton } from "./components/common/BackToTopButton";
import { SettingsProvider } from "./contexts/SettingsContext";
import { installProductionGuards } from "./lib/productionGuards";
import "react-phone-number-input/style.css";
import "./styles/app.css";

installProductionGuards();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <App />
        <BackToTopButton />
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
