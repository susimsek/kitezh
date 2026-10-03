"use client";

import { Container, Navbar } from "react-bootstrap";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "./BrandingProvider";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

type AuthNavbarProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function AuthNavbar({ locale, dictionary }: AuthNavbarProps) {
  const branding = useBranding();
  return (
    <Navbar className="auth-navbar bg-body border-bottom">
      <Container className="auth-navbar-inner">
        <Navbar.Brand
          href={`/login`}
          className="auth-brand d-flex align-items-center gap-2 fw-semibold"
        >
          <BrandLogo size={36} />
          <span className="auth-brand-copy text-truncate">
            {branding.applicationName || dictionary.brand.product}
          </span>
        </Navbar.Brand>

        <div className="auth-navbar-actions d-flex align-items-center gap-2">
          <LanguageSwitcher locale={locale} label={dictionary.navbar.language} />
          <ThemeSwitcher dictionary={dictionary} />
        </div>
      </Container>
    </Navbar>
  );
}
