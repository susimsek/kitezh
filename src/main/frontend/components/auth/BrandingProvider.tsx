"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import "@/lib/desktop-api";

export type BrandingSettings = {
  applicationName: string;
  logoPath: string;
  faviconPath: string;
  appleTouchIconPath: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
};

const DEFAULT_BRANDING: BrandingSettings = {
  applicationName: "",
  logoPath: "/brand/logo.svg",
  faviconPath: "/favicon.ico",
  appleTouchIconPath: "/apple-icon.png",
  primaryColor: "#0d6efd",
  accentColor: "#0b2b69",
  backgroundColor: "#f8f9fa",
};

const LIGHT_FAVICON_PATH = "/brand/favicon-light.png";
const DARK_FAVICON_PATH = "/brand/favicon-dark.png";
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const BrandingContext = createContext<BrandingSettings>(DEFAULT_BRANDING);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const load = useCallback(() => {
    void fetch("/api/auth/branding", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: BrandingSettings | null) => {
        if (
          value?.applicationName &&
          HEX_COLOR_PATTERN.test(value.primaryColor) &&
          HEX_COLOR_PATTERN.test(value.accentColor) &&
          HEX_COLOR_PATTERN.test(value.backgroundColor)
        ) {
          setBranding(value);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("branding-updated", load);
    return () => window.removeEventListener("branding-updated", load);
  }, [load]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--console-brand-primary", branding.primaryColor);
    root.style.setProperty("--console-brand-accent", branding.accentColor);
    root.style.setProperty("--console-brand-background", branding.backgroundColor);
  }, [branding]);

  useEffect(() => {
    const root = document.documentElement;
    const updateFavicon = () => {
      const dark = root.getAttribute("data-bs-theme") === "dark";
      let favicon = document.querySelector<HTMLLinkElement>("link[data-branding-favicon]");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.dataset.brandingFavicon = "true";
        document.head.append(favicon);
      }
      favicon.type = "image/png";
      favicon.href = dark ? DARK_FAVICON_PATH : LIGHT_FAVICON_PATH;
    };
    const observer = new MutationObserver(updateFavicon);
    updateFavicon();
    observer.observe(root, { attributes: true, attributeFilter: ["data-bs-theme"] });
    return () => observer.disconnect();
  }, []);

  const value = useMemo(() => branding, [branding]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
