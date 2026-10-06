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
import { DesktopUpdateControl } from "@/components/shared/DesktopUpdateControl";
import { useBranding } from "@/components/auth/BrandingProvider";
import { Icon, type IconName } from "@/components/shared/Icon";
import { isDesktopRuntime } from "@/lib/desktop-api";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { useAdminAuth } from "./AdminAuthProvider";
import { AdminGlobalSearch } from "./AdminGlobalSearch";

type Props = {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
};

export function AdminShell({ locale, dictionary, children }: Props) {
  const pathname = usePathname();
  const branding = useBranding();
  const { access, accessToken, idTokenParsed, logout, tokenParsed, username } = useAdminAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const items: ReadonlyArray<readonly [string, string, IconName, boolean | undefined]> = [
    ["", dictionary.admin.nav.dashboard, "gaugeHigh", access?.isAdmin],
    [
      "/clients",
      dictionary.admin.nav.clients,
      "addressCard",
      access?.queryClients || access?.viewClients,
    ],
    [
      "/client-scopes",
      dictionary.admin.nav.clientScopes,
      "layerGroup",
      access?.queryClients || access?.viewClients,
    ],
    ["/identity-providers", dictionary.admin.nav.identityProviders, "globe", access?.isAdmin],
    ["/users", dictionary.admin.nav.users, "users", access?.queryUsers || access?.viewUsers],
    ["/roles", dictionary.admin.nav.roles, "userShield", access?.viewRoles],
    [
      "/groups",
      dictionary.admin.nav.groups,
      "layerGroup",
      access?.queryGroups || access?.viewGroups || access?.viewUsers,
    ],
    ["/sessions", dictionary.admin.nav.sessions, "laptop", access?.viewSessions],
    ["/offline-sessions", dictionary.admin.nav.offlineSessions, "clock", access?.viewConsents],
    ["/consents", dictionary.admin.nav.consents, "shieldHalved", access?.viewConsents],
    ["/keys", dictionary.admin.nav.keys, "key", access?.viewKeys],
    ["/events", dictionary.admin.nav.events, "clockRotateLeft", access?.viewEvents],
    ["/server-info", dictionary.admin.nav.serverInfo, "circleInfo", access?.viewKeys],
    ["/authentication", dictionary.admin.nav.authentication, "userShield", access?.isAdmin],
    ["/settings", dictionary.admin.nav.settings, "sliders", access?.isAdmin || access?.viewEvents],
  ];

  return (
    <ConsoleAlertsProvider>
      <div className="admin-app min-vh-100 bg-body-tertiary">
        <Navbar className="admin-navbar bg-body border-bottom" sticky="top">
          <Container fluid className="admin-navbar-inner px-3 px-lg-4">
            <div className="d-flex align-items-center min-w-0">
              <Button
                variant="link"
                className="admin-menu-toggle d-lg-none me-2"
                aria-label={dictionary.admin.common.toggleNavigation}
                aria-expanded={navigationOpen}
                onClick={() => setNavigationOpen((current) => !current)}
              >
                <Icon icon={navigationOpen ? "xmark" : "bars"} />
              </Button>
              <Navbar.Brand
                as={Link}
                href={`/admin`}
                className="admin-brand d-flex align-items-center gap-2 fw-semibold mb-0"
              >
                <span className="admin-brand-mark">
                  <BrandLogo size={36} />
                </span>
                <span className="admin-brand-copy text-truncate">
                  {branding.applicationName || dictionary.admin.product}
                </span>
              </Navbar.Brand>
            </div>

            <AdminGlobalSearch dictionary={dictionary} />

            <div className="admin-navbar-actions d-flex align-items-center gap-2">
              {!isDesktopRuntime() && (
                <>
                  <LanguageSwitcher
                    locale={locale}
                    label={dictionary.navbar.language}
                    accessToken={accessToken}
                  />
                  <ThemeSwitcher dictionary={dictionary} />
                </>
              )}
              <DesktopUpdateControl />
              <ConsoleUserMenu
                username={username ?? "…"}
                avatarSrc={idTokenParsed?.picture ?? tokenParsed?.picture}
                accountHref={`/account/personal-info`}
                accountLabel={dictionary.account.product}
                logoutLabel={dictionary.admin.common.logout}
                signedInAsLabel={dictionary.admin.common.signedInAs}
                onLogout={() => logout(locale)}
              />
            </div>
          </Container>
        </Navbar>

        <div className="admin-layout">
          {navigationOpen && (
            <button
              type="button"
              className="admin-sidebar-backdrop d-lg-none"
              aria-label={dictionary.admin.common.closeNavigation}
              onClick={() => setNavigationOpen(false)}
            />
          )}
          <aside className={`admin-sidebar bg-body border-end${navigationOpen ? " is-open" : ""}`}>
            <div className="admin-sidebar-header px-3 pt-4 pb-2">
              <div className="admin-sidebar-label small text-body-secondary text-uppercase fw-semibold">
                {dictionary.admin.manage}
              </div>
            </div>
            <Nav className="flex-column px-2 gap-1">
              {items
                .filter(([, , , allowed]) => allowed)
                .map(([suffix, label, icon]) => {
                  const href = `/admin${suffix}`;
                  const active =
                    suffix === ""
                      ? pathname === href || pathname === `${href}/`
                      : pathname.startsWith(href);

                  return (
                    <Nav.Link
                      key={href}
                      as={Link}
                      href={href}
                      active={active}
                      className="admin-nav-link rounded-2"
                      onClick={() => setNavigationOpen(false)}
                    >
                      <span className="admin-nav-icon-wrap">
                        <Icon icon={icon} className="admin-nav-icon" />
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
