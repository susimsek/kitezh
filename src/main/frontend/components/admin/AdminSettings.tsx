"use client";

import { useEffect, useState } from "react";
import { Alert, Card } from "react-bootstrap";

import { useParams } from "@/routing/navigation";
import { useDictionary } from "@/i18n/client";
import { adminRequest } from "@/lib/admin-api";

import { AdminPageHeader } from "./AdminPageHeader";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { useAdminAuth } from "./AdminAuthProvider";
import AdminEventSettings from "./AdminEventSettings";
import AdminUserProfileSettings from "./AdminUserProfileSettings";
import { DetailTabs } from "./DetailTabs";
import EmailSettings from "./EmailSettings";
import LoginSettings, { type LoginSettingsSection } from "./LoginSettings";
import LdapFederationSettings from "./LdapFederationSettings";
import AdminLocalizationSettings, { type LocalizationSection } from "./AdminLocalizationSettings";
import AdminCibaPolicySettings from "./AdminCibaPolicySettings";
import AdminOfflineAccessSettings from "./AdminOfflineAccessSettings";

const SETTINGS_SECTIONS = [
  "general",
  "login",
  "social-login",
  "user-federation",
  "email",
  "brute-force",
  "sessions",
  "events",
  "ciba-policy",
  "offline-access",
  "user-profile",
  "localization",
] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

type ServerInfo = { issuer: string };

export default function AdminSettings({
  localization = false,
  localizationAction,
}: {
  localization?: boolean;
  localizationAction?: "create";
}) {
  const dictionary = useDictionary();
  const { section: candidate, localizationSection: localizationCandidate } = useParams<{
    section?: string;
    localizationSection?: string;
  }>();
  const { access } = useAdminAuth();
  const availableSections = access?.isAdmin ? SETTINGS_SECTIONS : (["events"] as const);
  const active =
    localization && access?.isAdmin
      ? "localization"
      : availableSections.includes(candidate as never)
        ? (candidate as SettingsSection)
        : availableSections[0];
  const localizationSection: LocalizationSection =
    localizationAction === "create"
      ? "overrides"
      : ["settings", "overrides", "effective"].includes(localizationCandidate ?? "")
        ? (localizationCandidate as LocalizationSection)
        : "settings";
  const allTabs = [
    { key: "general", label: dictionary.admin.settings.sections.general, href: "/admin/settings" },
    {
      key: "login",
      label: dictionary.admin.settings.sections.login,
      href: "/admin/settings/login",
    },
    {
      key: "social-login",
      label: dictionary.admin.settings.sections.socialLogin,
      href: "/admin/settings/social-login",
    },
    {
      key: "user-federation",
      label: dictionary.admin.settings.sections.userFederation,
      href: "/admin/settings/user-federation",
    },
    {
      key: "email",
      label: dictionary.admin.settings.sections.email,
      href: "/admin/settings/email",
    },
    {
      key: "brute-force",
      label: dictionary.admin.settings.sections.bruteForce,
      href: "/admin/settings/brute-force",
    },
    {
      key: "sessions",
      label: dictionary.admin.settings.sections.sessions,
      href: "/admin/settings/sessions",
    },
    {
      key: "events",
      label: dictionary.admin.settings.sections.events,
      href: "/admin/settings/events",
    },
    {
      key: "ciba-policy",
      label: dictionary.admin.settings.sections.cibaPolicy,
      href: "/admin/settings/ciba-policy",
    },
    {
      key: "offline-access",
      label: dictionary.admin.settings.sections.offlineAccess,
      href: "/admin/settings/offline-access",
    },
    {
      key: "user-profile",
      label: dictionary.admin.settings.sections.userProfile,
      href: "/admin/settings/user-profile",
    },
    {
      key: "localization",
      label: dictionary.admin.settings.sections.localization,
      href: "/admin/settings/localization",
    },
  ] satisfies Array<{
    key: SettingsSection;
    label: string;
    href: string;
  }>;
  const tabs = access?.isAdmin ? allTabs : allTabs.filter((tab) => tab.key === "events");
  return (
    <>
      {localizationAction === "create" && (
        <AdminBreadcrumb
          items={[
            {
              label: dictionary.admin.settings.sections.localization,
              href: "/admin/settings/localization",
            },
            {
              label: dictionary.admin.localization.overridesTab,
              href: "/admin/settings/localization/overrides",
            },
            { label: dictionary.admin.localization.create },
          ]}
        />
      )}
      <AdminPageHeader
        title={dictionary.admin.settings.title}
        description={dictionary.admin.settings.subtitle}
      />
      <DetailTabs tabs={tabs} active={active} />
      {active === "general" ? <GeneralSettings /> : null}
      {active === "email" ? <EmailSettings embedded /> : null}
      {active === "events" ? <AdminEventSettings /> : null}
      {active === "ciba-policy" ? <AdminCibaPolicySettings /> : null}
      {active === "offline-access" ? <AdminOfflineAccessSettings /> : null}
      {active === "user-profile" ? <AdminUserProfileSettings dictionary={dictionary} /> : null}
      {active === "localization" ? (
        <AdminLocalizationSettings
          dictionary={dictionary}
          section={localizationSection}
          mode={localizationAction === "create" ? "create" : "list"}
        />
      ) : null}
      {active === "user-federation" ? <LdapFederationSettings /> : null}
      {active !== "general" &&
      active !== "email" &&
      active !== "events" &&
      active !== "ciba-policy" &&
      active !== "offline-access" &&
      active !== "user-profile" &&
      active !== "localization" &&
      active !== "user-federation" ? (
        <LoginSettings embedded focusSection={active as LoginSettingsSection} />
      ) : null}
    </>
  );
}

function GeneralSettings() {
  const dictionary = useDictionary();
  const { accessToken } = useAdminAuth();
  const [issuer, setIssuer] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<ServerInfo>(accessToken, { url: "/api/admin/server-info" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        setIssuer(response.data.issuer);
      })
      .catch(() => setError(true));
  }, [accessToken]);

  return (
    <Card className="admin-panel-card">
      <Card.Body>
        <h2 className="h5 mb-2">{dictionary.admin.settings.generalTitle}</h2>
        <p className="text-body-secondary mb-4">{dictionary.admin.settings.generalDescription}</p>
        {error && <Alert variant="danger">{dictionary.admin.settings.generalError}</Alert>}
        <dl className="row mb-0">
          <dt className="col-sm-4">{dictionary.admin.settings.issuer}</dt>
          <dd className="col-sm-8 font-monospace text-break mb-0">{issuer ?? "—"}</dd>
        </dl>
        <p className="small text-body-secondary mt-4 mb-0">
          {dictionary.admin.settings.generalReadOnly}
        </p>
      </Card.Body>
    </Card>
  );
}
