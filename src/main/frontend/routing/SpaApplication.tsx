"use client";

import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { ClientI18nProvider } from "@/i18n/client";
import { DesktopConnectivityBanner } from "@/components/shared/DesktopConnectivityBanner";
import { DesktopUpdateBanner } from "@/components/shared/DesktopUpdateBanner";
import { isDesktopRuntime } from "@/lib/desktop-api";
import { AppRoutes } from "./AppRoutes";

export default function SpaApplication() {
  return (
    <ClientI18nProvider>
      <BrowserRouter>
        <DesktopMenuLogoutHandler />
        <DesktopConnectivityBanner />
        <DesktopUpdateBanner />
        <AppRoutes />
      </BrowserRouter>
    </ClientI18nProvider>
  );
}

function DesktopMenuLogoutHandler() {
  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    return window.desktopApi.onMenuLogout(() => {
      void window.desktopApi!.auth.clearAllSessions().finally(() => {
        window.location.replace("/login?logout");
      });
    });
  }, []);

  return null;
}
