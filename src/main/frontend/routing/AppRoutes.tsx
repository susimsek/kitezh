"use client";

import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { useRouter, useSearchParams } from "@/routing/navigation";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminAuthorizationCallback } from "@/components/admin/AdminAuthorizationCallback";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminResources } from "@/components/admin/AdminResources";
import AdminOfflineSessions from "@/components/admin/AdminOfflineSessions";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { ClientForm } from "@/components/admin/ClientForm";
import { ClientEntityRoute } from "@/components/admin/ClientEntityRoute";
import { UserForm } from "@/components/admin/UserForm";
import { UserEntityRoute } from "@/components/admin/UserEntityRoute";
import { GroupsTable } from "@/components/admin/GroupsTable";
import { GroupCreateForm } from "@/components/admin/GroupCreateForm";
import { GroupDetail } from "@/components/admin/GroupDetail";
import { GroupEntityRoute } from "@/components/admin/GroupEntityRoute";
import { RolesTable } from "@/components/admin/RolesTable";
import { RoleCreateForm } from "@/components/admin/RoleCreateForm";
import { RoleEntityRoute } from "@/components/admin/RoleEntityRoute";
import { ConsentDetail } from "@/components/admin/ConsentDetail";
import { ClientScopesTable } from "@/components/admin/ClientScopesTable";
import { ClientScopeCreateForm } from "@/components/admin/ClientScopeCreateForm";
import { ClientScopeDetail } from "@/components/admin/ClientScopeDetail";
import { IdentityProvidersTable } from "@/components/admin/IdentityProvidersTable";
import { IdentityProviderForm } from "@/components/admin/IdentityProviderForm";
import { IdentityProviderDetail } from "@/components/admin/IdentityProviderDetail";
import { AccountAuthProvider, useAccountAuth } from "@/components/account/AccountAuthProvider";
import { AccountAuthGuard } from "@/components/account/AccountAuthGuard";
import { AccountShell } from "@/components/account/AccountShell";
import { AccountAuthorizationCallback } from "@/components/account/AccountAuthorizationCallback";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountBreadcrumb } from "@/components/account/AccountBreadcrumb";
import { AccountProfileForm } from "@/components/account/AccountProfileForm";
import { AccountPasswordForm } from "@/components/account/AccountPasswordForm";
import { MfaSettings } from "@/components/account/MfaSettings";
import { PasskeySettings } from "@/components/account/PasskeySettings";
import { AccountSessions } from "@/components/account/AccountSessions";
import { AccountApplications } from "@/components/account/AccountApplications";
import { AccountDeleteForm } from "@/components/account/AccountDeleteForm";
import { SocialAccountLinks } from "@/components/account/SocialAccountLinks";
import { CibaApprovalPanel } from "@/components/account/CibaApprovalPanel";
import { UserProfileAttributeForm } from "@/components/admin/UserProfileAttributeForm";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthNavbar } from "@/components/auth/AuthNavbar";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegistrationForm } from "@/components/auth/RegistrationForm";
import { ConsentForm } from "@/components/auth/ConsentForm";
import { RequiredActionsPage } from "@/components/auth/RequiredActionsPage";
import { ErrorView } from "@/components/auth/ErrorView";
import { NotFoundView } from "@/components/auth/NotFoundView";
import { MfaChallengePage } from "@/components/auth/MfaChallengePage";
import { DownloadPage } from "@/components/download/DownloadPage";
import { HomePage } from "@/components/home/HomePage";
import { DesktopConsoleChooser } from "@/components/shared/DesktopConsoleChooser";
import { isDesktopRuntime } from "@/lib/desktop-api";
import AdminEvents from "@/components/admin/AdminEvents";
import ServerInfo from "@/components/admin/ServerInfo";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminAuthentication from "@/components/admin/AdminAuthentication";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
  VerifyEmailView,
} from "@/components/auth/AccountActionForms";

