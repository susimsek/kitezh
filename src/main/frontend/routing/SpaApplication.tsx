"use client";

import { BrowserRouter } from "react-router-dom";
import { ClientI18nProvider } from "@/i18n/client";
import { DesktopConnectivityBanner } from "@/components/shared/DesktopConnectivityBanner";
import "@/lib/desktop-api";
import { AppRoutes } from "./AppRoutes";

export default function SpaApplication() {
  return (
    <ClientI18nProvider>
      <BrowserRouter>
        <DesktopConnectivityBanner />
        <AppRoutes />
      </BrowserRouter>
    </ClientI18nProvider>
  );
}
