"use client";

import { Container, Navbar } from "react-bootstrap";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { DesktopUpdateControl } from "@/components/shared/DesktopUpdateControl";
import { ActionIcon } from "@/components/shared/ActionIcon";
import Link from "@/routing/Link";
import { useBranding } from "./BrandingProvider";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

type AuthNavbarProps = {
  locale: Locale;
  dictionary: Dictionary;
  showDownload?: boolean;
};

export function AuthNavbar({ locale, dictionary, showDownload = false }: AuthNavbarProps) {
  const branding = useBranding();
  return (
    <Navbar className="auth-navbar bg-body border-bottom">
      <Container className="auth-navbar-inner">
        <Navbar.Brand
          as={Link}
          href="/"
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
          {showDownload && (
            <Link
              href="/download"
              className="btn btn-primary btn-sm"
              aria-label={dictionary.navbar.download}
            >
              <ActionIcon action="download" />
              <span className="d-none d-md-inline">{dictionary.navbar.download}</span>
            </Link>
          )}
          <DesktopUpdateControl />
        </div>
      </Container>
    </Navbar>
  );
}