function AdminLayout() {
  const locale = useLocale();
  const dictionary = useDictionary();
  return (
    <AdminAuthProvider>
      <AdminAuthGuard locale={locale} callbackContent={<Outlet />}>
        <AdminShell locale={locale} dictionary={dictionary}>
          <Outlet />
        </AdminShell>
      </AdminAuthGuard>
    </AdminAuthProvider>
  );
}

function AccountLayout() {
  const locale = useLocale();
  const dictionary = useDictionary();
  return (
    <AccountAuthProvider>
      <AccountImpersonationReset>
        <AccountAuthGuard locale={locale} callbackContent={<Outlet />}>
          <AccountShell locale={locale} dictionary={dictionary}>
            <Outlet />
          </AccountShell>
        </AccountAuthGuard>
      </AccountImpersonationReset>
    </AccountAuthProvider>
  );
}

function AccountImpersonationReset({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const impersonated = searchParams.get("impersonated") === "1";
  const router = useRouter();
  const { clearLocalSession } = useAccountAuth();

  useEffect(() => {
    if (!impersonated) return;
    clearLocalSession();
    router.replace(window.location.pathname);
  }, [clearLocalSession, impersonated, router]);

  if (impersonated)
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  return children;
}

function PublicLayout() {
  return (
    <AuthLayout locale={useLocale()} dictionary={useDictionary()}>
      <Outlet />
    </AuthLayout>
  );
}

function DownloadLayout() {
  return (
    <div className="auth-app min-vh-100 bg-body-tertiary">
      <AuthNavbar locale={useLocale()} dictionary={useDictionary()} showDownload />
      <Outlet />
    </div>
  );
}

function LandingLayout() {
  const desktopRuntime = isDesktopRuntime();
  return (
    <div className="auth-app min-vh-100 bg-body-tertiary">
      <AuthNavbar
        locale={useLocale()}
        dictionary={useDictionary()}
        showDownload={!desktopRuntime}
      />
      <Outlet />
    </div>
  );
}

function EntityDetail({ entity }: { entity: "group" | "consent" | "client-scope" }) {
  const { id = "" } = useParams();
  const props = { locale: useLocale(), dictionary: useDictionary() };
  if (entity === "group") return <GroupDetail key={id} {...props} id={id} />;
  if (entity === "client-scope") return <ClientScopeDetail key={id} {...props} id={id} />;
  return <ConsentDetail key={id} {...props} routeKey={id} />;
}

function UserProfileEditPage() {
  const dictionary = useDictionary();
  const { id = "" } = useParams<{ id: string }>();
  return (
    <>
      <AdminPageHeader
        title={dictionary.admin.userProfileSettings.editTitle}
        description={dictionary.admin.userProfileSettings.editSubtitle}
      />
      <UserProfileAttributeForm dictionary={dictionary} id={id} />
    </>
  );
}

function AccountPage({
  section,
}: {
  section: "profile" | "security" | "sessions" | "applications";
}) {
  const d = useDictionary();
  const copy = d.account[section];
  return (
    <div className="d-grid gap-4">
      <AccountBreadcrumb homeLabel={d.account.manage} current={copy.title} />
      <AccountPageHeader title={copy.title} description={copy.subtitle} />
      {section === "profile" && (
        <>
          <AccountProfileForm dictionary={d} />
          <AccountDeleteForm dictionary={d} />
        </>
      )}
      {section === "security" && (
        <>
          <AccountPasswordForm dictionary={d} />
          <SocialAccountLinks dictionary={d} />
          <CibaApprovalPanel dictionary={d} />
          <MfaSettings dictionary={d} />
          <PasskeySettings dictionary={d} />
        </>
      )}
      {section === "sessions" && <AccountSessions dictionary={d} />}
      {section === "applications" && <AccountApplications dictionary={d} />}
    </div>
  );
}

function IdentityProviderRoute({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const { id = "", section } = useParams<{ id: string; section: string }>();
  const tab = section === "mappers" ? "mappers" : "details";
  return (
    <IdentityProviderDetail
      key={`${id}-${tab}`}
      dictionary={dictionary}
      locale={locale}
      id={id}
      tab={tab}
    />
  );
}

export function AppRoutes() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const props = { dictionary, locale };
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route
          index
          element={
            isDesktopRuntime() ? (
              <DesktopConsoleChooser dictionary={dictionary} />
            ) : (
              <HomePage dictionary={dictionary} />
            )
          }
        />
      </Route>
      <Route element={<DownloadLayout />}>
        <Route path="download" element={<DownloadPage dictionary={dictionary} />} />
      </Route>
      <Route element={<PublicLayout />}>
        <Route
          path="login"
          element={
            isDesktopRuntime() ? (
              <DesktopConsoleChooser dictionary={dictionary} />
            ) : (
              <LoginForm {...props} />
            )
          }
        />
        <Route path="register" element={<RegistrationForm dictionary={dictionary} />} />
        <Route path="consent" element={<ConsentForm dictionary={dictionary} />} />
        <Route path="required-actions" element={<RequiredActionsPage dictionary={dictionary} />} />
        <Route path="mfa" element={<MfaChallengePage dictionary={dictionary} />} />
        <Route path="auth-error" element={<ErrorView dictionary={dictionary} />} />
        <Route path="forgot-password" element={<ForgotPasswordForm {...props} />} />
        <Route path="reset-password" element={<ResetPasswordForm {...props} />} />
        <Route path="verify-email" element={<VerifyEmailView {...props} />} />
        <Route path="confirm-email" element={<VerifyEmailView {...props} />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route
          index
          element={
            <>
              <AdminPageHeader
                title={dictionary.admin.dashboard.title}
                description={dictionary.admin.dashboard.subtitle}
              />
              <AdminDashboard dictionary={dictionary} />
            </>
          }
        />
        <Route path="callback" element={<AdminAuthorizationCallback />} />
        <Route path="clients" element={<ClientsTable {...props} />} />
        <Route
          path="clients/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  { label: dictionary.admin.clients.title, href: "/admin/clients" },
                  { label: dictionary.admin.clients.createTitle },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.clients.createTitle}
                description={dictionary.admin.clients.createSubtitle}
              />
              <ClientForm {...props} mode="create" />
            </>
          }
        />
        <Route path="clients/:id/:section?" element={<ClientEntityRoute {...props} />} />
        <Route
          path="users"
          element={
            <AdminResources resource="users" copy={dictionary.admin.resources} locale={locale} />
          }
        />
        <Route
          path="users/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  { label: dictionary.admin.resources.users, href: "/admin/users" },
                  { label: dictionary.admin.resources.createUserTitle },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.resources.createUserTitle}
                description={dictionary.admin.resources.createUserSubtitle}
              />
              <UserForm {...props} />
            </>
          }
        />
        <Route path="users/:id/:section?" element={<UserEntityRoute {...props} />} />
        <Route path="groups" element={<GroupsTable dictionary={dictionary} />} />
        <Route
          path="groups/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  { label: dictionary.admin.groups.title, href: "/admin/groups" },
                  { label: dictionary.admin.groups.create },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.groups.create}
                description={dictionary.admin.groups.help}
              />
              <GroupCreateForm {...props} />
            </>
          }
        />
        <Route path="groups/:id/:section?" element={<GroupEntityRoute {...props} />} />
        <Route path="roles" element={<RolesTable dictionary={dictionary} />} />
        <Route
          path="roles/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  { label: dictionary.admin.roles.title, href: "/admin/roles" },
                  { label: dictionary.admin.roles.create },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.roles.create}
                description={dictionary.admin.roles.help}
              />
              <RoleCreateForm {...props} />
            </>
          }
        />
        <Route path="roles/:id/:section?" element={<RoleEntityRoute {...props} />} />
        <Route
          path="consents"
          element={
            <AdminResources resource="consents" copy={dictionary.admin.resources} locale={locale} />
          }
        />
        <Route path="consents/:id" element={<EntityDetail entity="consent" />} />
        <Route
          path="sessions"
          element={
            <AdminResources resource="sessions" copy={dictionary.admin.resources} locale={locale} />
          }
        />
        <Route path="offline-sessions" element={<AdminOfflineSessions />} />
        <Route
          path="keys"
          element={
            <AdminResources resource="keys" copy={dictionary.admin.resources} locale={locale} />
          }
        />
        <Route
          path="identity-providers"
          element={<IdentityProvidersTable dictionary={dictionary} />}
        />
        <Route
          path="identity-providers/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  {
                    label: dictionary.admin.identityProviders.title,
                    href: "/admin/identity-providers",
                  },
                  { label: dictionary.admin.identityProviders.createTitle },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.identityProviders.createTitle}
                description={dictionary.admin.identityProviders.createSubtitle}
              />
              <IdentityProviderForm {...props} />
            </>
          }
        />
        <Route
          path="identity-providers/:id/:section?"
          element={<IdentityProviderRoute {...props} />}
        />
        <Route path="client-scopes" element={<ClientScopesTable dictionary={dictionary} />} />
        <Route path="client-scopes/:id" element={<EntityDetail entity="client-scope" />} />
        <Route
          path="client-scopes/new"
          element={
            <>
              <AdminBreadcrumb
                items={[
                  { label: dictionary.admin.clientScopes.title, href: "/admin/client-scopes" },
                  { label: dictionary.admin.clientScopes.create },
                ]}
              />
              <AdminPageHeader
                title={dictionary.admin.clientScopes.create}
                description={dictionary.admin.clientScopes.subtitle}
              />
              <ClientScopeCreateForm {...props} />
            </>
          }
        />
        <Route path="events" element={<AdminEvents />} />
        <Route path="server-info" element={<ServerInfo />} />
        <Route path="authentication" element={<AdminAuthentication />} />
        <Route path="authentication/policies/:policy" element={<AdminAuthentication />} />
        <Route
          path="settings/user-profile/new"
          element={
            <>
              <AdminPageHeader
                title={dictionary.admin.userProfileSettings.createTitle}
                description={dictionary.admin.userProfileSettings.createSubtitle}
              />
              <UserProfileAttributeForm dictionary={dictionary} />
            </>
          }
        />
        <Route path="settings/user-profile/:id" element={<UserProfileEditPage />} />
        <Route path="settings/localization" element={<AdminSettings localization />} />
        <Route
          path="settings/localization/overrides/new"
          element={<AdminSettings localization localizationAction="create" />}
        />
        <Route
          path="settings/localization/:localizationSection"
          element={<AdminSettings localization />}
        />
        <Route
          path="settings/webauthn"
          element={<Navigate to="/admin/authentication/policies/webauthn" replace />}
        />
        <Route
          path="settings/password-policy"
          element={<Navigate to="/admin/authentication/policies/password-policy" replace />}
        />
        <Route
          path="settings/otp-policy"
          element={<Navigate to="/admin/authentication/policies/otp-policy" replace />}
        />
        <Route path="settings/:section?" element={<AdminSettings />} />
      </Route>
      <Route path="account" element={<AccountLayout />}>
        <Route index element={<Navigate to="personal-info" replace />} />
        <Route path="callback" element={<AccountAuthorizationCallback />} />
        <Route path="personal-info" element={<AccountPage section="profile" />} />
        <Route path="security" element={<AccountPage section="security" />} />
        <Route path="sessions" element={<AccountPage section="sessions" />} />
        <Route path="applications" element={<AccountPage section="applications" />} />
      </Route>
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundView />} />
      </Route>
    </Routes>
  );
}
