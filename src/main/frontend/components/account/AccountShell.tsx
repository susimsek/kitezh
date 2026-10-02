"use client";

import Link from "@/routing/Link";
import { usePathname } from "@/routing/navigation";
import { useState } from "react";
import { Button, Container, Nav, Navbar } from "react-bootstrap";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/auth/ThemeSwitcher";
import { ConsoleUserMenu } from "@/components/auth/ConsoleUserMenu";
import { ConsoleAlertsProvider } from "@/components/auth/ConsoleAlerts";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/components/auth/BrandingProvider";
import { Icon, type IconName } from "@/components/shared/Icon";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useAccountAuth } from "./AccountAuthProvider";

export function AccountShell({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const branding = useBranding();
  const { accessToken, idTokenParsed, logout, tokenParsed, username } = useAccountAuth();
  const [open, setOpen] = useState(false);
  const items: ReadonlyArray<readonly [string, string, IconName]> = [
    ["/personal-info", dictionary.account.nav.personalInfo, "addressCard"],
    ["/security", dictionary.account.nav.security, "key"],
    ["/sessions", dictionary.account.nav.sessions, "desktop"],
    ["/applications", dictionary.account.nav.applications, "shieldHalved"],
  ];
  return (
    <ConsoleAlertsProvider>
      <div className="admin-app account-app min-vh-100 bg-body-tertiary">
        <Navbar className="admin-navbar bg-body border-bottom" sticky="top">
          <Container fluid className="admin-navbar-inner px-3 px-lg-4">
            <div className="d-flex align-items-center min-w-0">
              <Button
                variant="link"
                className="admin-menu-toggle d-lg-none me-2"
                aria-label={dictionary.admin.common.toggleNavigation}
                onClick={() => setOpen((v) => !v)}
              >
                <Icon icon={open ? "xmark" : "bars"} />
              </Button>
              <Navbar.Brand
                as={Link}
                href={`/account/personal-info`}
                className="admin-brand d-flex align-items-center gap-2 fw-semibold mb-0"
              >
                <span className="admin-brand-mark">
                  <BrandLogo size={36} />
                </span>
                <span>{branding.applicationName || dictionary.account.product}</span>
              </Navbar.Brand>
            </div>
            <div className="admin-navbar-actions d-flex align-items-center gap-2">
              <LanguageSwitcher
                locale={locale}
                label={dictionary.navbar.language}
                accessToken={accessToken}
              />
              <ThemeSwitcher dictionary={dictionary} />
              <ConsoleUserMenu
                username={username ?? "…"}
                avatarSrc={idTokenParsed?.picture ?? tokenParsed?.picture}
                accountHref={`/account/personal-info`}
                accountLabel={dictionary.account.nav.personalInfo}
                logoutLabel={dictionary.account.logout}
                signedInAsLabel={dictionary.admin.common.signedInAs}
                onLogout={() => logout(locale)}
              />
            </div>
          </Container>
        </Navbar>
        <div className="admin-layout">
          {open && (
            <button
              type="button"
              className="admin-sidebar-backdrop d-lg-none"
              aria-label={dictionary.admin.common.closeNavigation}
              onClick={() => setOpen(false)}
            />
          )}
          <aside
            className={`admin-sidebar account-sidebar bg-body border-end${open ? " is-open" : ""}`}
          >
            <div className="admin-sidebar-header px-3 pt-4 pb-2">
              <div className="admin-sidebar-label small text-body-secondary text-uppercase fw-semibold">
                {dictionary.account.manage}
              </div>
            </div>
            <Nav className="flex-column px-2 gap-1">
              {items.map(([suffix, label, icon]) => {
                const href = `/account${suffix}`;
                const active =
                  pathname.startsWith(href) ||
                  (suffix === "/personal-info" &&
                    (pathname === `/account` || pathname === `/account/`));
                return (
                  <Nav.Link
                    key={href}
                    as={Link}
                    href={href}
                    active={active}
                    className="admin-nav-link rounded-2"
                    onClick={() => setOpen(false)}
                  >
                    <span className="admin-nav-icon-wrap">
                      <Icon icon={icon} />
                    </span>
                    <span>{label}</span>
                  </Nav.Link>
                );
              })}
            </Nav>
            <div className="admin-sidebar-footer mt-auto px-3 py-3 small text-body-secondary">
              OAuth 2.0 · OpenID Connect
            </div>
          </aside>
          <main className="admin-main">
            <div className="admin-main-inner">{children}</div>
          </main>
        </div>
      </div>
    </ConsoleAlertsProvider>
  );
}
