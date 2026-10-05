"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useBranding } from "@/components/auth/BrandingProvider";

export function BrandLogo({ className, size = 36 }: { className?: string; size?: number }) {
  const branding = useBranding();
  const [darkTheme, setDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDarkTheme(root.getAttribute("data-bs-theme") === "dark");
    const observer = new MutationObserver(update);
    update();
    observer.observe(root, { attributes: true, attributeFilter: ["data-bs-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDefaultLogo =
    branding.logoPath.endsWith("/logo.svg") || branding.logoPath.endsWith("/logo-light.svg");
  const logoPath = isDefaultLogo
    ? darkTheme
      ? "/brand/logo-dark.svg"
      : "/brand/logo-light.svg"
    : branding.logoPath;

  return (
    <Image
      src={logoPath}
      alt=""
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      priority
      unoptimized
    />
  );
}
