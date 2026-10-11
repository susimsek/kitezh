const boot = globalThis.__KITEZH_NATIVE_BOOTSTRAP__ ?? {};
const api = globalThis.desktopApi;
const messages = boot.messages ?? { en: {}, tr: {} };
const icons = boot.icons ?? {};
const state = {
  locale: boot.locale === "tr" ? "tr" : "en",
  theme: boot.theme === "dark" ? "dark" : "light",
  console:
    new URLSearchParams(location.search).get("console") === "admin"
      ? "admin"
      : "account",
  route: "profile",
  session: null,
  profile: null,
  data: {},
  loading: true,
  busy: null,
  error: null,
  notice: null,
  offline: !navigator.onLine,
  authStarting: false,
  authCanceling: false,
};
const PLATFORM_CONSOLE_CLIENT_IDS = new Set([
  "admin-console",
  "account-console",
  "desktop-admin-console",
  "desktop-account-console",
  "mobile-admin-console",
  "mobile-account-console",
]);

const app = document.getElementById("app");
let authTimeout;
const hasConsoleSelection = () =>
  new URLSearchParams(location.search).has("console");
const text = (key) =>
  messages[state.locale]?.[key] ?? messages.en?.[key] ?? key;
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
function userAvatarSource(user) {
  if (
    typeof boot.apiBaseUrl !== "string" ||
    !/^\/avatars\/[A-Fa-f0-9-]{36}\?v=\d+$/.test(user.avatarUrl ?? "")
  )
    return null;
  try {
    const base = new URL(boot.apiBaseUrl);
    const image = new URL(user.avatarUrl, base);
    return image.origin === base.origin ? image.href : null;
  } catch {
    return null;
  }
}
const spin = (busy) =>
  busy ? '<span class="spinner" aria-hidden="true"></span>' : "";
const actionIcons = {
  "admin-group-member-add": "add",
  "admin-group-child-create-toggle": "add",
  "admin-group-member-remove-request": "delete",
  "admin-group-member-remove-confirm": "delete",
  "admin-group-members-toggle": "edit",
  "admin-provider-mappers-toggle": "edit",
  "admin-message-delete-request": "delete",
  "admin-message-delete-confirm": "delete",
  "admin-provider-mapper-create": "add",
  "admin-user-toggle-confirm": "check",
  "admin-user-toggle-enabled": "check",
  "admin-user-totp-reset-request": "reset",
  "admin-user-totp-reset-confirm": "reset",
  "admin-user-unlock": "reset",
  "admin-user-password-reset-toggle": "reset",
  "admin-user-passkey-delete-request": "delete",
  "admin-user-passkey-delete-confirm": "delete",
  "admin-client-scope-delete-request": "delete",
  "admin-client-scope-delete-confirm": "delete",
  "admin-client-scope-role-mappings-toggle": "edit",
  "admin-client-scope-role-mappings-save": "check",
  "admin-client-scope-mappers-toggle": "edit",
  "admin-client-scope-mapper-create": "add",
  "admin-client-scope-mapper-edit": "edit",
  "admin-client-scope-mapper-delete-request": "delete",
  "admin-client-scope-mapper-delete-confirm": "delete",
  "admin-client-delete-request": "delete",
  "admin-client-delete-confirm": "delete",
  "admin-client-scope-assignments-toggle": "edit",
  "admin-client-scope-assignments-save": "check",
  "admin-client-mappers-toggle": "edit",
  "admin-client-mapper-create": "add",
  "admin-client-mapper-edit": "edit",
  "admin-client-mapper-delete-request": "delete",
  "admin-client-mapper-delete-confirm": "delete",
  "admin-consent-revoke-request": "delete",
  "admin-consent-revoke-confirm": "delete",
  "admin-group-delete-request": "delete",
  "admin-group-delete-confirm": "delete",
  "admin-group-roles-toggle": "edit",
  "admin-identity-provider-delete-request": "delete",
  "admin-identity-provider-delete-confirm": "delete",
  "admin-key-rotate-request": "reset",
  "admin-key-rotate-confirm": "reset",
  "admin-offline-session-revoke-request": "delete",
  "admin-offline-session-revoke-confirm": "delete",
  "admin-offline-access-revoke-request": "delete",
  "admin-offline-access-revoke-confirm": "delete",
  "admin-provider-mapper-delete-request": "delete",
  "admin-provider-mapper-delete-confirm": "delete",
  "admin-provider-mapper-edit": "edit",
  "admin-role-delete-request": "delete",
  "admin-role-delete-confirm": "delete",
  "admin-session-delete-request": "delete",
  "admin-session-delete-confirm": "delete",
  "admin-user-delete-request": "delete",
  "admin-user-delete-confirm": "delete",
  "admin-user-edit-toggle": "edit",
  "admin-user-avatar-toggle": "edit",
  "admin-user-avatar-delete-request": "delete",
  "admin-user-avatar-delete-confirm": "delete",
  "choose-account": "home",
  "choose-admin": "shield",
  "delete-account": "delete",
  "delete-other-sessions": "delete",
  "delete-session": "delete",
  "mfa-disable": "delete",
  "revoke-application": "delete",
  "revoke-offline": "delete",
  retry: "reset",
  "sign-in": "arrowRight",
  "social-remove": "delete",
};
const button = (label, options = {}) => {
  const iconName =
    options.icon ??
    actionIcons[options.action] ??
    (label === text("save") ? "check" : null);
  const icon = iconName ? icons[iconName] : null;
  return `<button class="${options.danger ? "danger-button" : "primary-button"}" type="${options.type ?? "button"}" data-action="${options.action ?? ""}" ${options.provider ? `data-provider="${escapeHtml(options.provider)}"` : ""} ${options.id != null ? `data-id="${escapeHtml(options.id)}"` : ""} ${options.mapper != null ? `data-mapper="${escapeHtml(options.mapper)}"` : ""} ${options.index != null ? `data-index="${options.index}"` : ""} ${options.disabled || options.busy || (options.mutation && state.offline) ? "disabled" : ""} ${options.busy ? 'aria-busy="true"' : ""}>${spin(options.busy)}${icon ? `<span class="button-icon" aria-hidden="true">${escapeHtml(icon.unicode)}</span>` : ""}${escapeHtml(label)}</button>`;
};
const field = (
  name,
  label,
  value = "",
  error = "",
  type = "text",
  extra = "",
) =>
  `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" aria-invalid="${Boolean(error)}" ${extra}/><div class="field-error" id="${name}-error">${escapeHtml(error)}</div></div>`;
const pageHeader = (title, description) => {
  const createUser =
    state.route === "users" ||
    (state.route === "user-create" && state.busy === "user-create-route");
  const createRole =
    state.route === "roles" ||
    (state.route === "role-create" && state.busy === "role-create-route");
  const createGroup =
    state.route === "groups" ||
    (state.route === "group-create" && state.busy === "group-create-route");
  const createClientScope =
    state.route === "client-scopes" ||
    (state.route === "client-scope-create" &&
      state.busy === "client-scope-create-route");
  const createAction =
    state.console === "admin" && createUser
      ? button(text("adminCreateUser"), {
          action: "create-user",
          busy:
            state.busy === "user-create-route" || state.busy === "route:users",
          disabled: state.offline || Boolean(state.busy),
          icon: "add",
        })
      : state.console === "admin" && createRole
        ? button(text("adminCreateRole"), {
            action: "create-role",
            busy:
              state.busy === "role-create-route" ||
              state.busy === "route:roles",
            disabled: state.offline || Boolean(state.busy),
            icon: "add",
          })
        : state.console === "admin" && createGroup
          ? button(text("adminCreateGroup"), {
              action: "create-group",
              busy:
                state.busy === "group-create-route" ||
                state.busy === "route:groups",
              disabled: state.offline || Boolean(state.busy),
              icon: "add",
            })
          : state.console === "admin" && createClientScope
            ? button(text("adminCreateClientScope"), {
                action: "create-client-scope",
                busy:
                  state.busy === "client-scope-create-route" ||
                  state.busy === "route:client-scopes",
                disabled: state.offline || Boolean(state.busy),
                icon: "add",
              })
            : "";
  return `<div class="topbar"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="actions">${createAction}${button(text("signOut"), { action: "logout", busy: state.busy === "logout", icon: "logout" })}</div></div>`;
};

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
}

function problemMessage(error) {
  if (error?.kind === "offline") return text("apiOffline");
  if (error?.kind === "timeout") return text("apiTimeout");
  if (error?.kind === "forbidden" && state.console === "admin")
    return text("adminForbidden");
  if (error?.kind === "forbidden") return text("apiForbidden");
  if (error?.kind === "unauthorized") return text("apiUnauthorized");
  if (error?.kind === "validation")
    return error.body?.detail ?? text("apiValidation");
  return text("apiFailure");
}

function setError(error) {
  state.error = {
    message: problemMessage(error),
    body: error?.body,
    kind: error?.kind,
  };
}

async function request(path, options = {}) {
  if (state.offline && (options.method ?? "GET") !== "GET") {
    const error = { kind: "offline", status: 0, body: null };
    setError(error);
    throw error;
  }
  const response = await api.api.request({
    console: state.console,
    locale: state.locale,
    path,
    method: options.method,
    body: options.body,
  });
  if (response.status === 401) {
    state.session = null;
    state.error = { message: problemMessage(response), kind: response.kind };
    render();
    throw response;
  }
  if (response.status >= 300 || response.status === 0) {
    setError(response);
    throw response;
  }
  return response.body;
}

async function loadGroupMembership(groupId) {
  const current = state.data.groupMembers?.[groupId] ?? {};
  const membersQuery = new URLSearchParams({
    q: current.membersQuery ?? "",
    page: "0",
    size: "10",
    sort: "username,asc",
  });
  const availableQuery = new URLSearchParams({
    q: current.availableQuery ?? "",
    page: "0",
    size: "10",
    sort: "username,asc",
  });
  const [members, available] = await Promise.all([
    request(`/api/admin/groups/${groupId}/users?${membersQuery.toString()}`),
    request(
      `/api/admin/groups/${groupId}/available-users?${availableQuery.toString()}`,
    ),
  ]);
  state.data.groupMembers ??= {};
  state.data.groupMembers[groupId] = {
    ...current,
    members,
    available,
    removeConfirmId: current.removeConfirmId ?? null,
  };
}

async function loadClientScopeRoleCandidates(scopeId, kind, page) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  if (!mapping || !["applicationRoles", "clientRoleIds"].includes(kind))
    throw new Error("Invalid client-scope role candidate request");
  const query = new URLSearchParams({
    q: mapping[`${kind}Query`] ?? "",
    page: String(page),
    size: "20",
    sort: "name,asc",
  });
  const endpoint =
    kind === "applicationRoles" ? "application-roles" : "client-roles";
  mapping[`${kind}Candidates`] = await request(
    `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/${endpoint}?${query.toString()}`,
  );
}

function violations(body) {
  return Object.fromEntries(
    (body?.violations ?? [])
      .filter((item) => item?.field && item?.message)
      .map((item) => [item.field, item.message]),
  );
}

function shell() {
  const navigation =
    state.console === "admin"
      ? `${navButton("dashboard", text("adminDashboard"))}${navButton("users", text("adminUsers"))}${navButton("roles", text("adminRoles"))}${navButton("groups", text("adminGroups"))}${navButton("client-scopes", text("adminClientScopes"))}${navButton("clients", text("adminClients"))}${navButton("identity-providers", text("adminIdentityProviders"))}${navButton("sessions", text("adminSessions"))}${navButton("consents", text("adminConsents"))}${navButton("offline-sessions", text("adminOfflineSessions"))}${navButton("events", text("adminEvents"))}${navButton("keys", text("adminKeys"))}${navButton("policies", text("adminPolicies"))}${navButton("configuration", text("adminConfiguration"))}${navButton("login-email", text("adminLoginEmail"))}${navButton("localization", text("adminLocalization"))}${navButton("ldap", text("adminLdap"))}${navButton("authentication", text("adminAuthentication"))}`
      : `${navButton("profile", text("firstName"))}${navButton("security", text("security"))}${navButton("sessions", text("sessions"))}${navButton("applications", text("applications"))}${navButton("settings", text("settings"))}`;
  return `<div class="app"><aside class="sidebar" aria-label="${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}</p><nav class="nav" aria-label="${escapeHtml(text("settings"))}">${navigation}</nav><div class="sidebar-footer">${state.console === "admin" ? button(text("accountTitle"), { action: "switch-account" }) : ""}${button(state.locale === "tr" ? text("english") : text("turkish"), { action: "toggle-locale", busy: state.busy === "locale", icon: "globe" })}</div></aside><main class="main">${pageHeader(routeTitle(), routeDescription())}<div class="content">${state.offline ? `<div class="notice warning" role="status">${escapeHtml(text("offlineNotice"))}</div>` : ""}${state.notice ? `<div class="notice success" role="status">${escapeHtml(state.notice)}</div>` : ""}${state.error ? `<div class="notice error" role="alert">${escapeHtml(problemMessage(state.error))} ${state.error.kind === "unauthorized" ? button(text("signIn"), { action: "sign-in" }) : button(state.console === "admin" ? text("adminRetry") : text("sessionsRetry"), { action: "retry", busy: state.busy === "retry" })}</div>` : ""}${content()}</div></main></div>`;
}

function navButton(route, label) {
  const busy = state.busy === `route:${route}`;
  return `<button type="button" data-route="${route}" aria-current="${state.route === route ? "page" : "false"}" ${busy ? 'disabled aria-busy="true"' : ""}>${spin(busy)}${escapeHtml(label)}</button>`;
}

function routeTitle() {
  if (state.console === "admin")
    return {
      users: text("adminUsers"),
      "user-create": text("adminCreateUser"),
      roles: text("adminRoles"),
      "role-create": text("adminCreateRole"),
      groups: text("adminGroups"),
      "group-create": text("adminCreateGroup"),
      "client-scopes": text("adminClientScopes"),
      "client-scope-create": text("adminCreateClientScope"),
      clients: text("adminClients"),
      "identity-providers": text("adminIdentityProviders"),
      sessions: text("adminSessions"),
      consents: text("adminConsents"),
      "offline-sessions": text("adminOfflineSessions"),
      events: text("adminEvents"),
      keys: text("adminKeys"),
      policies: text("adminPolicies"),
      configuration: text("adminConfiguration"),
      "login-email": text("adminLoginEmail"),
      localization: text("adminLocalization"),
      ldap: text("adminLdap"),
      authentication: text("adminAuthentication"),
      dashboard: text("adminDashboard"),
    }[state.route];
  return {
    profile: text("accountTitle"),
    security: text("securityTitle"),
    sessions: text("sessionsTitle"),
    applications: text("applicationsTitle"),
    settings: text("settingsTitle"),
  }[state.route];
}

function routeDescription() {
  if (state.console === "admin")
    return {
      users: text("adminSearchUsers"),
      "user-create": text("adminCreateUserDescription"),
      roles: text("adminSearchRoles"),
      "role-create": text("adminCreateRoleDescription"),
      groups: text("adminSearchGroups"),
      "group-create": text("adminCreateGroupDescription"),
      "client-scopes": text("adminSearchClientScopes"),
      "client-scope-create": text("adminCreateClientScopeDescription"),
      clients: text("adminSearchClients"),
      "identity-providers": text("adminSearchIdentityProviders"),
      sessions: text("adminSearchSessions"),
      consents: text("adminSearchConsents"),
      "offline-sessions": text("offlineSessionsHelp"),
      events: text("adminSearchEvents"),
      keys: text("adminSearchKeys"),
      policies: text("adminPoliciesDescription"),
      configuration: text("adminConfigurationDescription"),
      "login-email": text("adminLoginEmailDescription"),
      localization: text("adminLocalizationDescription"),
      ldap: text("adminLdapDescription"),
      authentication: text("adminAuthenticationDescription"),
      dashboard: text("adminOverview"),
    }[state.route];
  return {
    profile: text("profileDescription"),
    security: text("mfaHelp"),
    sessions: text("sessionsError"),
    applications: text("applicationsError"),
    settings: text("desktopSettingsDescription"),
  }[state.route];
}

function content() {
  if (state.loading)
    return (
      '<div class="loading" role="status"><span class="spinner"></span>' +
      escapeHtml(text("loading")) +
      "</div>"
    );
  if (state.console === "admin") return adminContent();
  if (state.route === "profile") return profileContent();
  if (state.route === "security") return securityContent();
  if (state.route === "sessions") return sessionsContent();
  if (state.route === "applications") return applicationsContent();
  return settingsContent();
}

function adminContent() {
  if (state.route === "users") return adminUsersContent();
  if (state.route === "user-create") return adminUserCreateContent();
  if (state.route === "roles") return adminRolesContent();
  if (state.route === "role-create") return adminRoleCreateContent();
  if (state.route === "groups") return adminGroupsContent();
  if (state.route === "group-create") return adminGroupCreateContent();
  if (state.route === "client-scopes") return adminClientScopesContent();
  if (state.route === "client-scope-create")
    return adminClientScopeCreateContent();
  if (state.route === "clients") return adminClientsContent();
  if (state.route === "identity-providers")
    return adminIdentityProvidersContent();
  if (state.route === "sessions") return adminAdminSessionsContent();
  if (state.route === "consents") return adminAdminConsentsContent();
  if (state.route === "offline-sessions")
    return adminAdminOfflineSessionsContent();
  if (state.route === "events") return adminAdminEventsContent();
  if (state.route === "keys") return adminAdminKeysContent();
  if (state.route === "policies") return adminAdminPoliciesContent();
  if (state.route === "configuration") return adminAdminConfigurationContent();
  if (state.route === "login-email") return adminAdminLoginEmailContent();
  if (state.route === "localization") return adminAdminLocalizationContent();
  if (state.route === "ldap") return adminAdminLdapContent();
  if (state.route === "authentication")
    return adminAdminAuthenticationContent();
  const dashboard = state.data.dashboard ?? {};
  const stats = [
    ["clients", "adminStatClients"],
    ["users", "adminStatUsers"],
    ["sessions", "adminStatSessions"],
    ["consents", "adminStatConsents"],
  ];
  return `<section class="stat-grid" aria-label="${escapeHtml(text("adminDashboard"))}">${stats.map(([key, label]) => `<article class="card stat-card"><h2>${escapeHtml(text(label))}</h2><p class="stat-value">${Number.isSafeInteger(dashboard[key]) && dashboard[key] >= 0 ? dashboard[key] : 0}</p></article>`).join("")}</section>`;
}

function adminUsersContent() {
  const page = state.data.users ?? { content: [], number: 0, totalPages: 0 };
  const users = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const selectedUserIds = new Set(
    (state.data.adminSelectedUserIds ?? [])
      .filter((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0)
      .map(Number),
  );
  const userRows = users
    .map((user) => {
      const userSelected = selectedUserIds.has(Number(user.id));
      const busy = state.busy === `user-enabled:${user.id}`;
      const editDraft = state.data.userEditDrafts?.[user.id] ?? {};
      const editRoles = Array.isArray(state.data.userEditRoles)
        ? state.data.userEditRoles
        : [];
      const editErrors =
        Number(state.data.userEditErrorId) === Number(user.id)
          ? violations(state.error?.body)
          : {};
      const confirming =
        Number(state.data.userDisableConfirmId) === Number(user.id);
      const enabledControls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDisableUserPrompt"))}</span>${button(text("adminDisableUser"), { action: "admin-user-toggle-confirm", id: user.id, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-toggle-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text(user.enabled ? "adminDisableUser" : "adminEnableUser"), { action: "admin-user-toggle-enabled", id: user.id, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const deleteConfirming =
        Number(state.data.userDeleteConfirmId) === Number(user.id);
      const deleting = state.busy === `user-delete:${user.id}`;
      const deleteControls = deleteConfirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteUserPrompt"))}</span>${button(text("adminDeleteUser"), { action: "admin-user-delete-confirm", id: user.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminDeleteUser"), { action: "admin-user-delete-request", id: user.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const totpConfirming =
        Number(state.data.userTotpResetConfirmId) === Number(user.id);
      const totpBusy = state.busy === `user-totp-reset:${user.id}`;
      const totpControls = !user.totpEnabled
        ? ""
        : totpConfirming
          ? `<div class="actions"><span role="status">${escapeHtml(text("adminResetAuthenticatorPrompt"))}</span>${button(text("adminResetAuthenticator"), { action: "admin-user-totp-reset-confirm", id: user.id, danger: true, busy: totpBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-totp-reset-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
          : `<div class="actions">${button(text("adminResetAuthenticator"), { action: "admin-user-totp-reset-request", id: user.id, icon: "reset", disabled: state.offline || Boolean(state.busy) })}</div>`;
      const unlockBusy = state.busy === `user-unlock:${user.id}`;
      const actionEmailOpen =
        Number(state.data.userActionEmailOpenId) === Number(user.id);
      const actionEmailControl = user.email
        ? button(text("adminSendActionEmail"), {
            action: "admin-user-action-email-toggle",
            id: user.id,
            disabled: state.offline || Boolean(state.busy),
          })
        : "";
      const unlockControl = user.locked
        ? button(text("adminUnlockUser"), {
            action: "admin-user-unlock",
            id: user.id,
            icon: "reset",
            busy: unlockBusy,
            disabled: state.offline || Boolean(state.busy),
          })
        : "";
      const passwordResetOpen =
        Number(state.data.userPasswordResetOpenId) === Number(user.id);
      const passwordResetErrors =
        Number(state.data.userPasswordResetErrorId) === Number(user.id)
          ? violations(state.error?.body)
          : {};
      const passwordResetBusy = state.busy === `user-password-reset:${user.id}`;
      const passwordResetControl = button(text("adminResetPassword"), {
        action: "admin-user-password-reset-toggle",
        id: user.id,
        icon: "reset",
        disabled: state.offline || Boolean(state.busy),
      });
      const passwordResetForm = passwordResetOpen
        ? `<form class="card" data-form="admin-user-password-reset" data-user-id="${escapeHtml(user.id)}" novalidate><div class="field"><label for="user-password-${escapeHtml(user.id)}">${escapeHtml(text("newPassword"))}</label><input id="user-password-${escapeHtml(user.id)}" name="password" type="password" aria-invalid="${Boolean(passwordResetErrors.password)}" minlength="12" maxlength="128" autocomplete="new-password" required/><div class="field-error">${escapeHtml(passwordResetErrors.password ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="temporary"/>${escapeHtml(text("adminUserTemporaryPassword"))}</label><div class="actions">${button(text("adminSetPassword"), { type: "submit", busy: passwordResetBusy, disabled: state.offline })}<button class="secondary-button" type="button" data-action="admin-user-password-reset-cancel" data-id="${escapeHtml(user.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const passkeysOpen =
        Number(state.data.userPasskeysOpenId) === Number(user.id);
      const passkeysLoading = state.busy === `user-passkeys-load:${user.id}`;
      const passkeysControl = button(text("adminManagePasskeys"), {
        action: "admin-user-passkeys-toggle",
        id: user.id,
        busy: passkeysLoading,
        disabled: state.offline || Boolean(state.busy),
      });
      const profileAttributesLoading =
        state.busy === `user-profile-attributes-load:${user.id}`;
      const profileAttributesControl = button(text("adminProfileAttributes"), {
        action: "admin-user-profile-attributes-toggle",
        id: user.id,
        busy: profileAttributesLoading,
        disabled: state.offline || Boolean(state.busy),
      });
      const avatarOpen =
        Number(state.data.userAvatarOpenId) === Number(user.id);
      const avatarControl = button(text("adminUserAvatar"), {
        action: "admin-user-avatar-toggle",
        id: user.id,
        disabled: state.offline || Boolean(state.busy),
      });
      const editing = Number(state.data.userEditOpenId) === Number(user.id);
      const selectedRoles = Array.isArray(editDraft.roles)
        ? editDraft.roles
        : (user.assignedRoles ?? user.authorities ?? []);
      const updateBusy = state.busy === `user-update:${user.id}`;
      const editForm = editing
        ? `<form class="card" data-form="admin-user-edit" data-user-id="${escapeHtml(user.id)}" novalidate><div class="form-grid">${field("username", text("username"), editDraft.username ?? user.username ?? "", editErrors.username, "text", 'maxlength="100" autocomplete="username" required')}${field("firstName", text("firstName"), editDraft.firstName ?? user.firstName ?? "", editErrors.firstName, "text", 'maxlength="100" autocomplete="given-name"')}${field("lastName", text("lastName"), editDraft.lastName ?? user.lastName ?? "", editErrors.lastName, "text", 'maxlength="100" autocomplete="family-name"')}${field("email", text("email"), editDraft.email ?? user.email ?? "", editErrors.email, "email", 'maxlength="200" autocomplete="email"')}</div><label class="settings-row"><input type="checkbox" name="emailVerified" ${(editDraft.emailVerified ?? user.emailVerified) ? "checked" : ""}/>${escapeHtml(text("adminUserEmailVerified"))}</label><label class="settings-row"><input type="checkbox" name="enabled" ${(editDraft.enabled ?? user.enabled) ? "checked" : ""}/>${escapeHtml(text("adminEnabled"))}</label><fieldset class="field"><legend>${escapeHtml(text("adminRoles"))}</legend>${editRoles.length ? editRoles.map((role) => `<label class="settings-row"><input type="checkbox" name="roles" value="${escapeHtml(role.name)}" ${selectedRoles.includes(role.name) ? "checked" : ""}/>${escapeHtml(role.name)}</label>`).join("") : `<div class="empty" role="status">${escapeHtml(text("adminNoRoles"))}</div>`}<div class="field-error">${escapeHtml(editErrors.roles ?? (state.data.userEditErrorId === Number(user.id) ? (state.data.userEditLocalError ?? "") : ""))}</div></fieldset><div class="actions">${button(text("save"), { type: "submit", busy: updateBusy, disabled: state.offline || Boolean(state.busy) || editRoles.length === 0 })}<button class="secondary-button" type="button" data-action="admin-user-edit-cancel" data-id="${escapeHtml(user.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      return `<article class="list-item" data-user-id="${escapeHtml(user.id)}"><div><label class="settings-row"><input type="checkbox" data-action="admin-user-bulk-select" data-id="${escapeHtml(user.id)}" aria-label="${escapeHtml(text("adminSelectUser"))} ${escapeHtml(user.username)}" ${userSelected ? "checked" : ""} ${state.busy || state.offline ? "disabled" : ""}/>${escapeHtml(text("adminSelectUser"))}</label><strong>${escapeHtml(user.username)}</strong>${user.email ? `<span class="muted">${escapeHtml(user.email)}</span>` : ""}<span class="muted">${escapeHtml((user.effectiveRoles ?? user.authorities ?? []).join(", "))}</span><span>${escapeHtml(user.enabled ? text("adminUserEnabled") : text("adminUserDisabled"))}</span>${user.email && !user.emailVerified ? `<span>${escapeHtml(text("adminUserEmailNotVerified"))}</span>` : ""}${user.locked ? `<span>${escapeHtml(text("adminUserLocked"))}</span>` : ""}</div><div>${button(text("adminEditUser"), { action: "admin-user-edit-toggle", id: user.id, busy: state.busy === `user-edit-roles:${user.id}`, disabled: state.offline || Boolean(state.busy) })}${actionEmailControl}${profileAttributesControl}${avatarControl}${passwordResetControl}${unlockControl}${totpControls}${passkeysControl}${enabledControls}${deleteControls}</div>${editForm}${passwordResetForm}${actionEmailOpen ? adminUserActionEmailContent(user.id) : ""}${passkeysOpen ? adminUserPasskeysContent(user.id) : ""}${Number(state.data.userProfileAttributesOpenId) === Number(user.id) ? adminUserProfileAttributesContent(user.id) : ""}${avatarOpen ? adminUserAvatarContent(user) : ""}</article>`;
    })
    .join("");
  const bulkAction = state.data.adminUserBulkConfirmAction;
  const bulkButton = (action, label, danger = false) =>
    button(text(label), {
      action: `admin-user-bulk-${action.toLowerCase()}`,
      danger,
      disabled:
        state.offline || Boolean(state.busy) || selectedUserIds.size === 0,
    });
  const bulkControls = selectedUserIds.size
    ? `<section class="card" aria-label="${escapeHtml(text("adminSelectedUsers"))}"><span>${escapeHtml(text("adminSelectedUsers"))}: ${selectedUserIds.size}</span><div class="actions">${bulkButton("ENABLE", "adminBulkEnableUsers")}${bulkButton("DISABLE", "adminBulkDisableUsers")}${bulkButton("DELETE", "adminBulkDeleteUsers", true)}</div>${bulkAction ? `<div class="actions"><span role="status">${escapeHtml(text("adminBulkUserPrompt"))}</span>${button(text(bulkAction === "ENABLE" ? "adminBulkEnableUsers" : bulkAction === "DISABLE" ? "adminBulkDisableUsers" : "adminBulkDeleteUsers"), { action: "admin-user-bulk-confirm", danger: bulkAction === "DELETE", busy: state.busy === "user-bulk-action", disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-bulk-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>` : ""}</section>`
    : "";
  return `<section class="card" aria-label="${escapeHtml(text("adminUsers"))}"><form id="admin-user-search" class="actions" role="search"><input id="admin-user-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchUsers"))}" value="${escapeHtml(state.data.userQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchUsers"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "users-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "users-search")}${escapeHtml(text("adminSearchUsers"))}</button></form>${bulkControls}${users.length ? `<div class="list">${userRows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoUsers"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminUsers"))} pagination"><button class="secondary-button" type="button" data-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "users-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "users-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminUserActionEmailContent(userId) {
  const draft = state.data.adminUserActionEmailDrafts?.[userId] ?? {};
  const action = ["VERIFY_EMAIL", "UPDATE_PASSWORD"].includes(draft.action)
    ? draft.action
    : "UPDATE_PASSWORD";
  const lifespan = ["1800", "3600", "43200", "86400"].includes(
    String(draft.lifespan),
  )
    ? String(draft.lifespan)
    : "43200";
  const busy = state.busy === `user-action-email:${userId}`;
  return `<section class="card" aria-label="${escapeHtml(text("adminSendActionEmail"))}"><form data-form="admin-user-action-email" data-user-id="${escapeHtml(userId)}" novalidate><div class="field"><label for="admin-user-action-${escapeHtml(userId)}">${escapeHtml(text("adminActionEmailAction"))}</label><select id="admin-user-action-${escapeHtml(userId)}" name="action" required><option value="UPDATE_PASSWORD" ${action === "UPDATE_PASSWORD" ? "selected" : ""}>${escapeHtml(text("adminUpdatePasswordAction"))}</option><option value="VERIFY_EMAIL" ${action === "VERIFY_EMAIL" ? "selected" : ""}>${escapeHtml(text("adminVerifyEmailAction"))}</option></select></div><div class="field"><label for="admin-user-action-lifespan-${escapeHtml(userId)}">${escapeHtml(text("adminActionEmailLifespan"))}</label><select id="admin-user-action-lifespan-${escapeHtml(userId)}" name="lifespan" required><option value="1800" ${lifespan === "1800" ? "selected" : ""}>${escapeHtml(text("adminLifespan30Minutes"))}</option><option value="3600" ${lifespan === "3600" ? "selected" : ""}>${escapeHtml(text("adminLifespan1Hour"))}</option><option value="43200" ${lifespan === "43200" ? "selected" : ""}>${escapeHtml(text("adminLifespan12Hours"))}</option><option value="86400" ${lifespan === "86400" ? "selected" : ""}>${escapeHtml(text("adminLifespan24Hours"))}</option></select></div><div class="actions">${button(text("adminSendActionEmail"), { type: "submit", busy, disabled: state.offline })}<button class="secondary-button" type="button" data-action="admin-user-action-email-close" data-id="${escapeHtml(userId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function adminUserProfileAttributesContent(userId) {
  const profile = state.data.adminUserProfileAttributes?.[userId];
  if (!profile) return "";
  const definitions = (profile.definitions ?? []).filter(
    (definition) => definition.enabled && !definition.builtIn,
  );
  const drafts = state.data.adminProfileAttributeDrafts?.[userId] ?? {};
  const errors =
    Number(state.data.adminProfileAttributesErrorId) === Number(userId)
      ? violations(state.error?.body)
      : {};
  const fields = definitions
    .map((definition) => {
      const name = String(definition.name ?? "");
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) return "";
      const values = Array.isArray(drafts[name])
        ? drafts[name]
        : (profile.attributes?.[name] ?? []);
      const value = values.join("\n");
      const error = errors[`attributes.${name}`] ?? errors[name] ?? "";
      const label = escapeHtml(definition.displayName || name);
      const id = `admin-profile-attribute-${escapeHtml(userId)}-${escapeHtml(name)}`;
      const common = `id="${id}" name="attribute-${escapeHtml(name)}" data-profile-attribute="${escapeHtml(name)}" data-multivalued="${Boolean(definition.multivalued)}" aria-invalid="${Boolean(error)}" ${definition.required ? "required" : ""}`;
      let input;
      if (definition.multivalued) {
        input = `<textarea ${common} rows="3">${escapeHtml(value)}</textarea>`;
      } else if (definition.type === "BOOLEAN") {
        input = `<select ${common}><option value=""></option><option value="true" ${value === "true" ? "selected" : ""}>true</option><option value="false" ${value === "false" ? "selected" : ""}>false</option></select>`;
      } else {
        const type =
          definition.type === "EMAIL"
            ? "email"
            : definition.type === "INTEGER"
              ? "number"
              : "text";
        const constraints = [
          definition.minLength != null
            ? `minlength="${Number(definition.minLength)}"`
            : "",
          definition.maxLength != null
            ? `maxlength="${Number(definition.maxLength)}"`
            : "",
          definition.type === "INTEGER" ? 'step="1"' : "",
          definition.pattern
            ? `pattern="${escapeHtml(definition.pattern)}"`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        input = `<input ${common} type="${type}" value="${escapeHtml(values[0] ?? "")}" ${constraints}/>`;
      }
      return `<div class="field"><label for="${id}">${label}</label>${input}<div class="field-error">${escapeHtml(error)}</div></div>`;
    })
    .join("");
  const saveBusy = state.busy === `user-profile-attributes-save:${userId}`;
  return `<section class="card" aria-label="${escapeHtml(text("adminProfileAttributes"))}"><form data-form="admin-user-profile-attributes" data-user-id="${escapeHtml(userId)}" novalidate><div class="form-grid">${fields || `<div class="empty" role="status">${escapeHtml(text("adminNoProfileAttributes"))}</div>`}</div><p class="muted">${escapeHtml(text("adminProfileAttributesHelp"))}</p><div class="actions">${button(text("save"), { type: "submit", busy: saveBusy, disabled: state.offline || definitions.length === 0 })}<button class="secondary-button" type="button" data-action="admin-user-profile-attributes-close" data-id="${escapeHtml(userId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function adminUserAvatarContent(user) {
  const userId = Number(user.id);
  const source = userAvatarSource(user);
  const error = state.data.adminAvatarErrors?.[userId];
  const confirming = Number(state.data.adminAvatarDeleteConfirmId) === userId;
  const uploadBusy = state.busy === `admin-avatar-upload:${userId}`;
  const deleteBusy = state.busy === `admin-avatar-delete:${userId}`;
  const deleteControl = source
    ? confirming
      ? `<div class="actions"><span role="status">${escapeHtml(text("adminUserAvatarRemovePrompt"))}</span>${button(text("adminUserAvatarRemove"), { action: "admin-user-avatar-delete-confirm", id: userId, danger: true, busy: deleteBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-avatar-delete-cancel" data-id="${userId}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
      : button(text("adminUserAvatarRemove"), {
          action: "admin-user-avatar-delete-request",
          id: userId,
          disabled: state.offline || Boolean(state.busy),
        })
    : "";
  return `<section class="card" aria-label="${escapeHtml(text("adminUserAvatar"))}">${source ? `<img class="admin-user-avatar" src="${escapeHtml(source)}" alt="${escapeHtml(text("adminUserAvatar"))}"/>` : `<p>${escapeHtml(text("adminUserAvatarEmpty"))}</p>`}<label class="field" for="admin-user-avatar-file-${userId}">${escapeHtml(text("adminUserAvatar"))}<input id="admin-user-avatar-file-${userId}" type="file" accept="image/jpeg,image/png" data-admin-avatar-file="${userId}" ${state.offline || state.busy ? "disabled" : ""}/></label><p class="muted">${escapeHtml(text("adminUserAvatarHelp"))}</p>${error ? `<p class="field-error" role="alert">${escapeHtml(error)}</p>` : ""}<div class="actions">${button(text("adminUserAvatarUpload"), { action: "admin-user-avatar-upload", id: userId, busy: uploadBusy, disabled: state.offline })}${deleteControl}<button class="secondary-button" type="button" data-action="admin-user-avatar-close" data-id="${userId}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></section>`;
}

function adminUserPasskeysContent(userId) {
  const passkeyPage = state.data.adminUserPasskeys?.[userId];
  if (!passkeyPage) return "";
  const passkeys = Array.isArray(passkeyPage.content)
    ? passkeyPage.content
    : [];
  const pageNumber = Number.isSafeInteger(passkeyPage.number)
    ? passkeyPage.number
    : 0;
  const totalPages = Number.isSafeInteger(passkeyPage.totalPages)
    ? passkeyPage.totalPages
    : 0;
  const rows = passkeys
    .map((passkey, index) => {
      const editing =
        state.data.adminPasskeyEditTarget === `${userId}:${index}`;
      const confirming =
        state.data.adminPasskeyDeleteConfirmTarget === `${userId}:${index}`;
      const target = `${userId}:${index}`;
      const errors =
        state.data.adminPasskeyErrorTarget === target
          ? violations(state.error?.body)
          : {};
      const draft = state.data.adminPasskeyDrafts?.[target];
      const renameBusy = state.busy === `admin-passkey-rename:${target}`;
      const deleteBusy = state.busy === `admin-passkey-delete:${target}`;
      const labelId = `admin-passkey-label-${userId}-${index}`;
      const renameForm = editing
        ? `<form class="card" data-form="admin-user-passkey-rename" data-user-id="${escapeHtml(userId)}" data-passkey-index="${index}" novalidate><div class="field"><label for="${labelId}">${escapeHtml(text("adminPasskeyLabel"))}</label><input id="${labelId}" name="label" type="text" value="${escapeHtml(draft ?? passkey.label)}" maxlength="100" aria-invalid="${Boolean(errors.label)}" required/><div class="field-error">${escapeHtml(errors.label ?? "")}</div></div><div class="actions">${button(text("adminRenamePasskey"), { type: "submit", busy: renameBusy, disabled: state.offline })}<button class="secondary-button" type="button" data-action="admin-user-passkey-rename-cancel" data-id="${escapeHtml(userId)}" data-index="${index}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const deleteControls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeletePasskeyPrompt"))}</span>${button(text("adminDeletePasskey"), { action: "admin-user-passkey-delete-confirm", id: userId, index, danger: true, busy: deleteBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-passkey-delete-cancel" data-id="${escapeHtml(userId)}" data-index="${index}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : button(text("adminDeletePasskey"), {
            action: "admin-user-passkey-delete-request",
            id: userId,
            index,
            danger: true,
            disabled: state.offline || Boolean(state.busy),
          });
      return `<article class="list-item" data-passkey-index="${index}"><div><strong>${escapeHtml(passkey.label)}</strong><span class="muted">${escapeHtml((passkey.transports ?? []).join(", "))}</span></div><div class="actions"><button class="secondary-button" type="button" data-action="admin-user-passkey-rename-toggle" data-id="${escapeHtml(userId)}" data-index="${index}" ${state.offline || state.busy ? "disabled" : ""}>${escapeHtml(text("adminRenamePasskey"))}</button>${deleteControls}</div>${renameForm}</article>`;
    })
    .join("");
  const previousPage = button(text("adminPrevious"), {
    action: "admin-user-passkey-page",
    id: userId,
    index: pageNumber - 1,
    busy: state.busy === `admin-passkey-page:${userId}:${pageNumber - 1}`,
    disabled: pageNumber <= 0 || state.offline || Boolean(state.busy),
  });
  const nextPage = button(text("adminNext"), {
    action: "admin-user-passkey-page",
    id: userId,
    index: pageNumber + 1,
    busy: state.busy === `admin-passkey-page:${userId}:${pageNumber + 1}`,
    disabled:
      pageNumber + 1 >= totalPages || state.offline || Boolean(state.busy),
  });
  return `<section class="card" aria-label="${escapeHtml(text("adminManagePasskeys"))}"><div class="actions"><h3>${escapeHtml(text("adminManagePasskeys"))}</h3><button class="secondary-button" type="button" data-action="admin-user-passkeys-close" data-id="${escapeHtml(userId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>${rows ? `<div class="list">${rows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoPasskeys"))}</div>`}${totalPages > 1 ? `<div class="actions" aria-label="${escapeHtml(text("adminManagePasskeys"))} pagination">${previousPage}<span>${escapeHtml(text("adminPage"))} ${pageNumber + 1} / ${totalPages}</span>${nextPage}</div>` : ""}</section>`;
}

function adminUserPasskeyPath(userId, index) {
  const id = Number(userId);
  const passkeyIndex = Number(index);
  const credential =
    state.data.adminUserPasskeys?.[id]?.content?.[passkeyIndex];
  const credentialId = credential?.credentialId;
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(passkeyIndex) ||
    passkeyIndex < 0 ||
    typeof credentialId !== "string" ||
    !/^[A-Za-z0-9_-]{1,300}$/.test(credentialId)
  )
    return null;
  return `/api/admin/users/${id}/webauthn/credentials/${credentialId}`;
}

function adminUserCreateContent() {
  const createdUserId = Number(state.data.userCreateCreatedUserId);
  if (Number.isSafeInteger(createdUserId) && createdUserId > 0) {
    const definitions = Array.isArray(state.data.userCreateProfileDefinitions)
      ? state.data.userCreateProfileDefinitions
      : [];
    const draft = state.data.userCreateDraft?.profile ?? {};
    const errors = violations(state.error?.body);
    const fields = definitions
      .filter((definition) => definition.enabled && !definition.builtIn)
      .map((definition) => {
        const name = String(definition.name ?? "");
        if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) return "";
        const values = Array.isArray(draft[name]) ? draft[name] : [];
        const error = errors[`attributes.${name}`] ?? errors[name] ?? "";
        const label = escapeHtml(definition.displayName || name);
        const id = `admin-create-profile-attribute-${escapeHtml(name)}`;
        const common = `id="${id}" name="attribute-${escapeHtml(name)}" data-profile-attribute="${escapeHtml(name)}" data-multivalued="${Boolean(definition.multivalued)}" aria-invalid="${Boolean(error)}" ${definition.required ? "required" : ""}`;
        let input;
        if (definition.multivalued) {
          input = `<textarea ${common} rows="3">${escapeHtml(values.join("\n"))}</textarea>`;
        } else if (definition.type === "BOOLEAN") {
          input = `<select ${common}><option value=""></option><option value="true" ${values[0] === "true" ? "selected" : ""}>true</option><option value="false" ${values[0] === "false" ? "selected" : ""}>false</option></select>`;
        } else {
          const type =
            definition.type === "EMAIL"
              ? "email"
              : definition.type === "INTEGER"
                ? "number"
                : "text";
          const constraints = [
            definition.minLength != null
              ? `minlength="${Number(definition.minLength)}"`
              : "",
            definition.maxLength != null
              ? `maxlength="${Number(definition.maxLength)}"`
              : "",
            definition.type === "INTEGER" ? 'step="1"' : "",
            definition.pattern
              ? `pattern="${escapeHtml(definition.pattern)}"`
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          input = `<input ${common} type="${type}" value="${escapeHtml(values[0] ?? "")}" ${constraints}/>`;
        }
        return `<div class="field"><label for="${id}">${label}</label>${input}<div class="field-error">${escapeHtml(error)}</div></div>`;
      })
      .join("");
    return `<section class="card" aria-label="${escapeHtml(text("adminProfileAttributes"))}"><p role="status">${escapeHtml(text("adminUserCreatedProfileSaveFailed"))}</p><form data-form="admin-user-create" data-created-user-id="${createdUserId}" novalidate><div class="form-grid">${fields || `<div class="empty" role="status">${escapeHtml(text("adminNoProfileAttributes"))}</div>`}</div><p class="muted">${escapeHtml(text("adminProfileAttributesHelp"))}</p><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "user-create-profile-save", disabled: state.offline || definitions.length === 0 })}</div></form></section>`;
  }
  const draft = state.data.userCreateDraft ?? {};
  const roles = Array.isArray(state.data.userCreateRoles)
    ? state.data.userCreateRoles
    : [];
  const selectedRoles = Array.isArray(draft.roles)
    ? draft.roles
    : ["ROLE_USER"];
  const errors = violations(state.error?.body);
  const profileDefinitions = (
    state.data.userCreateProfileDefinitions ?? []
  ).filter((definition) => definition.enabled && !definition.builtIn);
  const profileFields = profileDefinitions
    .map((definition) => {
      const name = String(definition.name ?? "");
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name)) return "";
      const values = Array.isArray(draft.profile?.[name])
        ? draft.profile[name]
        : [];
      const error = errors[`attributes.${name}`] ?? errors[name] ?? "";
      const label = escapeHtml(definition.displayName || name);
      const id = `admin-create-profile-attribute-${escapeHtml(name)}`;
      const common = `id="${id}" name="attribute-${escapeHtml(name)}" data-profile-attribute="${escapeHtml(name)}" data-multivalued="${Boolean(definition.multivalued)}" aria-invalid="${Boolean(error)}" ${definition.required ? "required" : ""}`;
      if (definition.multivalued)
        return `<div class="field"><label for="${id}">${label}</label><textarea ${common} rows="3">${escapeHtml(values.join("\n"))}</textarea><div class="field-error">${escapeHtml(error)}</div></div>`;
      if (definition.type === "BOOLEAN")
        return `<div class="field"><label for="${id}">${label}</label><select ${common}><option value=""></option><option value="true" ${values[0] === "true" ? "selected" : ""}>true</option><option value="false" ${values[0] === "false" ? "selected" : ""}>false</option></select><div class="field-error">${escapeHtml(error)}</div></div>`;
      const type =
        definition.type === "EMAIL"
          ? "email"
          : definition.type === "INTEGER"
            ? "number"
            : "text";
      const constraints = [
        definition.minLength != null
          ? `minlength="${Number(definition.minLength)}"`
          : "",
        definition.maxLength != null
          ? `maxlength="${Number(definition.maxLength)}"`
          : "",
        definition.type === "INTEGER" ? 'step="1"' : "",
        definition.pattern ? `pattern="${escapeHtml(definition.pattern)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<div class="field"><label for="${id}">${label}</label><input ${common} type="${type}" value="${escapeHtml(values[0] ?? "")}" ${constraints}/><div class="field-error">${escapeHtml(error)}</div></div>`;
    })
    .join("");
  return `<section class="card"><form data-form="admin-user-create" novalidate><div class="form-grid">${field("username", text("username"), draft.username ?? "", errors.username, "text", 'maxlength="100" autocomplete="username" required')}${field("firstName", text("firstName"), draft.firstName ?? "", errors.firstName, "text", 'maxlength="100" autocomplete="given-name"')}${field("lastName", text("lastName"), draft.lastName ?? "", errors.lastName, "text", 'maxlength="100" autocomplete="family-name"')}${field("email", text("email"), draft.email ?? "", errors.email, "email", 'maxlength="200" autocomplete="email"')}${field("password", text("newPassword"), "", errors.password, "password", 'minlength="12" maxlength="128" autocomplete="new-password" required')}${profileFields}</div><label class="settings-row"><input type="checkbox" name="temporary" ${draft.temporary ? "checked" : ""}/>${escapeHtml(text("adminUserTemporaryPassword"))}</label><label class="settings-row"><input type="checkbox" name="emailVerified" ${draft.emailVerified ? "checked" : ""}/>${escapeHtml(text("adminUserEmailVerified"))}</label><label class="settings-row"><input type="checkbox" name="enabled" ${draft.enabled !== false ? "checked" : ""}/>${escapeHtml(text("adminEnabled"))}</label><fieldset class="field"><legend>${escapeHtml(text("adminRoles"))}</legend>${roles.length ? roles.map((role) => `<label class="settings-row"><input type="checkbox" name="roles" value="${escapeHtml(role.name)}" ${selectedRoles.includes(role.name) ? "checked" : ""}/>${escapeHtml(role.name)}</label>`).join("") : `<div class="empty" role="status">${escapeHtml(text("adminNoRoles"))}</div>`}<div class="field-error" id="roles-error">${escapeHtml(errors.roles ?? "")}</div></fieldset><div class="actions">${button(text("adminCreateUser"), { type: "submit", busy: state.busy === "user-create", disabled: state.offline || roles.length === 0 || !state.data.userCreateProfileDefinitionsLoaded })}</div></form></section>`;
}

function adminRolesContent() {
  const page = state.data.roles ?? { content: [], number: 0, totalPages: 0 };
  const roles = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const errors = violations(state.error?.body);
  const roleRows = roles
    .map((role) => {
      const draft = state.data.adminRoleDrafts?.[role.name] ?? {};
      const roleErrors =
        state.data.adminRoleErrorName === role.name ? errors : {};
      const busy = state.busy === `role-update:${role.name}`;
      const deleting = state.busy === `role-delete:${role.name}`;
      const confirming = state.data.roleDeleteConfirmName === role.name;
      const descriptionId = `role-description-${role.name}`;
      const deleteControls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteRolePrompt"))}</span>${button(text("adminDeleteRole"), { action: "admin-role-delete-confirm", id: role.name, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-role-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminDeleteRole"), { action: "admin-role-delete-request", id: role.name, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item" data-role-name="${escapeHtml(role.name)}"><strong>${escapeHtml(role.name)}</strong><form class="actions" data-form="admin-role-edit" data-role-name="${escapeHtml(role.name)}"><div class="field"><label for="${escapeHtml(descriptionId)}">${escapeHtml(text("adminRoleDescription"))}</label><input id="${escapeHtml(descriptionId)}" name="description" type="text" value="${escapeHtml(draft.description ?? role.description ?? "")}" maxlength="500"/><div class="field-error">${escapeHtml(roleErrors.description ?? "")}</div></div>${button(text("save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}</form>${deleteControls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminRoles"))}"><form id="admin-role-search" class="actions" role="search"><input id="admin-role-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchRoles"))}" value="${escapeHtml(state.data.roleQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchRoles"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "roles-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "roles-search")}${escapeHtml(text("adminSearchRoles"))}</button></form>${roles.length ? `<div class="list">${roleRows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoRoles"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminRoles"))} pagination"><button class="secondary-button" type="button" data-role-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "roles-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-role-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "roles-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminRoleCreateContent() {
  const draft = state.data.adminRoleCreateDraft ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><form data-form="admin-role-create" novalidate>${field("name", text("adminRoleName"), draft.name ?? "", errors.name, "text", 'maxlength="50" pattern="ROLE_[A-Z0-9_]+" autocomplete="off" required')}${field("description", text("adminRoleDescription"), draft.description ?? "", errors.description, "text", 'maxlength="500"')}${button(text("adminCreateRole"), { type: "submit", busy: state.busy === "role-create", disabled: state.offline })}</form></section>`;
}

function adminGroupsContent() {
  const page = state.data.groups ?? { content: [], number: 0, totalPages: 0 };
  const groups = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const rows = groups
    .map((group) => {
      const confirming =
        Number(state.data.groupDeleteConfirmId) === Number(group.id);
      const busy = state.busy === `group-delete:${group.id}`;
      const controls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteGroupPrompt"))}</span>${button(text("adminDeleteGroup"), { action: "admin-group-delete-confirm", id: group.id, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-group-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminDeleteGroup"), { action: "admin-group-delete-request", id: group.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const memberState = state.data.groupMembers?.[group.id];
      const memberPanel =
        Number(state.data.groupMembersOpenId) === Number(group.id)
          ? renderGroupMembers(group.id, memberState)
          : "";
      const roleDraft = state.data.groupRoleDrafts?.[group.id] ?? {};
      const roleErrors =
        Number(state.data.groupRoleErrorId) === Number(group.id)
          ? violations(state.error?.body)
          : {};
      const roleCatalog = Array.isArray(state.data.userEditRoles)
        ? state.data.userEditRoles
        : [];
      const selectedRoles = Array.isArray(roleDraft.roles)
        ? roleDraft.roles
        : (group.roles ?? []);
      const editingRoles =
        Number(state.data.groupRolesOpenId) === Number(group.id);
      const editingName =
        Number(state.data.groupNameOpenId) === Number(group.id);
      const nameDraft = state.data.groupNameDrafts?.[group.id] ?? {};
      const nameErrors =
        Number(state.data.groupNameErrorId) === Number(group.id)
          ? violations(state.error?.body)
          : {};
      const childCreateOpen =
        Number(state.data.groupChildCreateOpenId) === Number(group.id);
      const childCreateForm = childCreateOpen
        ? renderGroupChildCreateForm(group)
        : "";
      const nameForm = editingName
        ? `<form class="card" data-form="admin-group-rename" data-group-id="${escapeHtml(group.id)}"><div class="field"><label for="group-name-${escapeHtml(group.id)}">${escapeHtml(text("adminGroupName"))}</label><input id="group-name-${escapeHtml(group.id)}" name="name" type="text" value="${escapeHtml(nameDraft.name ?? group.name ?? "")}" maxlength="100" required/><div class="field-error">${escapeHtml(nameErrors.name ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `group-name-update:${group.id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-group-name-cancel" data-id="${escapeHtml(group.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const roleForm = editingRoles
        ? `<form class="card" data-form="admin-group-roles" data-group-id="${escapeHtml(group.id)}"><fieldset class="field"><legend>${escapeHtml(text("adminEditGroupRoles"))}</legend>${roleCatalog.length ? roleCatalog.map((role) => `<label class="settings-row"><input type="checkbox" name="roles" value="${escapeHtml(role.name)}" ${selectedRoles.includes(role.name) ? "checked" : ""}/>${escapeHtml(role.name)}</label>`).join("") : `<div class="empty" role="status">${escapeHtml(text("adminNoRoles"))}</div>`}<div class="field-error">${escapeHtml(roleErrors.roles ?? "")}</div></fieldset><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `group-roles-update:${group.id}`, disabled: state.offline || Boolean(state.busy) || roleCatalog.length === 0 })}<button class="secondary-button" type="button" data-action="admin-group-roles-cancel" data-id="${escapeHtml(group.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      return `<article class="list-item" data-group-id="${escapeHtml(group.id)}"><div><strong>${escapeHtml(group.path || group.name)}</strong><span class="muted">${escapeHtml((group.effectiveRoles ?? group.roles ?? []).join(", "))}</span><span>${Number.isSafeInteger(group.userCount) ? group.userCount : 0}</span></div><div>${button(text("adminCreateChildGroup"), { action: "admin-group-child-create-toggle", id: group.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminEditGroupName"), { action: "admin-group-name-toggle", id: group.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminEditGroupRoles"), { action: "admin-group-roles-toggle", id: group.id, busy: state.busy === `group-role-catalog:${group.id}`, disabled: state.offline || Boolean(state.busy) })}${button(text("adminManageGroupMembers"), { action: "admin-group-members-toggle", id: group.id, busy: state.busy === `group-members:${group.id}`, disabled: Boolean(state.busy) })}${controls}</div>${childCreateForm}${nameForm}${roleForm}${memberPanel}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminGroups"))}"><form id="admin-group-search" class="actions" role="search"><input id="admin-group-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchGroups"))}" value="${escapeHtml(state.data.groupQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchGroups"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "groups-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "groups-search")}${escapeHtml(text("adminSearchGroups"))}</button></form>${groups.length ? `<div class="list">${rows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoGroups"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminGroups"))} pagination"><button class="secondary-button" type="button" data-group-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "groups-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-group-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "groups-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function renderGroupChildCreateForm(group) {
  const parentId = Number(group.id);
  const draft = state.data.groupChildCreateDrafts?.[parentId] ?? {};
  const errors =
    Number(state.data.groupChildCreateErrorId) === parentId
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `group-child-create:${parentId}`;
  const fieldId = `group-child-name-${parentId}`;
  return `<form class="card" data-form="admin-group-child-create" data-parent-id="${parentId}" novalidate><h3>${escapeHtml(text("adminCreateChildGroup"))}: ${escapeHtml(group.path || group.name)}</h3><div class="field"><label for="${fieldId}">${escapeHtml(text("adminGroupName"))}</label><input id="${fieldId}" name="name" type="text" value="${escapeHtml(draft.name ?? "")}" aria-invalid="${Boolean(errors.name)}" maxlength="100" autocomplete="off" required/><div class="field-error">${escapeHtml(errors.name ?? "")}</div></div><div class="actions">${button(text("adminCreateChildGroup"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-group-child-create-cancel" data-id="${parentId}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`;
}

function renderGroupMembers(groupId, memberState) {
  if (!memberState)
    return `<div class="notice" role="status">${escapeHtml(text("adminGroupMembers"))}…</div>`;
  const members = Array.isArray(memberState.members?.content)
    ? memberState.members.content
    : [];
  const available = Array.isArray(memberState.available?.content)
    ? memberState.available.content
    : [];
  const removeConfirmId = memberState.removeConfirmId;
  const memberRows = members.length
    ? members
        .map((user) => {
          const confirming = Number(removeConfirmId) === Number(user.id);
          const busy =
            state.busy === `group-member-remove:${groupId}:${user.id}`;
          return `<div class="list-item"><div><strong>${escapeHtml(user.username)}</strong><span>${escapeHtml(user.enabled ? text("adminUserEnabled") : text("adminUserDisabled"))}</span></div>${confirming ? `<div class="actions"><span role="status">${escapeHtml(text("adminRemoveGroupUserPrompt"))}</span>${button(text("adminRemoveGroupUser"), { action: "admin-group-member-remove-confirm", id: user.id, provider: groupId, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-group-member-remove-cancel" data-provider="${escapeHtml(groupId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>` : button(text("adminRemoveGroupUser"), { action: "admin-group-member-remove-request", id: user.id, provider: groupId, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoGroupMembers"))}</div>`;
  const availableRows = available.length
    ? available
        .map((user) => {
          const busy = state.busy === `group-member-add:${groupId}:${user.id}`;
          return `<div class="list-item"><div><strong>${escapeHtml(user.username)}</strong><span>${escapeHtml(user.enabled ? text("adminUserEnabled") : text("adminUserDisabled"))}</span></div>${button(text("adminAddGroupUser"), { action: "admin-group-member-add", id: user.id, provider: groupId, busy, disabled: state.offline || Boolean(state.busy) })}</div>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoAvailableUsers"))}</div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminGroupMembers"))}"><h3>${escapeHtml(text("adminGroupMembers"))}</h3>${memberRows}<h3>${escapeHtml(text("adminAvailableUsers"))}</h3>${availableRows}</section>`;
}

function adminGroupCreateContent() {
  const draft = state.data.adminGroupCreateDraft ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><form data-form="admin-group-create" novalidate>${field("name", text("adminGroupName"), draft.name ?? "", errors.name, "text", 'maxlength="100" autocomplete="off" required')}<div class="muted">${escapeHtml(text("adminGroupRootOnly"))}</div>${button(text("adminCreateGroup"), { type: "submit", busy: state.busy === "group-create", disabled: state.offline })}</form></section>`;
}

function clientScopeRoleOptions(scopeId, kind) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  const candidates = mapping?.[`${kind}Candidates`]?.content ?? [];
  const selected = mapping?.draft?.[kind] ?? [];
  if (kind === "applicationRoles") {
    const options = new Map(
      (mapping?.current?.applicationRoles ?? []).map((name) => [
        name,
        { name, description: "" },
      ]),
    );
    for (const role of candidates) options.set(role.name, role);
    for (const name of selected) {
      if (!options.has(name)) options.set(name, { name, description: "" });
    }
    return [...options.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }
  const options = new Map(
    (mapping?.current?.clientRoles ?? []).map((role) => [
      String(role.id),
      role,
    ]),
  );
  for (const role of candidates) options.set(String(role.id), role);
  for (const id of selected) {
    if (!options.has(String(id)))
      options.set(String(id), {
        id: Number(id),
        clientId: "",
        name: `#${id}`,
      });
  }
  return [...options.values()].sort(
    (left, right) =>
      left.clientId.localeCompare(right.clientId) ||
      left.name.localeCompare(right.name),
  );
}

function clientScopeRoleMappingPanel(scopeId) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  if (!mapping) return "";
  const applicationRoleDraft = mapping.draft?.applicationRoles ?? [];
  const clientRoleDraft = (mapping.draft?.clientRoleIds ?? []).map(String);
  const applicationRoles = clientScopeRoleOptions(scopeId, "applicationRoles");
  const clientRoles = clientScopeRoleOptions(scopeId, "clientRoleIds");
  const applicationPage = mapping.applicationRoleCandidates ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const clientPage = mapping.clientRoleCandidates ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const applicationQuery = mapping.applicationRoleQuery ?? "";
  const clientQuery = mapping.clientRoleQuery ?? "";
  const candidateList = (roles, kind, selected) =>
    roles.length
      ? roles
          .map((role) => {
            const value = kind === "applicationRoles" ? role.name : role.id;
            const label =
              kind === "applicationRoles"
                ? role.name
                : `${role.clientId ? `${role.clientId} · ` : ""}${role.name}`;
            const description = role.description
              ? `<span class="muted">${escapeHtml(role.description)}</span>`
              : "";
            return `<label class="settings-row"><span><strong>${escapeHtml(label)}</strong>${description}</span><input type="checkbox" name="${kind}" value="${escapeHtml(value)}" ${selected.some((entry) => String(entry) === String(value)) ? "checked" : ""}/></label>`;
          })
          .join("")
      : `<div class="empty" role="status">${escapeHtml(text(kind === "applicationRoles" ? "adminNoApplicationRoles" : "adminNoClientRoles"))}</div>`;
  return `<section class="card" data-client-scope-role-mappings-panel="true" data-scope-id="${escapeHtml(scopeId)}"><h3>${escapeHtml(text("adminClientScopeRoleMappings"))}</h3><fieldset><legend>${escapeHtml(text("adminApplicationRoles"))}</legend><form class="actions" data-form="admin-client-scope-role-candidate-search" data-scope-id="${escapeHtml(scopeId)}" data-role-kind="applicationRoles"><input type="search" name="q" aria-label="${escapeHtml(text("adminSearchApplicationRoles"))}" value="${escapeHtml(applicationQuery)}" maxlength="200"/><button class="secondary-button" type="submit" ${state.busy === `client-scope-role-candidates:${scopeId}:applicationRoles` ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === `client-scope-role-candidates:${scopeId}:applicationRoles`)}${escapeHtml(text("adminSearchRoleCandidates"))}</button></form>${candidateList(applicationRoles, "applicationRoles", applicationRoleDraft)}<div class="actions"><button class="secondary-button" type="button" data-client-scope-role-page="applicationRoles" data-scope-id="${escapeHtml(scopeId)}" data-page="${Number(applicationPage.number ?? 0) - 1}" ${Number(applicationPage.number ?? 0) <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === `client-scope-role-page:${scopeId}:applicationRoles`)}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${applicationPage.totalPages ? Number(applicationPage.number) + 1 : 0} / ${Number(applicationPage.totalPages ?? 0)}</span><button class="secondary-button" type="button" data-client-scope-role-page="applicationRoles" data-scope-id="${escapeHtml(scopeId)}" data-page="${Number(applicationPage.number ?? 0) + 1}" ${Number(applicationPage.number ?? 0) + 1 >= Number(applicationPage.totalPages ?? 0) || state.busy ? "disabled" : ""}>${spin(state.busy === `client-scope-role-page:${scopeId}:applicationRoles`)}${escapeHtml(text("adminNext"))}</button></div></fieldset><fieldset><legend>${escapeHtml(text("adminClientRoles"))}</legend><form class="actions" data-form="admin-client-scope-role-candidate-search" data-scope-id="${escapeHtml(scopeId)}" data-role-kind="clientRoleIds"><input type="search" name="q" aria-label="${escapeHtml(text("adminSearchClientRoles"))}" value="${escapeHtml(clientQuery)}" maxlength="200"/><button class="secondary-button" type="submit" ${state.busy === `client-scope-role-candidates:${scopeId}:clientRoleIds` ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === `client-scope-role-candidates:${scopeId}:clientRoleIds`)}${escapeHtml(text("adminSearchRoleCandidates"))}</button></form>${candidateList(clientRoles, "clientRoleIds", clientRoleDraft)}<div class="actions"><button class="secondary-button" type="button" data-client-scope-role-page="clientRoleIds" data-scope-id="${escapeHtml(scopeId)}" data-page="${Number(clientPage.number ?? 0) - 1}" ${Number(clientPage.number ?? 0) <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === `client-scope-role-page:${scopeId}:clientRoleIds`)}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${clientPage.totalPages ? Number(clientPage.number) + 1 : 0} / ${Number(clientPage.totalPages ?? 0)}</span><button class="secondary-button" type="button" data-client-scope-role-page="clientRoleIds" data-scope-id="${escapeHtml(scopeId)}" data-page="${Number(clientPage.number ?? 0) + 1}" ${Number(clientPage.number ?? 0) + 1 >= Number(clientPage.totalPages ?? 0) || state.busy ? "disabled" : ""}>${spin(state.busy === `client-scope-role-page:${scopeId}:clientRoleIds`)}${escapeHtml(text("adminNext"))}</button></div></fieldset><div class="actions">${button(text("save"), { action: "admin-client-scope-role-mappings-save", id: scopeId, busy: state.busy === `client-scope-role-mappings-save:${scopeId}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-role-mappings-cancel" data-id="${escapeHtml(scopeId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></section>`;
}

function clientScopeMappersPanel(scopeId) {
  if (state.data.clientScopeMappersOpenId !== scopeId) return "";
  const mappers = state.data.clientScopeMappers?.[scopeId] ?? [];
  const editor = state.data.clientScopeMapperEditor;
  const mapperId = editor?.scopeId === scopeId ? editor.mapperId : null;
  const mapper =
    mapperId === null
      ? null
      : mappers.find((item) => String(item.id) === mapperId);
  const draftKey = mapperId ?? "new";
  const draft = state.data.clientScopeMapperDrafts?.[scopeId]?.[draftKey] ?? {};
  const errorKey = `${scopeId}:${draftKey}`;
  const errors =
    state.data.clientScopeMapperErrorKey === errorKey
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `client-scope-mapper-save:${errorKey}`;
  const options = [
    "user-property",
    "user-attribute",
    "group-membership",
    "group-attribute",
    "application-role",
    "client-role",
    "audience",
    "audience-resolve",
    "hardcoded-claim",
    "email",
    "full-name",
    "locale",
    "username",
  ];
  const editorForm =
    editor?.scopeId === scopeId
      ? `<form class="card" data-form="admin-client-scope-mapper" data-scope-id="${escapeHtml(scopeId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(text(mapperId ? "adminEditClientScopeMapper" : "adminCreateClientScopeMapper"))}</h3>${field("name", text("adminClientScopeMapperName"), draft.name ?? mapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("source", text("adminClientScopeMapperSource"), draft.source ?? mapper?.source ?? "", errors.source, "text", 'maxlength="200"')}<div class="field"><label for="client-scope-mapper-type">${escapeHtml(text("adminClientScopeMapperType"))}</label><select id="client-scope-mapper-type" name="mapperType">${options.map((option) => `<option value="${option}" ${(draft.mapperType ?? mapper?.mapperType ?? "email") === option ? "selected" : ""}>${option}</option>`).join("")}</select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div>${field("claimName", text("adminClientScopeMapperClaim"), draft.claimName ?? mapper?.claimName ?? "email", errors.claimName, "text", 'maxlength="200"')}${field("value", text("adminClientScopeMapperValue"), draft.value ?? mapper?.value ?? "", errors.value, "text", 'maxlength="1000"')}${field("priority", text("adminClientScopeMapperPriority"), draft.priority ?? mapper?.priority ?? 100, errors.priority, "number", 'min="0" max="10000" step="1"')}<label class="settings-row"><input type="checkbox" name="addToIdToken" ${(draft.addToIdToken ?? mapper?.addToIdToken ?? true) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${(draft.addToAccessToken ?? mapper?.addToAccessToken ?? true) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-mapper-editor-cancel" data-id="${escapeHtml(scopeId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
      : "";
  const deleteConfirm = state.data.clientScopeMapperDeleteConfirm;
  const rows = mappers.length
    ? mappers
        .map((item) => {
          const confirming =
            deleteConfirm?.scopeId === scopeId &&
            deleteConfirm?.mapperId === String(item.id);
          const deleting =
            state.busy === `client-scope-mapper-delete:${scopeId}:${item.id}`;
          const controls = confirming
            ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientScopeMapperPrompt"))}</span>${button(text("adminDeleteClientScopeMapper"), { action: "admin-client-scope-mapper-delete-confirm", id: scopeId, mapper: item.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-mapper-delete-cancel" data-id="${escapeHtml(scopeId)}" data-mapper="${escapeHtml(item.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
            : `<div class="actions">${button(text("adminEditClientScopeMapper"), { action: "admin-client-scope-mapper-edit", id: scopeId, mapper: item.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteClientScopeMapper"), { action: "admin-client-scope-mapper-delete-request", id: scopeId, mapper: item.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
          return `<article class="list-item" data-client-scope-mapper-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span class="muted">${escapeHtml(`${item.mapperType} · ${item.claimName}`)}</span></div><span>${escapeHtml(text(item.addToIdToken ? "adminMapperAddToIdToken" : "adminMapperAddToAccessToken"))}</span>${controls}</article>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopeMappers"))}</div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminClientScopeMappers"))}"><div class="list">${rows}</div><div class="actions">${button(text("adminAddClientScopeMapper"), { action: "admin-client-scope-mapper-create", id: scopeId, disabled: state.offline || Boolean(state.busy) })}</div>${editorForm}</section>`;
}

function clientMappersPanel(clientId) {
  if (state.data.clientMappersOpenId !== clientId) return "";
  const mappers = state.data.clientMappers?.[clientId] ?? [];
  const editor = state.data.clientMapperEditor;
  const mapperId = editor?.clientId === clientId ? editor.mapperId : null;
  const mapper =
    mapperId === null
      ? null
      : mappers.find((item) => String(item.id) === mapperId);
  const draftKey = mapperId ?? "new";
  const draft = state.data.clientMapperDrafts?.[clientId]?.[draftKey] ?? {};
  const errorKey = `${clientId}:${draftKey}`;
  const errors =
    state.data.clientMapperErrorKey === errorKey
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `client-mapper-save:${errorKey}`;
  const options = [
    "user-property",
    "user-attribute",
    "group-membership",
    "group-attribute",
    "application-role",
    "client-role",
    "audience",
    "audience-resolve",
    "hardcoded-claim",
    "email",
    "full-name",
    "locale",
    "username",
  ];
  const editorForm =
    editor?.clientId === clientId
      ? `<form class="card" data-form="admin-client-mapper" data-client-id="${escapeHtml(clientId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(text(mapperId ? "adminEditClientMapper" : "adminCreateClientMapper"))}</h3>${field("name", text("adminClientMapperName"), draft.name ?? mapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("source", text("adminClientMapperSource"), draft.source ?? mapper?.source ?? "", errors.source, "text", 'maxlength="200"')}<div class="field"><label for="client-mapper-type">${escapeHtml(text("adminClientMapperType"))}</label><select id="client-mapper-type" name="mapperType">${options.map((option) => `<option value="${option}" ${(draft.mapperType ?? mapper?.mapperType ?? "email") === option ? "selected" : ""}>${option}</option>`).join("")}</select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div>${field("claimName", text("adminClientMapperClaim"), draft.claimName ?? mapper?.claimName ?? "email", errors.claimName, "text", 'maxlength="200"')}${field("value", text("adminClientMapperValue"), draft.value ?? mapper?.value ?? "", errors.value, "text", 'maxlength="1000"')}${field("priority", text("adminClientMapperPriority"), draft.priority ?? mapper?.priority ?? 100, errors.priority, "number", 'min="0" max="10000" step="1"')}<label class="settings-row"><input type="checkbox" name="addToIdToken" ${(draft.addToIdToken ?? mapper?.addToIdToken ?? true) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${(draft.addToAccessToken ?? mapper?.addToAccessToken ?? true) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-mapper-editor-cancel" data-id="${escapeHtml(clientId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
      : "";
  const deleteConfirm = state.data.clientMapperDeleteConfirm;
  const rows = mappers.length
    ? mappers
        .map((item) => {
          const confirming =
            deleteConfirm?.clientId === clientId &&
            deleteConfirm?.mapperId === String(item.id);
          const deleting =
            state.busy === `client-mapper-delete:${clientId}:${item.id}`;
          const controls = confirming
            ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientMapperPrompt"))}</span>${button(text("adminDeleteClientMapper"), { action: "admin-client-mapper-delete-confirm", id: clientId, mapper: item.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-mapper-delete-cancel" data-id="${escapeHtml(clientId)}" data-mapper="${escapeHtml(item.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
            : `<div class="actions">${button(text("adminEditClientMapper"), { action: "admin-client-mapper-edit", id: clientId, mapper: item.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteClientMapper"), { action: "admin-client-mapper-delete-request", id: clientId, mapper: item.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
          return `<article class="list-item" data-client-mapper-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span class="muted">${escapeHtml(`${item.mapperType} · ${item.claimName}`)}</span></div><span>${escapeHtml(text(item.addToIdToken ? "adminMapperAddToIdToken" : "adminMapperAddToAccessToken"))}</span>${controls}</article>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoClientMappers"))}</div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminClientMappers"))}"><div class="list">${rows}</div><div class="actions">${button(text("adminAddClientMapper"), { action: "admin-client-mapper-create", id: clientId, disabled: state.offline || Boolean(state.busy) })}</div>${editorForm}</section>`;
}

function adminClientScopesContent() {
  const page = state.data.clientScopes ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const scopes = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const errors = violations(state.error?.body);
  const scopeRows = scopes
    .map((scope) => {
      const draft = state.data.adminClientScopeDrafts?.[scope.id] ?? {};
      const scopeErrors =
        state.data.adminClientScopeErrorId === scope.id ? errors : {};
      const busy = state.busy === `client-scope-update:${scope.id}`;
      const deleting = state.busy === `client-scope-delete:${scope.id}`;
      const confirming = state.data.clientScopeDeleteConfirmId === scope.id;
      const displayNameId = `client-scope-display-name-${scope.id}`;
      const descriptionId = `client-scope-description-${scope.id}`;
      const metadata = scope.builtIn
        ? `<div><strong>${escapeHtml(scope.displayName || scope.name)}</strong><span class="muted">${escapeHtml(scope.description ?? scope.name)}</span></div>`
        : `<form class="actions" data-form="admin-client-scope-edit" data-scope-id="${escapeHtml(scope.id)}" data-scope-name="${escapeHtml(scope.name)}"><div class="field"><label for="${escapeHtml(displayNameId)}">${escapeHtml(text("adminClientScopeDisplayName"))}</label><input id="${escapeHtml(displayNameId)}" name="displayName" type="text" value="${escapeHtml(draft.displayName ?? scope.displayName ?? "")}" maxlength="200"/><div class="field-error">${escapeHtml(scopeErrors.displayName ?? "")}</div></div><div class="field"><label for="${escapeHtml(descriptionId)}">${escapeHtml(text("adminClientScopeDescription"))}</label><input id="${escapeHtml(descriptionId)}" name="description" type="text" value="${escapeHtml(draft.description ?? scope.description ?? "")}" maxlength="500"/><div class="field-error">${escapeHtml(scopeErrors.description ?? "")}</div></div>${button(text("save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}</form>`;
      const deleteControls = scope.builtIn
        ? ""
        : confirming
          ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientScopePrompt"))}</span>${button(text("adminDeleteClientScope"), { action: "admin-client-scope-delete-confirm", id: scope.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
          : `<div class="actions">${button(text("adminDeleteClientScope"), { action: "admin-client-scope-delete-request", id: scope.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const roleMappingsOpen =
        state.data.adminClientScopeRoleMappingsOpenId === scope.id;
      const roleMappingControls = scope.builtIn
        ? ""
        : `<div class="actions">${button(text("adminManageClientScopeRoles"), { action: "admin-client-scope-role-mappings-toggle", id: scope.id, busy: state.busy === `client-scope-role-mappings-load:${scope.id}`, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const roleMappingPanel = roleMappingsOpen
        ? clientScopeRoleMappingPanel(scope.id)
        : "";
      const mappersOpen = state.data.clientScopeMappersOpenId === scope.id;
      const mapperControls = scope.builtIn
        ? ""
        : `<div class="actions">${button(text("adminManageClientScopeMappers"), { action: "admin-client-scope-mappers-toggle", id: scope.id, busy: state.busy === `client-scope-mappers:${scope.id}`, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const mapperPanel = mappersOpen ? clientScopeMappersPanel(scope.id) : "";
      return `<article class="list-item" data-client-scope-id="${escapeHtml(scope.id)}">${metadata}<span>${escapeHtml(scope.builtIn ? text("adminBuiltIn") : text("adminCustom"))}</span>${deleteControls}${roleMappingControls}${roleMappingPanel}${mapperControls}${mapperPanel}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminClientScopes"))}"><form id="admin-client-scope-search" class="actions" role="search"><input id="admin-client-scope-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClientScopes"))}" value="${escapeHtml(state.data.clientScopeQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchClientScopes"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "client-scopes-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "client-scopes-search")}${escapeHtml(text("adminSearchClientScopes"))}</button></form>${scopes.length ? `<div class="list">${scopeRows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopes"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminClientScopes"))} pagination"><button class="secondary-button" type="button" data-client-scope-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-client-scope-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminClientScopeCreateContent() {
  const draft = state.data.adminClientScopeCreateDraft ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><form data-form="admin-client-scope-create" novalidate>${field("name", text("adminClientScopeName"), draft.name ?? "", errors.name, "text", 'maxlength="100" autocomplete="off" required')}${field("displayName", text("adminClientScopeDisplayName"), draft.displayName ?? "", errors.displayName, "text", 'maxlength="200"')}${field("description", text("adminClientScopeDescription"), draft.description ?? "", errors.description, "text", 'maxlength="500"')}<div class="muted">${escapeHtml(text("adminClientScopeDefaults"))}</div>${button(text("adminCreateClientScope"), { type: "submit", busy: state.busy === "client-scope-create", disabled: state.offline })}</form></section>`;
}

function clientScopeAssignmentsPanel(clientId) {
  if (state.data.clientScopeAssignmentsOpenId !== clientId) return "";
  const assignments = state.data.clientScopeAssignments?.[clientId];
  if (!assignments) return "";
  const draft =
    state.data.clientScopeAssignmentDrafts?.[clientId] ?? assignments;
  const defaults = Array.isArray(draft.defaultScopes)
    ? draft.defaultScopes
    : [];
  const optional = Array.isArray(draft.optionalScopes)
    ? draft.optionalScopes
    : [];
  const available = Array.isArray(assignments.availableScopes)
    ? assignments.availableScopes
    : [];
  const localError =
    state.data.clientScopeAssignmentErrorId === clientId
      ? text("adminClientScopeAssignmentRequired")
      : "";
  const rows = available
    .map((scope) => {
      const name = String(scope.name ?? "");
      if (!name || name.length > 100) return "";
      const inputId = `client-scope-assignment-${clientId}-${name}`;
      return `<article class="list-item"><div><strong>${escapeHtml(scope.displayName || name)}</strong><span class="muted">${escapeHtml(scope.description ?? name)}</span></div><label class="settings-row" for="${escapeHtml(`${inputId}-default`)}"><input id="${escapeHtml(`${inputId}-default`)}" type="checkbox" name="defaultScopes" value="${escapeHtml(name)}" ${defaults.includes(name) ? "checked" : ""}/>${escapeHtml(text("adminClientScopeDefault"))}</label><label class="settings-row" for="${escapeHtml(`${inputId}-optional`)}"><input id="${escapeHtml(`${inputId}-optional`)}" type="checkbox" name="optionalScopes" value="${escapeHtml(name)}" ${optional.includes(name) ? "checked" : ""}/>${escapeHtml(text("adminClientScopeOptional"))}</label></article>`;
    })
    .join("");
  return `<section class="card" data-client-scope-assignments-panel="true" data-client-id="${escapeHtml(clientId)}" aria-label="${escapeHtml(text("adminClientScopeAssignments"))}"><form data-form="admin-client-scope-assignments" data-client-id="${escapeHtml(clientId)}"><fieldset><legend>${escapeHtml(text("adminClientScopeAssignmentsHelp"))}</legend>${rows || `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopes"))}</div>`}</fieldset><div class="field-error" role="alert">${escapeHtml(localError)}</div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `client-scope-assignments-save:${clientId}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-assignments-cancel" data-id="${escapeHtml(clientId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function adminClientsContent() {
  const page = state.data.clients ?? { content: [], number: 0, totalPages: 0 };
  const clients = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const clientRows = clients
    .map((client) => {
      const id = String(client.id ?? "");
      const editing = state.data.clientMetadataEditId === id;
      const draft = state.data.clientMetadataDrafts?.[id] ?? {};
      const errors =
        state.data.clientMetadataErrorId === id
          ? violations(state.error?.body)
          : {};
      const editForm = editing
        ? `<form class="card" data-form="admin-client-native-metadata" data-client-id="${escapeHtml(id)}" novalidate>${field("clientName", text("adminClientName"), draft.clientName ?? client.clientName ?? "", errors.clientName, "text", 'maxlength="200" required')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `client-metadata-save:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-metadata-cancel" data-id="${escapeHtml(id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const assignmentsOpen = state.data.clientScopeAssignmentsOpenId === id;
      const assignmentsToggle = button(
        text("adminManageClientScopeAssignments"),
        {
          action: "admin-client-scope-assignments-toggle",
          id,
          busy: state.busy === `client-scope-assignments-load:${id}`,
          disabled: state.offline || Boolean(state.busy),
        },
      );
      const assignmentsPanel = assignmentsOpen
        ? clientScopeAssignmentsPanel(id)
        : "";
      const mappersOpen = state.data.clientMappersOpenId === id;
      const mappersToggle = button(text("adminManageClientMappers"), {
        action: "admin-client-mappers-toggle",
        id,
        busy: state.busy === `client-mappers-load:${id}`,
        disabled: state.offline || Boolean(state.busy),
      });
      const mappersPanel = mappersOpen ? clientMappersPanel(id) : "";
      const protectedClient = PLATFORM_CONSOLE_CLIENT_IDS.has(client.clientId);
      const confirming = state.data.clientDeleteConfirmId === id;
      const deleting = state.busy === `client-delete:${id}`;
      const deleteControls = protectedClient
        ? `<span>${escapeHtml(text("adminBuiltIn"))}</span>`
        : confirming
          ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientPrompt"))}</span>${button(text("adminDeleteClient"), { action: "admin-client-delete-confirm", id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-delete-cancel" data-id="${escapeHtml(id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
          : `<div class="actions">${button(text("adminDeleteClient"), { action: "admin-client-delete-request", id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item" data-client-id="${escapeHtml(id)}"><div><strong>${escapeHtml(client.clientName || client.clientId)}</strong><span class="muted">${escapeHtml(client.clientId)}</span><span class="muted">${escapeHtml((client.scopes ?? []).join(", "))}</span></div><span>${escapeHtml(client.requireProofKey ? text("adminConfigured") : text("adminUnconfigured"))}</span><div class="actions">${button(text("adminEditClientMetadata"), { action: "admin-client-metadata-edit", id, busy: state.busy === `client-metadata-load:${id}`, disabled: state.offline || Boolean(state.busy) })}${assignmentsToggle}${mappersToggle}</div>${editForm}${assignmentsPanel}${mappersPanel}${deleteControls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminClients"))}"><form id="admin-client-search" class="actions" role="search"><input id="admin-client-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClients"))}" value="${escapeHtml(state.data.clientQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchClients"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "clients-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "clients-search")}${escapeHtml(text("adminSearchClients"))}</button></form>${clients.length ? `<div class="list">${clientRows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoClients"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminClients"))} pagination"><button class="secondary-button" type="button" data-client-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "clients-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-client-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "clients-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function renderIdentityProviderMappers(providerId) {
  if (state.data.identityProviderMappersOpenId !== providerId) return "";
  const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
  if (!Array.isArray(mappers)) return "";
  const editor = state.data.providerMapperEditor;
  const mapperId = editor?.providerId === providerId ? editor.mapperId : null;
  const selectedMapper =
    mapperId === null ? null : mappers.find((mapper) => mapper.id === mapperId);
  const draftKey = mapperId ?? "new";
  const draft = state.data.providerMapperDrafts?.[providerId]?.[draftKey] ?? {};
  const errorKey = `${providerId}:${draftKey}`;
  const errors =
    state.data.providerMapperErrorKey === errorKey
      ? violations(state.error?.body)
      : {};
  const formBusy = state.busy === `provider-mapper-save:${errorKey}`;
  const mapperEditor =
    editor?.providerId === providerId
      ? `<form class="card" data-form="admin-provider-mapper" data-provider-id="${escapeHtml(providerId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(text(mapperId ? "adminEditProviderMapper" : "adminCreateProviderMapper"))}</h3>${field("name", text("adminProviderMapperName"), draft.name ?? selectedMapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("sourceClaim", text("adminProviderMapperSource"), draft.sourceClaim ?? selectedMapper?.sourceClaim ?? "", errors.sourceClaim, "text", 'maxlength="200" required')}${field("target", text("adminProviderMapperTarget"), draft.target ?? selectedMapper?.target ?? "", errors.target, "text", 'maxlength="200" required')}<div class="field"><label for="provider-mapper-type">${escapeHtml(text("adminProviderMapperType"))}</label><select id="provider-mapper-type" name="mapperType"><option value="user-attribute" ${(draft.mapperType ?? selectedMapper?.mapperType ?? "user-attribute") === "user-attribute" ? "selected" : ""}>user-attribute</option><option value="claim" ${(draft.mapperType ?? selectedMapper?.mapperType) === "claim" ? "selected" : ""}>claim</option><option value="role" ${(draft.mapperType ?? selectedMapper?.mapperType) === "role" ? "selected" : ""}>role</option><option value="group" ${(draft.mapperType ?? selectedMapper?.mapperType) === "group" ? "selected" : ""}>group</option></select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div><div class="field"><label for="provider-mapper-sync-mode">${escapeHtml(text("adminProviderMapperSyncMode"))}</label><select id="provider-mapper-sync-mode" name="syncMode"><option value="inherit" ${(draft.syncMode ?? selectedMapper?.syncMode ?? "inherit") === "inherit" ? "selected" : ""}>inherit</option><option value="legacy" ${(draft.syncMode ?? selectedMapper?.syncMode) === "legacy" ? "selected" : ""}>legacy</option><option value="import" ${(draft.syncMode ?? selectedMapper?.syncMode) === "import" ? "selected" : ""}>import</option><option value="read_only" ${(draft.syncMode ?? selectedMapper?.syncMode) === "read_only" ? "selected" : ""}>read_only</option><option value="force" ${(draft.syncMode ?? selectedMapper?.syncMode) === "force" ? "selected" : ""}>force</option></select><div class="field-error">${escapeHtml(errors.syncMode ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="addToIdToken" ${(draft.addToIdToken ?? selectedMapper?.addToIdToken) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${(draft.addToAccessToken ?? selectedMapper?.addToAccessToken) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy: formBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-provider-mapper-editor-cancel" data-provider="${escapeHtml(providerId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
      : "";
  const addMapperButton = button(text("adminAddProviderMapper"), {
    action: "admin-provider-mapper-create",
    provider: providerId,
    disabled: state.offline || Boolean(state.busy),
  });
  return `<section class="card" aria-label="${escapeHtml(text("adminProviderMappers"))}"><div class="list">${
    mappers.length
      ? mappers
          .map((mapper) => {
            const confirmation = state.data.providerMapperDeleteConfirm;
            const confirming =
              confirmation?.providerId === providerId &&
              confirmation?.mapperId === mapper.id;
            const busy =
              state.busy ===
              `provider-mapper-delete:${providerId}:${mapper.id}`;
            const controls = confirming
              ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteProviderMapperPrompt"))}</span>${button(text("adminDeleteProviderMapper"), { action: "admin-provider-mapper-delete-confirm", provider: providerId, id: mapper.id, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-provider-mapper-delete-cancel" data-provider="${escapeHtml(providerId)}" data-id="${escapeHtml(mapper.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
              : `<div class="actions">${button(text("adminEditProviderMapper"), { action: "admin-provider-mapper-edit", provider: providerId, id: mapper.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteProviderMapper"), { action: "admin-provider-mapper-delete-request", provider: providerId, id: mapper.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
            return `<article class="list-item" data-provider-mapper-id="${escapeHtml(mapper.id)}"><div><strong>${escapeHtml(mapper.name)}</strong><span class="muted">${escapeHtml(`${mapper.sourceClaim} → ${mapper.target} · ${mapper.mapperType}`)}</span></div><span>${escapeHtml(mapper.syncMode)}</span>${controls}</article>`;
          })
          .join("")
      : `<div class="empty" role="status">${escapeHtml(text("adminNoProviderMappers"))}</div>`
  }</div><div class="actions">${addMapperButton}</div>${mapperEditor}</section>`;
}

function adminIdentityProvidersContent() {
  const page = state.data.identityProviders ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const providers = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  return `<section class="card" aria-label="${escapeHtml(text("adminIdentityProviders"))}"><form id="admin-identity-provider-search" class="actions" role="search"><input id="admin-identity-provider-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchIdentityProviders"))}" value="${escapeHtml(state.data.identityProviderQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchIdentityProviders"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "identity-providers-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "identity-providers-search")}${escapeHtml(text("adminSearchIdentityProviders"))}</button></form>${
    providers.length
      ? `<div class="list">${providers
          .map((provider) => {
            const id = String(provider.id ?? "");
            const policy = state.data.identityProviderPolicies?.[id];
            const editingPolicy =
              state.data.identityProviderPolicyOpenId === id;
            const policyDraft =
              state.data.identityProviderPolicyDrafts?.[id] ?? policy ?? {};
            const policyErrors =
              state.data.identityProviderPolicyErrorId === id
                ? violations(state.error?.body)
                : {};
            const confirming =
              state.data.identityProviderDeleteConfirmId === id;
            const controls = confirming
              ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteIdentityProviderPrompt"))}</span>${button(text("adminDeleteIdentityProvider"), { action: "admin-identity-provider-delete-confirm", id, danger: true, busy: state.busy === `identity-provider-delete:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-identity-provider-delete-cancel" data-id="${escapeHtml(id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
              : `<div class="actions">${button(text("adminDeleteIdentityProvider"), { action: "admin-identity-provider-delete-request", id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
            const policyForm =
              editingPolicy && policy
                ? `<form class="card" data-form="admin-identity-provider-policy" data-provider-id="${escapeHtml(id)}"><div class="field"><label for="provider-policy-name-${escapeHtml(id)}">${escapeHtml(text("adminProviderDisplayName"))}</label><input id="provider-policy-name-${escapeHtml(id)}" name="displayName" type="text" value="${escapeHtml(policyDraft.displayName ?? policy.displayName)}" maxlength="100" required/><div class="field-error">${escapeHtml(policyErrors.displayName ?? "")}</div></div><label class="settings-row"><span>${escapeHtml(text("adminProviderEnabled"))}</span><input name="enabled" type="checkbox" ${(policyDraft.enabled ?? policy.enabled) ? "checked" : ""}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderHideOnLogin"))}</span><input name="hideOnLogin" type="checkbox" ${(policyDraft.hideOnLogin ?? policy.hideOnLogin) ? "checked" : ""}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderLinkingOnly"))}</span><input name="accountLinkingOnly" type="checkbox" ${(policyDraft.accountLinkingOnly ?? policy.accountLinkingOnly) ? "checked" : ""}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderTrustEmail"))}</span><input name="trustEmail" type="checkbox" ${(policyDraft.trustEmail ?? policy.trustEmail) ? "checked" : ""}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderRequireMfa"))}</span><input name="mfaRequired" type="checkbox" ${(policyDraft.mfaRequired ?? policy.mfaRequired) ? "checked" : ""}/></label><div class="field"><label for="provider-policy-order-${escapeHtml(id)}">${escapeHtml(text("adminProviderOrder"))}</label><input id="provider-policy-order-${escapeHtml(id)}" name="guiOrder" type="number" min="0" max="2147483647" value="${escapeHtml(policyDraft.guiOrder ?? policy.guiOrder)}" required/><div class="field-error">${escapeHtml(policyErrors.guiOrder ?? "")}</div></div><div class="field"><label for="provider-policy-visibility-${escapeHtml(id)}">${escapeHtml(text("adminProviderAccountVisibility"))}</label><select id="provider-policy-visibility-${escapeHtml(id)}" name="showInAccountConsole"><option value="always" ${(policyDraft.showInAccountConsole ?? policy.showInAccountConsole) === "always" ? "selected" : ""}>${escapeHtml(text("adminProviderAlways"))}</option><option value="when-linked" ${(policyDraft.showInAccountConsole ?? policy.showInAccountConsole) === "when-linked" ? "selected" : ""}>${escapeHtml(text("adminProviderWhenLinked"))}</option><option value="never" ${(policyDraft.showInAccountConsole ?? policy.showInAccountConsole) === "never" ? "selected" : ""}>${escapeHtml(text("adminProviderNever"))}</option></select><div class="field-error">${escapeHtml(policyErrors.showInAccountConsole ?? "")}</div></div><div class="field"><label for="provider-policy-sync-${escapeHtml(id)}">${escapeHtml(text("adminProviderSyncMode"))}</label><select id="provider-policy-sync-${escapeHtml(id)}" name="syncMode"><option value="legacy" ${(policyDraft.syncMode ?? policy.syncMode) === "legacy" ? "selected" : ""}>legacy</option><option value="import" ${(policyDraft.syncMode ?? policy.syncMode) === "import" ? "selected" : ""}>import</option><option value="read_only" ${(policyDraft.syncMode ?? policy.syncMode) === "read_only" ? "selected" : ""}>read_only</option><option value="force" ${(policyDraft.syncMode ?? policy.syncMode) === "force" ? "selected" : ""}>force</option></select><div class="field-error">${escapeHtml(policyErrors.syncMode ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `identity-provider-policy-save:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-identity-provider-policy-cancel" data-id="${escapeHtml(id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`
                : "";
            const mapperBusy = state.busy === `provider-mappers:${id}`;
            const mapperButton = button(text("adminManageProviderMappers"), {
              action: "admin-provider-mappers-toggle",
              id,
              busy: mapperBusy,
              disabled: state.offline || Boolean(state.busy),
            });
            const mapperPanel = renderIdentityProviderMappers(id);
            return `<article class="list-item" data-identity-provider-id="${escapeHtml(id)}"><div><strong>${escapeHtml(provider.displayName || provider.alias)}</strong><span class="muted">${escapeHtml(`${provider.providerType} · ${provider.alias}`)}</span><span class="muted">${escapeHtml(`${provider.mapperCount} ${text("adminProviderMappers")}`)}</span></div><span>${escapeHtml(provider.enabled ? text("adminProviderEnabled") : text("adminProviderDisabled"))} · ${escapeHtml(provider.configured ? text("adminConfigured") : text("adminUnconfigured"))}</span><div class="actions">${button(text("adminEditProviderPolicy"), { action: "admin-identity-provider-policy-toggle", id, busy: state.busy === `identity-provider-policy-load:${id}`, disabled: state.offline || Boolean(state.busy) })}${mapperButton}${controls}</div>${policyForm}${mapperPanel}</article>`;
          })
          .join("")}</div>`
      : `<div class="empty" role="status">${escapeHtml(text("adminNoIdentityProviders"))}</div>`
  }<div class="actions" aria-label="${escapeHtml(text("adminIdentityProviders"))} pagination"><button class="secondary-button" type="button" data-identity-provider-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-identity-provider-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminSessionsContent() {
  const page = state.data.adminSessions ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const sessions = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const rows = sessions
    .map((session, index) => {
      const confirming = state.data.adminSessionDeleteConfirmId === session.id;
      const busy = state.busy === `admin-session-delete:${index}`;
      const controls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminSessionDeleteConfirm"))}</span>${button(text("adminSessionDelete"), { action: "admin-session-delete-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-session-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminSessionDelete"), { action: "admin-session-delete-request", index, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item"><div><strong>${escapeHtml(session.username)}</strong><span class="muted">${Number.isSafeInteger(session.authorizationCount) ? session.authorizationCount : 0} ${escapeHtml(text("adminAuthorizations"))}</span></div><span>${escapeHtml(session.active ? text("adminActive") : text("adminExpired"))}</span>${controls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminSessions"))}"><form id="admin-session-search" class="actions" role="search"><input id="admin-session-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchSessions"))}" value="${escapeHtml(state.data.adminSessionQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchSessions"))}" maxlength="200"/><select id="admin-session-status" name="status" aria-label="${escapeHtml(text("adminSessions"))}"><option value="active" ${state.data.adminSessionStatus !== "expired" ? "selected" : ""}>${escapeHtml(text("adminActive"))}</option><option value="expired" ${state.data.adminSessionStatus === "expired" ? "selected" : ""}>${escapeHtml(text("adminExpired"))}</option></select><button class="primary-button" type="submit" ${state.busy === "admin-sessions-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-sessions-search")}${escapeHtml(text("adminSearchSessions"))}</button></form>${sessions.length ? `<div class="list">${rows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoSessions"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminSessions"))} pagination"><button class="secondary-button" type="button" data-admin-session-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-sessions-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-session-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-sessions-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminConsentsContent() {
  const page = state.data.adminConsents ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const consents = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const rows = consents
    .map((consent, index) => {
      const consentKey = JSON.stringify([
        consent.clientId,
        consent.principalName,
      ]);
      const confirming = state.data.consentRevokeConfirmKey === consentKey;
      const busy = state.busy === `admin-consent-revoke:${index}`;
      const controls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminConsentRevokeConfirm"))}</span>${button(text("adminConsentRevoke"), { action: "admin-consent-revoke-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-consent-revoke-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminConsentRevoke"), { action: "admin-consent-revoke-request", index, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item"><div><strong>${escapeHtml(consent.clientName || consent.clientId)}</strong><span class="muted">${escapeHtml(consent.principalName)}</span><span class="muted">${escapeHtml((consent.authorities ?? []).join(", "))}</span></div>${controls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminConsents"))}"><form id="admin-consent-search" class="actions" role="search"><input id="admin-consent-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchConsents"))}" value="${escapeHtml(state.data.adminConsentQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchConsents"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "admin-consents-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-consents-search")}${escapeHtml(text("adminSearchConsents"))}</button></form>${consents.length ? `<div class="list">${rows}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoConsents"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminConsents"))} pagination"><button class="secondary-button" type="button" data-admin-consent-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-consents-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-consent-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-consents-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminOfflineSessionsContent() {
  const page = state.data.adminOfflineSessions ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const sessions = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const rows = sessions
    .map((session, index) => {
      const confirming =
        state.data.offlineSessionDeleteConfirmId === session.id;
      const busy = state.busy === `admin-offline-session-delete:${index}`;
      const controls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminOfflineSessionRevokePrompt"))}</span>${button(text("adminRevokeOfflineSession"), { action: "admin-offline-session-revoke-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-offline-session-revoke-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminRevokeOfflineSession"), { action: "admin-offline-session-revoke-request", index, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item"><div><strong>${escapeHtml(session.clientName || session.clientId)}</strong><span class="muted">${escapeHtml(session.username)}</span></div>${controls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminOfflineSessions"))}">${sessions.length ? `<div class="list">${rows}</div>` : `<div class="empty" role="status">${escapeHtml(text("offlineSessionsEmpty"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminOfflineSessions"))} pagination"><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminEventsContent() {
  const page = state.data.adminEvents ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const events = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  return `<section class="card" aria-label="${escapeHtml(text("adminEvents"))}"><form id="admin-event-search" class="actions" role="search"><input id="admin-event-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchEvents"))}" value="${escapeHtml(state.data.adminEventQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchEvents"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "admin-events-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-events-search")}${escapeHtml(text("adminSearchEvents"))}</button></form>${events.length ? `<div class="list">${events.map((event) => `<article class="list-item"><div><strong>${escapeHtml(event.action)}</strong><span class="muted">${escapeHtml(`${event.actor} · ${event.targetType} ${event.targetId}`)}</span></div><time datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(new Date(event.occurredAt).toLocaleString(state.locale === "tr" ? "tr-TR" : "en-US"))}</time></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoEvents"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminEvents"))} pagination"><button class="secondary-button" type="button" data-admin-event-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-events-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-event-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-events-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminKeysContent() {
  const page = state.data.adminKeys ?? {
    content: [],
    number: 0,
    totalPages: 0,
  };
  const keys = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const rotateConfirm = state.data.adminKeyRotateConfirm
    ? `<div class="actions"><span role="status">${escapeHtml(text("adminRotateSigningKeyConfirm"))}</span>${button(text("adminRotateSigningKeyNow"), { action: "admin-key-rotate-confirm", danger: true, busy: state.busy === "admin-key-rotate", mutation: true })}<button class="secondary-button" type="button" data-action="admin-key-rotate-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
    : `<div class="actions">${button(text("adminRotateSigningKey"), { action: "admin-key-rotate-request", mutation: true })}</div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminKeys"))}"><form id="admin-key-search" class="actions" role="search"><input id="admin-key-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchKeys"))}" value="${escapeHtml(state.data.adminKeyQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchKeys"))}" maxlength="200"/><select id="admin-key-active" name="active" aria-label="${escapeHtml(text("adminKeys"))}"><option value="all" ${state.data.adminKeyActive === "all" ? "selected" : ""}>${escapeHtml(text("adminKeys"))}</option><option value="true" ${state.data.adminKeyActive !== "all" && state.data.adminKeyActive !== "false" ? "selected" : ""}>${escapeHtml(text("adminKeyActive"))}</option><option value="false" ${state.data.adminKeyActive === "false" ? "selected" : ""}>${escapeHtml(text("adminKeyInactive"))}</option></select><button class="primary-button" type="submit" ${state.busy === "admin-keys-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-keys-search")}${escapeHtml(text("adminSearchKeys"))}</button></form>${rotateConfirm}${keys.length ? `<div class="list">${keys.map((key) => `<article class="list-item"><div><strong>${escapeHtml(key.kid)}</strong><span class="muted">${escapeHtml(`${key.type} · ${key.algorithm} · ${key.use}`)}</span></div><span>${escapeHtml(key.active ? text("adminKeyActive") : text("adminKeyInactive"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoKeys"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminKeys"))} pagination"><button class="secondary-button" type="button" data-admin-key-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-keys-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-key-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-keys-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminPoliciesContent() {
  const ciba = state.data.cibaPolicy ?? {};
  const offline = state.data.offlineAccessPolicy ?? {};
  const cibaDraft = state.data.cibaPolicyDraft ?? ciba;
  const offlineDraft = state.data.offlineAccessPolicyDraft ?? offline;
  const errors = violations(state.error?.body);
  const revokeBusy = state.busy === "admin-offline-access-revoke";
  const revokeAll = state.data.offlineAccessRevokeConfirm
    ? `<div class="actions"><span role="status">${escapeHtml(text("adminRevokeAllOfflineTokensConfirm"))}</span>${button(text("adminRevokeAllOfflineTokens"), { action: "admin-offline-access-revoke-confirm", danger: true, busy: revokeBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-offline-access-revoke-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
    : `<div class="settings-row"><div><strong>${escapeHtml(text("adminRevokeAllOfflineTokensTitle"))}</strong><p class="muted">${escapeHtml(text("adminRevokeAllOfflineTokensHelp"))}</p></div>${button(text("adminRevokeAllOfflineTokens"), { action: "admin-offline-access-revoke-request", danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminCibaPolicy"))}"><h2>${escapeHtml(text("adminCibaPolicy"))}</h2><form data-form="admin-ciba-policy" novalidate>${field("requestLifespanSeconds", text("adminRequestLifespan"), cibaDraft.requestLifespanSeconds ?? "", errors.requestLifespanSeconds, "number", 'min="30" max="3600" required')}${field("pollingIntervalSeconds", text("adminPollingInterval"), cibaDraft.pollingIntervalSeconds ?? "", errors.pollingIntervalSeconds, "number", 'min="1" max="300" required')}<div class="field"><label for="deliveryMode">${escapeHtml(text("adminDeliveryMode"))}</label><select id="deliveryMode" name="deliveryMode"><option value="all" ${cibaDraft.deliveryMode === "all" ? "selected" : ""}>all</option><option value="poll" ${cibaDraft.deliveryMode === "poll" ? "selected" : ""}>poll</option><option value="ping" ${cibaDraft.deliveryMode === "ping" ? "selected" : ""}>ping</option><option value="push" ${cibaDraft.deliveryMode === "push" ? "selected" : ""}>push</option></select><div class="field-error">${escapeHtml(errors.deliveryMode ?? "")}</div></div><div class="field"><label for="userVerification">${escapeHtml(text("adminUserVerification"))}</label><select id="userVerification" name="userVerification"><option value="required" ${cibaDraft.userVerification === "required" ? "selected" : ""}>required</option><option value="preferred" ${cibaDraft.userVerification === "preferred" ? "selected" : ""}>preferred</option><option value="discouraged" ${cibaDraft.userVerification === "discouraged" ? "selected" : ""}>discouraged</option></select><div class="field-error">${escapeHtml(errors.userVerification ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="mfaRequired" ${cibaDraft.mfaRequired ? "checked" : ""}/>${escapeHtml(text("adminMfaRequired"))}</label><label class="settings-row"><input type="checkbox" name="stepUpRequired" ${cibaDraft.stepUpRequired ? "checked" : ""}/>${escapeHtml(text("adminStepUpRequired"))}</label>${field("stepUpAcr", text("adminStepUpAcr"), cibaDraft.stepUpAcr ?? "", errors.stepUpAcr, "text", 'maxlength="100"')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-ciba-policy", disabled: state.offline })}</div></form></section><section class="card" aria-label="${escapeHtml(text("adminOfflineAccessPolicy"))}"><h2>${escapeHtml(text("adminOfflineAccessPolicy"))}</h2><form data-form="admin-offline-access-policy" novalidate>${field("idleTimeout", text("adminIdleTimeout"), offlineDraft.idleTimeout ?? "", errors.idleTimeout, "text", 'required placeholder="P30D"')}${field("maxLifespan", text("adminMaxLifespan"), offlineDraft.maxLifespan ?? "", errors.maxLifespan, "text", 'placeholder="P180D"')}<div class="field"><label class="settings-row"><input type="checkbox" name="maxLimited" ${offlineDraft.maxLimited ? "checked" : ""}/>${escapeHtml(text("adminMaxLimited"))}</label><div class="field-error">${escapeHtml(errors.maxLimited ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-offline-access-policy", disabled: state.offline })}</div></form><div class="actions">${revokeAll}</div></section></div>`;
}

function adminAdminConfigurationContent() {
  const branding = state.data.adminBranding ?? {};
  const brandingDraft = state.data.adminBrandingDraft ?? branding;
  const brandingErrors = violations(state.error?.body);
  const server = state.data.adminServerInfo ?? {};
  const row = (label, value) =>
    `<div class="list-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value ?? text("adminNotConfigured"))}</span></div>`;
  const endpoints = [
    ["adminIssuer", server.issuer],
    ["adminDiscoveryEndpoint", server.discoveryEndpoint],
    ["adminAuthorizationEndpoint", server.authorizationEndpoint],
    ["adminTokenEndpoint", server.tokenEndpoint],
    ["adminIntrospectionEndpoint", server.introspectionEndpoint],
    ["adminRevocationEndpoint", server.revocationEndpoint],
    ["adminJwksEndpoint", server.jwksEndpoint],
    ["adminUserInfoEndpoint", server.userInfoEndpoint],
    ["adminEndSessionEndpoint", server.endSessionEndpoint],
    ["adminSessionTimeout", server.sessionTimeout],
  ];
  const activeKey = server.activeSigningKey;
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminBranding"))}"><h2>${escapeHtml(text("adminBranding"))}</h2><div class="list">${row(text("adminLogoPath"), branding.logoPath)}${row(text("adminFaviconPath"), branding.faviconPath)}${row(text("adminAppleTouchIconPath"), branding.appleTouchIconPath)}</div><form data-form="admin-branding" novalidate>${field("applicationName", text("adminApplicationName"), brandingDraft.applicationName ?? "", brandingErrors.applicationName, "text", 'maxlength="100" required')}${field("primaryColor", text("adminPrimaryColor"), brandingDraft.primaryColor ?? "", brandingErrors.primaryColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}${field("accentColor", text("adminAccentColor"), brandingDraft.accentColor ?? "", brandingErrors.accentColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}${field("backgroundColor", text("adminBackgroundColor"), brandingDraft.backgroundColor ?? "", brandingErrors.backgroundColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-branding", disabled: state.offline })}</div></form></section><section class="card" aria-label="${escapeHtml(text("adminServerInfo"))}"><h2>${escapeHtml(text("adminServerInfo"))}</h2><div class="list">${endpoints.map(([key, value]) => row(text(key), value)).join("")}${activeKey ? row(text("adminActiveSigningKey"), `${activeKey.kid} · ${activeKey.type} · ${activeKey.algorithm} · ${activeKey.use}`) : ""}</div></section></div>`;
}

function adminAdminLoginEmailContent() {
  const login = state.data.adminLoginSettings ?? {};
  const loginDraft = state.data.adminLoginSettingsDraft ?? login;
  const loginErrors = violations(state.error?.body);
  const email = state.data.adminEmailSettings ?? {};
  const emailDraft = state.data.adminEmailDraft ?? email;
  const errors = violations(state.error?.body);
  const loginCard = `<section class="card" aria-label="${escapeHtml(text("adminLoginPolicy"))}"><h2>${escapeHtml(text("adminLoginPolicy"))}</h2><form data-form="admin-login-settings" novalidate><label class="settings-row"><input type="checkbox" name="userRegistration" ${loginDraft.userRegistration ? "checked" : ""}/>${escapeHtml(text("adminRegistrationEnabled"))}</label><label class="settings-row"><input type="checkbox" name="forgotPassword" ${loginDraft.forgotPassword ? "checked" : ""}/>${escapeHtml(text("adminForgotPasswordEnabled"))}</label><label class="settings-row"><input type="checkbox" name="rememberMe" ${loginDraft.rememberMe ? "checked" : ""}/>${escapeHtml(text("adminRememberMeEnabled"))}</label><label class="settings-row"><input type="checkbox" name="loginWithEmail" ${loginDraft.loginWithEmail ? "checked" : ""}/>${escapeHtml(text("adminLoginWithEmail"))}</label><label class="settings-row"><input type="checkbox" name="verifyEmail" ${loginDraft.verifyEmail ? "checked" : ""}/>${escapeHtml(text("adminVerifyEmail"))}</label>${field("sessionTimeoutMinutes", text("adminSessionTimeout"), loginDraft.sessionTimeoutMinutes ?? "", loginErrors.sessionTimeoutMinutes, "number", 'min="1" max="1440" required')}${field("passwordMinimumLength", text("adminPasswordLength"), loginDraft.passwordMinimumLength ?? "", loginErrors.passwordMinimumLength, "number", 'min="8" max="128" required')}<label class="settings-row"><input type="checkbox" name="bruteForceEnabled" ${loginDraft.bruteForceEnabled ? "checked" : ""}/>${escapeHtml(text("adminBruteForceProtection"))}</label>${field("bruteForceMaxFailures", text("adminLoginFailureLimit"), loginDraft.bruteForceMaxFailures ?? "", loginErrors.bruteForceMaxFailures, "number", 'min="1" max="100" required')}<label class="settings-row"><input type="checkbox" name="otpEnabled" ${loginDraft.otpEnabled ? "checked" : ""}/>${escapeHtml(text("adminOtpEnabled"))}</label><label class="settings-row"><input type="checkbox" name="otpRequired" ${loginDraft.otpRequired ? "checked" : ""}/>${escapeHtml(text("adminOtpRequired"))}</label><div class="field-error">${escapeHtml(loginErrors.otpRequired ?? "")}</div><label class="settings-row"><input type="checkbox" name="passkeys" ${loginDraft.passkeys ? "checked" : ""}/>${escapeHtml(text("adminPasskeysEnabled"))}</label><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-login-settings", disabled: state.offline })}</div></form></section>`;
  return `<div class="grid two-col">${loginCard}<section class="card" aria-label="${escapeHtml(text("adminEmailDelivery"))}"><h2>${escapeHtml(text("adminEmailDelivery"))}</h2><form data-form="admin-email-settings" novalidate><label class="settings-row"><input type="checkbox" name="enabled" ${emailDraft.enabled ? "checked" : ""}/>${escapeHtml(text("adminEmailEnabled"))}</label>${field("fromAddress", text("adminEmailFromAddress"), emailDraft.fromAddress ?? "", errors.fromAddress, "email", 'required maxlength="255"')}${field("baseUrl", text("adminEmailBaseUrl"), emailDraft.baseUrl ?? "", errors.baseUrl, "url", 'required maxlength="255"')}${field("host", text("adminEmailHost"), emailDraft.host ?? "", errors.host, "text", 'required maxlength="255"')}${field("port", text("adminSmtpPort"), emailDraft.port ?? "", errors.port, "number", 'min="1" max="65535" required')}${field("username", text("adminSmtpUsername"), emailDraft.username && emailDraft !== email ? emailDraft.username : "", errors.username, "text", 'maxlength="255"')}${field("password", text("adminSmtpPassword"), "", errors.password, "password", 'maxlength="1000" autocomplete="new-password"')}<label class="settings-row"><input type="checkbox" name="smtpAuth" ${emailDraft.smtpAuth ? "checked" : ""}/>${escapeHtml(text("adminSmtpAuthentication"))}</label><label class="settings-row"><input type="checkbox" name="starttls" ${emailDraft.starttls ? "checked" : ""}/>${escapeHtml(text("adminStartTls"))}</label><label class="settings-row"><input type="checkbox" name="ssl" ${emailDraft.ssl ? "checked" : ""}/>${escapeHtml(text("adminSslTls"))}</label><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-email-settings", disabled: state.offline })}</div></form></section></div>`;
}

function adminAdminLocalizationContent() {
  const settings = state.data.adminLocalization ?? {};
  const page = state.data.adminMessageOverrides ?? { content: [] };
  const overrides = Array.isArray(page.content) ? page.content : [];
  const drafts = state.data.adminMessageOverrideDrafts ?? {};
  const localizationDraft = state.data.adminLocalizationDraft ?? settings;
  const errors = violations(state.error?.body);
  const messageErrorTarget = state.data.adminMessageOverrideErrorTarget;
  const row = (label, value) =>
    `<div class="list-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value ?? text("adminNotConfigured"))}</span></div>`;
  const list = (values) => (Array.isArray(values) ? values.join(", ") : null);
  const availableLocales = Array.isArray(settings.availableLocales)
    ? settings.availableLocales
    : ["en", "tr"];
  const supportedLocales = Array.isArray(localizationDraft.supportedLocales)
    ? localizationDraft.supportedLocales
    : [];
  const availableBundles = [
    ...new Set([
      ...(Array.isArray(settings.availableBundles)
        ? settings.availableBundles
        : []),
      ...overrides.map((item) => item.bundle).filter(Boolean),
    ]),
  ];
  const localizationSettingsForm = `<form data-form="admin-localization-settings" novalidate><label class="settings-row"><input type="checkbox" name="internationalizationEnabled" ${localizationDraft.internationalizationEnabled ? "checked" : ""}/>${escapeHtml(text("adminLocalizationEnabled"))}</label><div class="field"><label for="localizationDefaultLocale">${escapeHtml(text("adminDefaultLocale"))}</label><select id="localizationDefaultLocale" name="defaultLocale">${availableLocales.map((locale) => `<option value="${escapeHtml(locale)}" ${localizationDraft.defaultLocale === locale ? "selected" : ""}>${escapeHtml(locale)}</option>`).join("")}</select><div class="field-error">${escapeHtml(errors.defaultLocale ?? "")}</div></div><fieldset class="field"><legend>${escapeHtml(text("adminSupportedLocales"))}</legend>${availableLocales.map((locale) => `<label class="settings-row"><input type="checkbox" name="supportedLocales" value="${escapeHtml(locale)}" ${supportedLocales.includes(locale) ? "checked" : ""}/>${escapeHtml(locale)}</label>`).join("")}<div class="field-error">${escapeHtml(errors.supportedLocales ?? "")}</div></fieldset><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-localization-settings", disabled: state.offline })}</div></form>`;
  const overrideField = (item, name, label, value, error) => {
    const id = `override-${item.id}-${name}`;
    return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" name="${name}" value="${escapeHtml(value ?? "")}" aria-invalid="${Boolean(error)}" required maxlength="${name === "messageValue" ? 4000 : name === "locale" ? 10 : name === "bundle" ? 50 : 255}"/><div class="field-error" id="${id}-error">${escapeHtml(error ?? "")}</div></div>`;
  };
  const createDraft = state.data.adminMessageOverrideCreateDraft ?? {};
  const createErrors = messageErrorTarget === "create" ? errors : {};
  const createForm = `<form data-form="admin-localization-message-create" novalidate><div class="field"><label for="new-override-locale">${escapeHtml(text("adminMessageLocale"))}</label><select id="new-override-locale" name="locale" required>${supportedLocales.map((locale) => `<option value="${escapeHtml(locale)}" ${createDraft.locale === locale ? "selected" : ""}>${escapeHtml(locale)}</option>`).join("")}</select><div class="field-error">${escapeHtml(createErrors.locale ?? "")}</div></div><div class="field"><label for="new-override-bundle">${escapeHtml(text("adminMessageBundle"))}</label><select id="new-override-bundle" name="bundle" required>${availableBundles.map((bundle) => `<option value="${escapeHtml(bundle)}" ${createDraft.bundle === bundle ? "selected" : ""}>${escapeHtml(bundle)}</option>`).join("")}</select><div class="field-error">${escapeHtml(createErrors.bundle ?? "")}</div></div>${field("messageKey", text("adminMessageKey"), createDraft.messageKey ?? "", createErrors.messageKey, "text", 'maxlength="255" pattern="[A-Za-z0-9_.-]+" required')}<div class="field"><label for="new-override-value">${escapeHtml(text("adminMessageValue"))}</label><textarea id="new-override-value" name="messageValue" required maxlength="4000">${escapeHtml(createDraft.messageValue ?? "")}</textarea><div class="field-error">${escapeHtml(createErrors.messageValue ?? "")}</div></div><div class="actions">${button(text("adminCreateMessageOverride"), { type: "submit", busy: state.busy === "admin-message-create", disabled: state.offline })}</div></form>`;
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminLocalizationSettings"))}"><h2>${escapeHtml(text("adminLocalizationSettings"))}</h2><div class="list">${row(text("adminLocalizationEnabled"), settings.internationalizationEnabled === true ? text("adminEnabled") : settings.internationalizationEnabled === false ? text("adminDisabled") : undefined)}${row(text("adminDefaultLocale"), settings.defaultLocale)}${row(text("adminSupportedLocales"), list(settings.supportedLocales))}${row(text("adminAvailableLocales"), list(settings.availableLocales))}${row(text("adminAvailableBundles"), list(settings.availableBundles))}</div></section><section class="card" aria-label="${escapeHtml(text("adminMessageOverrides"))}"><h2>${escapeHtml(text("adminMessageOverrides"))}</h2>${
    overrides.length
      ? `<div class="list">${overrides
          .map((item) => {
            const values = drafts[item.id] ?? item;
            const itemErrors =
              messageErrorTarget === `update:${item.id}` ? errors : {};
            const deletePending =
              String(state.data.adminMessageDeleteConfirmId) ===
              String(item.id);
            const deleteControls = deletePending
              ? `<div class="actions"><span role="status">${escapeHtml(text("adminMessageOverrideDeletePrompt"))}</span>${button(text("adminMessageOverrideDelete"), { action: "admin-message-delete-confirm", id: item.id, danger: true, busy: state.busy === `admin-message-delete:${item.id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-message-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
              : `<div class="actions">${button(text("adminMessageOverrideDelete"), { action: "admin-message-delete-request", id: item.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
            return `<article class="list-item"><strong>${escapeHtml(`${item.locale} · ${item.bundle} · ${item.messageKey}`)}</strong><form data-form="admin-localization-message" data-id="${escapeHtml(item.id)}" novalidate>${overrideField(item, "locale", text("adminMessageLocale"), values.locale, itemErrors.locale)}${overrideField(item, "bundle", text("adminMessageBundle"), values.bundle, itemErrors.bundle)}${overrideField(item, "messageKey", text("adminMessageKey"), values.messageKey, itemErrors.messageKey)}<div class="field"><label for="override-${escapeHtml(item.id)}-messageValue">${escapeHtml(text("adminMessageValue"))}</label><textarea id="override-${escapeHtml(item.id)}-messageValue" name="messageValue" required maxlength="4000" aria-invalid="${Boolean(itemErrors.messageValue)}">${escapeHtml(values.messageValue ?? "")}</textarea><div class="field-error" id="override-${escapeHtml(item.id)}-messageValue-error">${escapeHtml(itemErrors.messageValue ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `admin-message-${item.id}`, disabled: state.offline })}</div></form>${deleteControls}</article>`;
          })
          .join("")}</div>`
      : `<div class="empty" role="status">${escapeHtml(text("adminNoMessageOverrides"))}</div>`
  }${createForm}${localizationSettingsForm}</section></div>`;
}

function adminAdminLdapContent() {
  const providers = Array.isArray(state.data.adminLdapProviders)
    ? state.data.adminLdapProviders
    : [];
  const enabled = (value) =>
    value === true
      ? text("adminEnabled")
      : value === false
        ? text("adminDisabled")
        : text("adminNotConfigured");
  const count = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? String(value) : "0";
  if (providers.length === 0)
    return `<section class="card" aria-label="${escapeHtml(text("adminLdap"))}"><div class="empty" role="status">${escapeHtml(text("adminNoLdapProviders"))}</div></section>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminLdap"))}"><div class="list">${providers
    .map(
      (provider) =>
        `<article class="list-item"><div><strong>${escapeHtml(provider.name)}</strong><span class="muted">${escapeHtml(`${provider.vendor ?? "LDAP"} · ${provider.authenticationType ?? ""} · ${provider.editMode ?? ""}`)}</span><span class="muted">${escapeHtml(text("adminLdapSyncSummary"))}: ${escapeHtml(count(provider.lastSyncImported))} ${escapeHtml(text("adminLdapImported"))} · ${escapeHtml(count(provider.lastSyncUpdated))} ${escapeHtml(text("adminLdapUpdated"))}</span>${provider.lastSyncAt ? `<time class="muted" datetime="${escapeHtml(provider.lastSyncAt)}">${escapeHtml(new Date(provider.lastSyncAt).toLocaleString(state.locale === "tr" ? "tr-TR" : "en-US"))}</time>` : ""}</div><div><span>${escapeHtml(provider.enabled ? text("adminEnabled") : text("adminDisabled"))}</span><span class="muted">${escapeHtml(text("adminLdapImportUsers"))}: ${escapeHtml(enabled(provider.importUsers))}</span><span class="muted">${escapeHtml(text("adminLdapTrustEmail"))}: ${escapeHtml(enabled(provider.trustEmail))}</span>${provider.lastSyncStatus ? `<span class="muted">${escapeHtml(text("adminLdapSyncStatus"))}: ${escapeHtml(provider.lastSyncStatus)}</span>` : ""}</div></article>`,
    )
    .join("")}</div></section>`;
}

function adminAdminAuthenticationContent() {
  const flows = state.data.adminAuthenticationFlows?.content ?? [];
  const bindings = Array.isArray(state.data.adminAuthenticationBindings)
    ? state.data.adminAuthenticationBindings
    : [];
  const providers = Array.isArray(state.data.adminExecutionProviders)
    ? state.data.adminExecutionProviders
    : [];
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminAuthenticationFlows"))}"><h2>${escapeHtml(text("adminAuthenticationFlows"))}</h2>${flows.length ? `<div class="list">${flows.map((flow) => `<article class="list-item"><div><strong>${escapeHtml(flow.name)}</strong><span class="muted">${escapeHtml(`${flow.alias} · ${flow.flowType}`)}</span>${flow.description ? `<span class="muted">${escapeHtml(flow.description)}</span>` : ""}</div><span>${escapeHtml(flow.builtIn ? text("adminBuiltIn") : text("adminCustom"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoAuthenticationFlows"))}</div>`}</section><section class="card" aria-label="${escapeHtml(text("adminAuthenticationBindings"))}"><h2>${escapeHtml(text("adminAuthenticationBindings"))}</h2>${bindings.length ? `<div class="list">${bindings.map((binding) => `<article class="list-item"><strong>${escapeHtml(binding.bindingType)}</strong><span>${escapeHtml(binding.flowName ?? text("adminNotConfigured"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoAuthenticationBindings"))}</div>`}</section><section class="card" aria-label="${escapeHtml(text("adminExecutionProviders"))}"><h2>${escapeHtml(text("adminExecutionProviders"))}</h2>${providers.length ? `<div class="list">${providers.map((provider) => `<div class="list-item"><span>${escapeHtml(provider)}</span></div>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoExecutionProviders"))}</div>`}</section></div>`;
}

function profileContent() {
  const profile = {
    ...(state.profile ?? {}),
    ...(state.data.accountProfileDraft ?? {}),
  };
  const errors = violations(state.error?.body);
  return `<section class="card"><h2>${escapeHtml(text("firstName"))} &amp; ${escapeHtml(text("lastName"))}</h2><p>${escapeHtml(text("profileLoadError"))}</p><form data-form="profile" novalidate><div class="form-grid">${field("firstName", text("firstName"), profile.firstName ?? "", errors.firstName)}${field("lastName", text("lastName"), profile.lastName ?? "", errors.lastName)}${field("email", text("email"), profile.email ?? "", errors.email, "email")}<div class="field"><label for="preferredLocale">${escapeHtml(text("language"))}</label><select id="preferredLocale" name="preferredLocale"><option value="en" ${profile.preferredLocale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${profile.preferredLocale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select><div class="field-error"></div></div>${field("currentPassword", text("currentPassword"), "", errors.currentPassword, "password", 'autocomplete="current-password"')}</div><div class="actions">${button(text("save"), { action: "save-profile", type: "submit", busy: state.busy === "profile", mutation: true })}</div></form></section>`;
}

function securityContent() {
  const mfa = state.data.mfa ?? {};
  const social = state.data.social ?? [];
  const passwordErrors = violations(state.error?.body);
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("passwordPolicy"))}</h2><p>${escapeHtml(text("securityTitle"))}</p><form data-form="password" novalidate>${field("currentPassword", text("currentPassword"), "", passwordErrors.currentPassword, "password")}${field("newPassword", text("newPassword"), "", passwordErrors.newPassword, "password")}${field("confirmPassword", text("confirmPassword"), "", passwordErrors.confirmPassword, "password")}<div class="actions">${button(text("save"), { action: "save-password", type: "submit", busy: state.busy === "password", mutation: true })}</div></form></section><section class="card"><h2>${escapeHtml(text("mfaTitle"))}</h2><p>${escapeHtml(text("mfaHelp"))}</p>${mfa.available === false ? `<div class="notice">${escapeHtml(text("mfaUnavailable"))}</div>` : mfa.enabled ? `<div class="notice success">${escapeHtml(text("mfaEnabled"))}</div>${field("mfaCode", text("mfaCode"), "", "", "text", 'inputmode="numeric" maxlength="${mfa.digits ?? 6}"')}${button(text("mfaDisable"), { action: "mfa-disable", busy: state.busy === "mfa", mutation: true })}` : mfa.setup ? `<div class="notice">${escapeHtml(text("mfaSecret"))}: <code>${escapeHtml(mfa.setup.secret ?? "")}</code></div>${field("mfaCode", text("mfaCode"), "", "", "text", 'inputmode="numeric" maxlength="${mfa.setup.digits ?? 6}"')}${button(text("mfaEnable"), { action: "mfa-enable", busy: state.busy === "mfa", mutation: true })}` : button(text("mfaSetup"), { action: "mfa-setup", busy: state.busy === "mfa", mutation: true })}</section><section class="card"><h2>${escapeHtml(text("socialLinksTitle"))}</h2><p>${escapeHtml(text("socialLinksHelp"))}</p><div class="list">${social.length ? social.map((link) => `<div class="list-item"><div><strong>${escapeHtml(link.displayName ?? link.provider)}</strong><span class="muted">${escapeHtml(link.linked ? text("socialConnected") : link.configured && link.enabled ? text("socialNotConnected") : text("socialNotConfigured"))}</span></div>${link.linked ? button(text("socialRemove"), { action: "social-remove", danger: true, mutation: true }) : button(text("socialConnect"), { action: "social-start", busy: state.busy === "social", disabled: !link.configured || !link.enabled, mutation: true, provider: link.provider })}</div>`).join("") : `<div class="empty">${escapeHtml(text("socialLinksEmpty"))}</div>`}</div></section><section class="card"><h2>${escapeHtml(text("deleteAccount"))}</h2><p>${escapeHtml(text("deleteAccountWarning"))}</p><form data-form="delete" novalidate>${field("deletePassword", text("currentPassword"), "", "", "password")}<div class="actions">${button(text("deleteAccount"), { action: "delete-account", danger: true, type: "submit", busy: state.busy === "delete", mutation: true })}</div></form></section></div>`;
}

function pageItems(items, emptyText, renderItem) {
  return items?.length
    ? `<div class="list">${items.map(renderItem).join("")}</div>`
    : `<div class="empty">${escapeHtml(emptyText)}</div>`;
}

function sessionsContent() {
  const sessions = state.data.sessions ?? [];
  return `<section class="card"><h2>${escapeHtml(text("sessionsTitle"))}</h2><p>${escapeHtml(text("sessionsError"))}</p>${pageItems(sessions, text("sessionsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.current ? text("currentSession") : item.id)}</strong><span class="muted">${escapeHtml(item.createdAt ?? "")} · ${escapeHtml(item.lastAccessedAt ?? "")}</span></div>${item.current ? "" : button(text("signOutSession"), { action: "delete-session", danger: true, mutation: true })}</div>`)}<div class="actions">${button(text("signOutOthers"), { action: "delete-other-sessions", busy: state.busy === "sessions", mutation: true })}</div></section>`;
}

function applicationsContent() {
  const applications = state.data.applications ?? [];
  const offline = state.data.offlineSessions ?? [];
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("applicationsTitle"))}</h2><p>${escapeHtml(text("applicationsError"))}</p>${pageItems(applications, text("applicationsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.clientId)}"><div><strong>${escapeHtml(item.clientName ?? item.clientId)}</strong><span class="muted">${escapeHtml((item.scopes ?? []).join(", "))}</span></div>${button(text("revokeApplication"), { action: "revoke-application", danger: true, mutation: true })}</div>`)}</section><section class="card"><h2>${escapeHtml(text("offlineSessionsTitle"))}</h2><p>${escapeHtml(text("offlineSessionsHelp"))}</p>${pageItems(offline, text("offlineSessionsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.clientName ?? item.clientId)}</strong><span class="muted">${escapeHtml(item.issuedAt ?? "")}</span></div>${button(text("revokeOfflineSession"), { action: "revoke-offline", danger: true, mutation: true })}</div>`)}</section></div>`;
}

function settingsContent() {
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("appearance"))}</h2><div class="settings-row"><label for="theme">${escapeHtml(text("theme"))}</label><select id="theme"><option value="system">${escapeHtml(text("system"))}</option><option value="light">${escapeHtml(text("light"))}</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>${escapeHtml(text("dark"))}</option></select></div><div class="settings-row"><label for="language">${escapeHtml(text("language"))}</label><select id="language"><option value="en" ${state.locale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${state.locale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select></div></section><section class="card"><h2>${escapeHtml(text("security"))}</h2><p>${escapeHtml(text("secureVaultNote"))}</p>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</section></div>`;
}

function loginContent() {
  if (!hasConsoleSelection()) {
    return `<div class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(text("signInNote"))}</p><h1>${escapeHtml(text("chooseConsole"))}</h1><p>${escapeHtml(text("chooseConsoleHelp"))}</p><div class="actions">${button(text("adminTitle"), { action: "choose-admin" })}${button(text("accountTitle"), { action: "choose-account" })}</div></section></div>`;
  }
  const title =
    state.console === "admin" ? text("adminTitle") : text("accountTitle");
  return `<div class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text("signInNote"))}</p>${state.error ? `<div class="notice error" role="alert">${escapeHtml(state.error.message)}</div>` : ""}${state.notice ? `<div class="notice success" role="status">${escapeHtml(state.notice)}</div>` : ""}<div class="actions">${button(text("signIn"), { action: "sign-in", busy: state.authStarting && !state.authCanceling, disabled: state.authStarting })}${state.authStarting ? button(text("cancelSignIn"), { action: "cancel-sign-in", busy: state.authCanceling, disabled: state.authCanceling }) : button(state.console === "admin" ? text("accountTitle") : text("adminTitle"), { action: "switch-console" })}</div></section></div>`;
}

function render() {
  if (state.session) preserveOfflineDrafts();
  if (!state.session) {
    app.innerHTML = loginContent();
  } else {
    app.innerHTML = shell();
  }
  bind();
}

async function loadProfile() {
  state.loading = true;
  state.error = null;
  render();
  try {
    state.profile = await request("/api/account/profile");
    state.loading = false;
    render();
  } catch {
    state.loading = false;
    render();
  }
}

async function loadRoute({ preserveError = false, keepContent = false } = {}) {
  state.loading = !keepContent;
  if (!preserveError) state.error = null;
  render();
  try {
    if (state.console === "admin" && state.route === "dashboard")
      state.data.dashboard = await request("/api/admin/dashboard");
    if (state.console === "admin" && state.route === "users") {
      const query = new URLSearchParams({
        q: state.data.userQuery ?? "",
        page: String(state.data.userPage ?? 0),
        size: "20",
        sort: "username,asc",
      });
      state.data.users = await request(`/api/admin/users?${query.toString()}`);
    }
    if (state.console === "admin" && state.route === "user-create") {
      const [page, definitions] = await Promise.all([
        request("/api/admin/roles?page=0&size=100&sort=name,asc"),
        request("/api/admin/profile-attributes"),
      ]);
      state.data.userCreateRoles = Array.isArray(page?.content)
        ? page.content
        : [];
      state.data.userCreateProfileDefinitions = Array.isArray(definitions)
        ? definitions
        : [];
      state.data.userCreateProfileDefinitionsLoaded = true;
    }
    if (state.console === "admin" && state.route === "roles") {
      const query = new URLSearchParams({
        q: state.data.roleQuery ?? "",
        page: String(state.data.rolePage ?? 0),
        size: "20",
        sort: "name,asc",
      });
      state.data.roles = await request(`/api/admin/roles?${query.toString()}`);
    }
    if (state.console === "admin" && state.route === "groups") {
      const query = new URLSearchParams({
        q: state.data.groupQuery ?? "",
        page: String(state.data.groupPage ?? 0),
        size: "20",
        sort: "name,asc",
      });
      state.data.groups = await request(
        `/api/admin/groups?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "client-scopes") {
      const query = new URLSearchParams({
        q: state.data.clientScopeQuery ?? "",
        page: String(state.data.clientScopePage ?? 0),
        size: "20",
        sort: "name,asc",
      });
      state.data.clientScopes = await request(
        `/api/admin/client-scopes?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "clients") {
      const query = new URLSearchParams({
        q: state.data.clientQuery ?? "",
        page: String(state.data.clientPage ?? 0),
        size: "20",
        sort: "clientId,asc",
      });
      state.data.clients = await request(
        `/api/admin/clients?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "identity-providers") {
      const query = new URLSearchParams({
        q: state.data.identityProviderQuery ?? "",
        page: String(state.data.identityProviderPage ?? 0),
        size: "20",
        sort: "guiOrder,asc",
      });
      state.data.identityProviders = await request(
        `/api/admin/identity-providers?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "sessions") {
      const query = new URLSearchParams({
        q: state.data.adminSessionQuery ?? "",
        status: state.data.adminSessionStatus ?? "active",
        page: String(state.data.adminSessionPage ?? 0),
        size: "20",
        sort: "lastAccessTime,desc",
      });
      state.data.adminSessions = await request(
        `/api/admin/sessions?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "consents") {
      const query = new URLSearchParams({
        q: state.data.adminConsentQuery ?? "",
        page: String(state.data.adminConsentPage ?? 0),
        size: "20",
        sort: "id.principalName,asc",
      });
      state.data.adminConsents = await request(
        `/api/admin/consents?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "offline-sessions") {
      const query = new URLSearchParams({
        page: String(state.data.adminOfflineSessionPage ?? 0),
        size: "20",
      });
      state.data.adminOfflineSessions = await request(
        `/api/admin/offline-sessions?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "events") {
      const query = new URLSearchParams({
        q: state.data.adminEventQuery ?? "",
        page: String(state.data.adminEventPage ?? 0),
        size: "20",
        sort: "occurredAt,desc",
      });
      state.data.adminEvents = await request(
        `/api/admin/events?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "keys") {
      const query = new URLSearchParams({
        q: state.data.adminKeyQuery ?? "",
        page: String(state.data.adminKeyPage ?? 0),
        size: "20",
        sort: "createdAt,desc",
      });
      if (state.data.adminKeyActive !== "all")
        query.set("active", state.data.adminKeyActive ?? "true");
      state.data.adminKeys = await request(
        `/api/admin/keys?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "policies") {
      [state.data.cibaPolicy, state.data.offlineAccessPolicy] =
        await Promise.all([
          request("/api/admin/settings/ciba-policy"),
          request("/api/admin/settings/offline-access"),
        ]);
    }
    if (state.console === "admin" && state.route === "configuration") {
      [state.data.adminBranding, state.data.adminServerInfo] =
        await Promise.all([
          request("/api/admin/settings/branding"),
          request("/api/admin/server-info"),
        ]);
    }
    if (state.console === "admin" && state.route === "login-email") {
      [state.data.adminLoginSettings, state.data.adminEmailSettings] =
        await Promise.all([
          request("/api/admin/settings/login/native"),
          request("/api/admin/settings/email"),
        ]);
    }
    if (state.console === "admin" && state.route === "localization") {
      [state.data.adminLocalization, state.data.adminMessageOverrides] =
        await Promise.all([
          request("/api/admin/settings/localization"),
          request(
            "/api/admin/settings/localization/messages?page=0&size=20&sort=locale,asc",
          ),
        ]);
    }
    if (state.console === "admin" && state.route === "ldap")
      state.data.adminLdapProviders = await request("/api/admin/settings/ldap");
    if (state.console === "admin" && state.route === "authentication") {
      [
        state.data.adminAuthenticationFlows,
        state.data.adminAuthenticationBindings,
        state.data.adminExecutionProviders,
      ] = await Promise.all([
        request("/api/admin/authentication/flows?page=0&size=20&sort=name,asc"),
        request("/api/admin/authentication/bindings"),
        request("/api/admin/authentication/execution-providers"),
      ]);
    }
    if (state.route === "profile")
      state.profile = await request("/api/account/profile");
    if (state.route === "sessions")
      state.data.sessions =
        (await request("/api/account/sessions?page=0&size=20"))?.content ?? [];
    if (state.route === "applications") {
      state.data.applications =
        (await request("/api/account/applications?page=0&size=20"))?.content ??
        [];
      state.data.offlineSessions =
        (await request("/api/account/offline-sessions?page=0&size=20"))
          ?.content ?? [];
    }
    if (state.route === "security") {
      state.data.mfa = await request("/api/account/mfa");
      state.data.mfa.recovery = await request(
        "/api/account/mfa/recovery-codes",
      );
      state.data.social = await request("/api/account/social-links");
    }
    state.error = null;
    state.loading = false;
    render();
  } catch {
    state.loading = false;
    render();
  }
}

async function cancelSignIn(timedOut = false) {
  if (!state.authStarting || state.authCanceling) return;
  const consoleName = state.console;
  state.authCanceling = true;
  render();
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await api.auth.cancelLogin(consoleName);
    clearTimeout(authTimeout);
    authTimeout = undefined;
    if (state.authStarting) {
      state.authStarting = false;
      state.error = timedOut ? { message: text("authTimeout") } : null;
      state.notice = timedOut ? null : text("authCanceled");
    }
  } catch {
    state.error = { message: text("authCancelError") };
  } finally {
    state.authCanceling = false;
    render();
  }
}

async function signIn() {
  if (state.authStarting) return;
  state.authStarting = true;
  state.authCanceling = false;
  state.error = null;
  state.notice = null;
  render();
  clearTimeout(authTimeout);
  authTimeout = setTimeout(() => void cancelSignIn(true), 5 * 60 * 1000);
  try {
    await api.auth.startLogin(state.console);
  } catch {
    clearTimeout(authTimeout);
    state.authStarting = false;
    state.error = { message: text("browserError") };
    render();
  }
}

async function logout() {
  if (state.busy) return;
  state.busy = "logout";
  render();
  try {
    await api.auth.logout(state.console);
    state.session = null;
    state.profile = null;
    state.data = {};
    state.route = "profile";
    state.notice = null;
  } catch {
    state.session = null;
    state.error = {
      message: text("signOutError"),
    };
  }
  state.busy = null;
  render();
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function profileAttributeValues(form) {
  return Object.fromEntries(
    [...form.querySelectorAll("[data-profile-attribute]")].map((input) => {
      const value = String(input.value ?? "");
      const values =
        input.dataset.multivalued === "true"
          ? value
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean)
          : value.trim()
            ? [value.trim()]
            : [];
      return [input.dataset.profileAttribute, values];
    }),
  );
}

async function encodeAvatarFile(file) {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error("invalid_avatar");
  const bitmap = await createImageBitmap(file);
  const tooLarge =
    bitmap.width > 4096 ||
    bitmap.height > 4096 ||
    bitmap.width * bitmap.height > 4_000_000;
  bitmap.close();
  if (tooLarge) throw new Error("invalid_avatar");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return { contentType: file.type, dataBase64: btoa(binary) };
}

function preserveOfflineDrafts() {
  for (const form of app.querySelectorAll("form[data-form]")) {
    const values = formValues(form);
    if (form.dataset.form === "profile") {
      state.data.accountProfileDraft = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        preferredLocale: values.preferredLocale,
      };
    } else if (form.dataset.form === "admin-ciba-policy") {
      state.data.cibaPolicyDraft = {
        requestLifespanSeconds: values.requestLifespanSeconds,
        pollingIntervalSeconds: values.pollingIntervalSeconds,
        deliveryMode: values.deliveryMode,
        userVerification: values.userVerification,
        mfaRequired: form.elements.namedItem("mfaRequired").checked,
        stepUpRequired: form.elements.namedItem("stepUpRequired").checked,
        stepUpAcr: values.stepUpAcr,
      };
    } else if (form.dataset.form === "admin-offline-access-policy") {
      state.data.offlineAccessPolicyDraft = {
        idleTimeout: values.idleTimeout,
        maxLifespan: values.maxLifespan,
        maxLimited: form.elements.namedItem("maxLimited").checked,
      };
    } else if (form.dataset.form === "admin-login-settings") {
      state.data.adminLoginSettingsDraft = {
        userRegistration: form.elements.namedItem("userRegistration").checked,
        forgotPassword: form.elements.namedItem("forgotPassword").checked,
        rememberMe: form.elements.namedItem("rememberMe").checked,
        loginWithEmail: form.elements.namedItem("loginWithEmail").checked,
        verifyEmail: form.elements.namedItem("verifyEmail").checked,
        sessionTimeoutMinutes: values.sessionTimeoutMinutes,
        passwordMinimumLength: values.passwordMinimumLength,
        bruteForceEnabled: form.elements.namedItem("bruteForceEnabled").checked,
        bruteForceMaxFailures: values.bruteForceMaxFailures,
        otpEnabled: form.elements.namedItem("otpEnabled").checked,
        otpRequired: form.elements.namedItem("otpRequired").checked,
        passkeys: form.elements.namedItem("passkeys").checked,
      };
    } else if (form.dataset.form === "admin-branding") {
      state.data.adminBrandingDraft = values;
    } else if (form.dataset.form === "admin-email-settings") {
      state.data.adminEmailDraft = {
        ...values,
        enabled: form.elements.namedItem("enabled").checked,
        smtpAuth: form.elements.namedItem("smtpAuth").checked,
        starttls: form.elements.namedItem("starttls").checked,
        ssl: form.elements.namedItem("ssl").checked,
      };
      delete state.data.adminEmailDraft.password;
    } else if (form.dataset.form === "admin-localization-settings") {
      state.data.adminLocalizationDraft = {
        internationalizationEnabled: form.elements.namedItem(
          "internationalizationEnabled",
        ).checked,
        defaultLocale: values.defaultLocale,
        supportedLocales: [
          ...form.querySelectorAll('input[name="supportedLocales"]:checked'),
        ].map((input) => input.value),
      };
    } else if (form.dataset.form === "admin-localization-message") {
      const id = Number(form.dataset.id);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.adminMessageOverrideDrafts ??= {};
        state.data.adminMessageOverrideDrafts[id] = { id, ...values };
      }
    } else if (form.dataset.form === "admin-user-create") {
      const createdUserId = Number(form.dataset.createdUserId);
      if (Number.isSafeInteger(createdUserId) && createdUserId > 0) {
        state.data.userCreateDraft ??= {};
        state.data.userCreateDraft.profile = profileAttributeValues(form);
      } else {
        const { password: _password, ...draft } = values;
        state.data.userCreateDraft = {
          ...draft,
          profile: profileAttributeValues(form),
          temporary: form.elements.namedItem("temporary").checked,
          emailVerified: form.elements.namedItem("emailVerified").checked,
          enabled: form.elements.namedItem("enabled").checked,
          roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
            (input) => input.value,
          ),
        };
      }
    } else if (form.dataset.form === "admin-user-edit") {
      const id = Number(form.dataset.userId);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.userEditDrafts ??= {};
        state.data.userEditDrafts[id] = {
          ...values,
          emailVerified: form.elements.namedItem("emailVerified").checked,
          enabled: form.elements.namedItem("enabled").checked,
          roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
            (input) => input.value,
          ),
        };
      }
    } else if (form.dataset.form === "admin-user-profile-attributes") {
      const id = Number(form.dataset.userId);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.adminProfileAttributeDrafts ??= {};
        state.data.adminProfileAttributeDrafts[id] =
          profileAttributeValues(form);
      }
    } else if (form.dataset.form === "admin-user-action-email") {
      const id = Number(form.dataset.userId);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.adminUserActionEmailDrafts ??= {};
        state.data.adminUserActionEmailDrafts[id] = {
          action: values.action,
          lifespan: values.lifespan,
        };
      }
    } else if (form.dataset.form === "admin-user-passkey-rename") {
      const userId = Number(form.dataset.userId);
      const passkeyIndex = Number(form.dataset.passkeyIndex);
      const target = `${userId}:${passkeyIndex}`;
      if (adminUserPasskeyPath(userId, passkeyIndex)) {
        state.data.adminPasskeyDrafts ??= {};
        state.data.adminPasskeyDrafts[target] = values.label;
      }
    } else if (form.dataset.form === "admin-role-create") {
      state.data.adminRoleCreateDraft = values;
    } else if (form.dataset.form === "admin-role-edit") {
      const roleName = form.dataset.roleName;
      if (/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName ?? "")) {
        state.data.adminRoleDrafts ??= {};
        state.data.adminRoleDrafts[roleName] = values;
      }
    } else if (form.dataset.form === "admin-client-scope-edit") {
      const scopeId = form.dataset.scopeId;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "")) {
        state.data.adminClientScopeDrafts ??= {};
        state.data.adminClientScopeDrafts[scopeId] = values;
      }
    } else if (form.dataset.form === "admin-client-native-metadata") {
      const id = form.dataset.clientId;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "")) {
        state.data.clientMetadataDrafts ??= {};
        state.data.clientMetadataDrafts[id] = values;
      }
    } else if (form.dataset.form === "admin-client-scope-assignments") {
      const id = form.dataset.clientId;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "")) {
        state.data.clientScopeAssignmentDrafts ??= {};
        state.data.clientScopeAssignmentDrafts[id] = {
          defaultScopes: [
            ...form.querySelectorAll('input[name="defaultScopes"]:checked'),
          ].map((input) => input.value),
          optionalScopes: [
            ...form.querySelectorAll('input[name="optionalScopes"]:checked'),
          ].map((input) => input.value),
        };
      }
    } else if (form.dataset.form === "admin-provider-mapper") {
      const providerId = form.dataset.providerId;
      const mapperId = form.dataset.mapperId || "new";
      if (
        /^[A-Za-z0-9_-]{1,100}$/.test(providerId ?? "") &&
        (mapperId === "new" || /^[A-Za-z0-9_-]{1,100}$/.test(mapperId))
      ) {
        state.data.providerMapperDrafts ??= {};
        state.data.providerMapperDrafts[providerId] ??= {};
        state.data.providerMapperDrafts[providerId][mapperId] = {
          ...values,
          addToIdToken: form.elements.namedItem("addToIdToken").checked,
          addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
        };
      }
    } else if (form.dataset.form === "admin-client-scope-mapper") {
      const scopeId = form.dataset.scopeId;
      const mapperId = form.dataset.mapperId || "new";
      if (
        /^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") &&
        (mapperId === "new" || /^[1-9]\d*$/.test(mapperId))
      ) {
        state.data.clientScopeMapperDrafts ??= {};
        state.data.clientScopeMapperDrafts[scopeId] ??= {};
        state.data.clientScopeMapperDrafts[scopeId][mapperId] = {
          ...values,
          addToIdToken: form.elements.namedItem("addToIdToken").checked,
          addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
        };
      }
    } else if (form.dataset.form === "admin-client-mapper") {
      const clientId = form.dataset.clientId;
      const mapperId = form.dataset.mapperId || "new";
      if (
        /^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "") &&
        (mapperId === "new" || /^[1-9]\d*$/.test(mapperId))
      ) {
        state.data.clientMapperDrafts ??= {};
        state.data.clientMapperDrafts[clientId] ??= {};
        state.data.clientMapperDrafts[clientId][mapperId] = {
          ...values,
          addToIdToken: form.elements.namedItem("addToIdToken").checked,
          addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
        };
      }
    } else if (form.dataset.form === "admin-localization-message-create") {
      state.data.adminMessageOverrideCreateDraft = values;
    } else if (form.dataset.form === "admin-group-create") {
      state.data.adminGroupCreateDraft = values;
    } else if (form.dataset.form === "admin-group-child-create") {
      const parentId = Number(form.dataset.parentId);
      if (Number.isSafeInteger(parentId) && parentId > 0) {
        state.data.groupChildCreateDrafts ??= {};
        state.data.groupChildCreateDrafts[parentId] = values;
      }
    } else if (form.dataset.form === "admin-group-roles") {
      const id = Number(form.dataset.groupId);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.groupRoleDrafts ??= {};
        state.data.groupRoleDrafts[id] = {
          roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
            (input) => input.value,
          ),
        };
      }
    } else if (form.dataset.form === "admin-group-rename") {
      const id = Number(form.dataset.groupId);
      if (Number.isSafeInteger(id) && id > 0) {
        state.data.groupNameDrafts ??= {};
        state.data.groupNameDrafts[id] = values;
      }
    } else if (form.dataset.form === "admin-client-scope-create") {
      state.data.adminClientScopeCreateDraft = values;
    }
  }
}

async function submitForm(form) {
  if (state.busy) return;
  const values = formValues(form);
  if (form.dataset.form === "admin-user-password-reset") {
    const id = Number(form.dataset.userId);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    const password = String(values.password ?? "");
    if (
      state.offline ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !user ||
      !form.reportValidity() ||
      password.length < 12 ||
      password.length > 128
    )
      return;
    state.data.userPasswordResetErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `user-password-reset:${id}`;
    render();
    try {
      await request(`/api/admin/users/${id}/password`, {
        method: "PUT",
        body: {
          password,
          temporary: form.elements.namedItem("temporary").checked,
        },
      });
      state.data.userPasswordResetOpenId = null;
      state.data.userPasswordResetErrorId = null;
      state.notice = text("adminPasswordReset");
    } catch {
      /* Keep the form open without retaining the submitted password. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-profile-attributes") {
    const userId = Number(form.dataset.userId);
    const profile = state.data.adminUserProfileAttributes?.[userId];
    if (
      state.offline ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !profile ||
      !form.reportValidity()
    )
      return;
    const attributes = profileAttributeValues(form);
    state.data.adminProfileAttributeDrafts ??= {};
    state.data.adminProfileAttributeDrafts[userId] = attributes;
    state.data.adminProfileAttributesErrorId = userId;
    state.error = null;
    state.notice = null;
    state.busy = `user-profile-attributes-save:${userId}`;
    render();
    try {
      const saved = await request(
        `/api/admin/users/${userId}/profile-attributes`,
        { method: "PUT", body: { attributes } },
      );
      state.data.adminUserProfileAttributes[userId] = saved;
      delete state.data.adminProfileAttributeDrafts[userId];
      state.data.adminProfileAttributesErrorId = null;
      state.notice = text("adminProfileAttributesUpdated");
    } catch {
      /* Keep profile values available for validation or retry recovery. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-action-email") {
    const userId = Number(form.dataset.userId);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === userId,
    );
    const action = String(values.action ?? "");
    const lifespan = String(values.lifespan ?? "");
    if (
      state.offline ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !user?.email ||
      !["VERIFY_EMAIL", "UPDATE_PASSWORD"].includes(action) ||
      !["1800", "3600", "43200", "86400"].includes(lifespan)
    )
      return;
    state.data.adminUserActionEmailDrafts ??= {};
    state.data.adminUserActionEmailDrafts[userId] = { action, lifespan };
    state.error = null;
    state.notice = null;
    state.busy = `user-action-email:${userId}`;
    render();
    try {
      await request(
        `/api/admin/users/${userId}/execute-actions-email?lifespan=${lifespan}`,
        { method: "PUT", body: [action] },
      );
      state.data.userActionEmailOpenId = null;
      delete state.data.adminUserActionEmailDrafts[userId];
      state.notice = text("adminActionEmailSent");
    } catch {
      /* Keep the safe action selection for server validation or retry. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-passkey-rename") {
    const userId = Number(form.dataset.userId);
    const passkeyIndex = Number(form.dataset.passkeyIndex);
    const target = `${userId}:${passkeyIndex}`;
    const path = adminUserPasskeyPath(userId, passkeyIndex);
    const label = String(values.label ?? "").trim();
    if (
      state.offline ||
      !path ||
      !form.reportValidity() ||
      !label ||
      label.length > 100
    )
      return;
    state.data.adminPasskeyDrafts ??= {};
    state.data.adminPasskeyDrafts[target] = label;
    state.data.adminPasskeyErrorTarget = target;
    state.error = null;
    state.notice = null;
    state.busy = `admin-passkey-rename:${target}`;
    render();
    try {
      await request(path, { method: "PUT", body: { label } });
      const page = state.data.adminUserPasskeys[userId];
      state.data.adminUserPasskeys[userId] = {
        ...page,
        content: page.content.map((credential, index) =>
          index === passkeyIndex ? { ...credential, label } : credential,
        ),
      };
      delete state.data.adminPasskeyDrafts[target];
      state.data.adminPasskeyErrorTarget = null;
      state.data.adminPasskeyEditTarget = null;
      state.notice = text("adminPasskeyRenamed");
    } catch {
      /* Keep the safe label draft for validation recovery. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-role-candidate-search") {
    const scopeId = form.dataset.scopeId ?? "";
    const kind = form.dataset.roleKind ?? "";
    const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
      !mapping ||
      !["applicationRoles", "clientRoleIds"].includes(kind)
    )
      return;
    mapping[`${kind}Query`] = String(values.q ?? "").trim();
    state.error = null;
    state.busy = `client-scope-role-candidates:${scopeId}:${kind}`;
    render();
    try {
      await loadClientScopeRoleCandidates(scopeId, kind, 0);
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-native-metadata") {
    const id = form.dataset.clientId ?? "";
    const clients = state.data.clients?.content ?? [];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !clients.some((client) => client.id === id) ||
      !form.reportValidity()
    )
      return;
    const body = { clientName: String(values.clientName ?? "").trim() };
    state.data.clientMetadataDrafts ??= {};
    state.data.clientMetadataDrafts[id] = body;
    state.data.clientMetadataErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `client-metadata-save:${id}`;
    render();
    try {
      const saved = await request(
        `/api/admin/clients/${encodeURIComponent(id)}/native-metadata`,
        { method: "PUT", body },
      );
      state.data.clients = {
        ...state.data.clients,
        content: clients.map((client) =>
          client.id === id
            ? { ...client, clientName: saved.clientName }
            : client,
        ),
      };
      delete state.data.clientMetadataDrafts[id];
      state.data.clientMetadataEditId = null;
      state.data.clientMetadataErrorId = null;
      state.notice = text("adminClientMetadataUpdated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-assignments") {
    const clientId = form.dataset.clientId ?? "";
    const clients = state.data.clients?.content ?? [];
    const assignments = state.data.clientScopeAssignments?.[clientId];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !clients.some((client) => client.id === clientId) ||
      !assignments
    )
      return;
    const available = new Set(
      (assignments.availableScopes ?? []).map((scope) => scope.name),
    );
    const body = {
      defaultScopes: [
        ...new Set(
          [...form.querySelectorAll('input[name="defaultScopes"]:checked')]
            .map((input) => input.value)
            .filter((name) => available.has(name)),
        ),
      ].sort(),
      optionalScopes: [
        ...new Set(
          [...form.querySelectorAll('input[name="optionalScopes"]:checked')]
            .map((input) => input.value)
            .filter((name) => available.has(name)),
        ),
      ].sort(),
    };
    const overlap = body.defaultScopes.some((name) =>
      body.optionalScopes.includes(name),
    );
    if (
      overlap ||
      body.defaultScopes.length + body.optionalScopes.length === 0
    ) {
      state.data.clientScopeAssignmentErrorId = clientId;
      render();
      return;
    }
    state.data.clientScopeAssignmentDrafts ??= {};
    state.data.clientScopeAssignmentDrafts[clientId] = body;
    state.data.clientScopeAssignmentErrorId = null;
    state.error = null;
    state.notice = null;
    state.busy = `client-scope-assignments-save:${clientId}`;
    render();
    try {
      const saved = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/scope-assignments`,
        { method: "PUT", body },
      );
      state.data.clientScopeAssignments[clientId] = saved;
      state.data.clientScopeAssignmentDrafts[clientId] = {
        defaultScopes: [...(saved.defaultScopes ?? [])],
        optionalScopes: [...(saved.optionalScopes ?? [])],
        availableScopes: saved.availableScopes ?? assignments.availableScopes,
      };
      state.data.clientScopeAssignmentErrorId = null;
      state.notice = text("adminClientScopeAssignmentsSaved");
    } catch {
      /* request rendered localized authorization, validation, or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-identity-provider-policy") {
    const id = form.dataset.providerId ?? "";
    const providers = state.data.identityProviders?.content ?? [];
    const provider = providers.find((item) => item.id === id);
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !provider ||
      !state.data.identityProviderPolicies?.[id] ||
      !form.reportValidity()
    )
      return;
    const body = {
      displayName: String(values.displayName ?? "").trim(),
      enabled: form.elements.namedItem("enabled").checked,
      hideOnLogin: form.elements.namedItem("hideOnLogin").checked,
      accountLinkingOnly: form.elements.namedItem("accountLinkingOnly").checked,
      trustEmail: form.elements.namedItem("trustEmail").checked,
      mfaRequired: form.elements.namedItem("mfaRequired").checked,
      guiOrder: Number(values.guiOrder),
      showInAccountConsole: String(values.showInAccountConsole ?? ""),
      syncMode: String(values.syncMode ?? ""),
    };
    state.data.identityProviderPolicyDrafts ??= {};
    state.data.identityProviderPolicyDrafts[id] = body;
    state.data.identityProviderPolicyErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `identity-provider-policy-save:${id}`;
    render();
    try {
      const saved = await request(
        `/api/admin/identity-providers/${id}/native-policy`,
        { method: "PUT", body },
      );
      state.data.identityProviderPolicies[id] = saved;
      state.data.identityProviders = {
        ...state.data.identityProviders,
        content: providers.map((item) =>
          item.id === id
            ? {
                ...item,
                displayName: saved.displayName,
                enabled: saved.enabled,
              }
            : item,
        ),
      };
      delete state.data.identityProviderPolicyDrafts[id];
      state.data.identityProviderPolicyErrorId = null;
      state.data.identityProviderPolicyOpenId = null;
      state.notice = text("adminIdentityProviderPolicyUpdated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-provider-mapper") {
    const providerId = form.dataset.providerId ?? "";
    const mapperId = form.dataset.mapperId || null;
    const providers = state.data.identityProviders?.content ?? [];
    const provider = providers.find((item) => item.id === providerId);
    const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
      !provider ||
      !Array.isArray(mappers) ||
      (mapperId !== null &&
        (!/^[A-Za-z0-9_-]{1,100}$/.test(mapperId) ||
          !mappers.some((mapper) => mapper.id === mapperId)))
    )
      return;
    if (!form.reportValidity()) return;
    const body = {
      name: String(values.name ?? "").trim(),
      sourceClaim: String(values.sourceClaim ?? "").trim(),
      target: String(values.target ?? "").trim(),
      mapperType: String(values.mapperType ?? ""),
      syncMode: String(values.syncMode ?? ""),
      addToIdToken: form.elements.namedItem("addToIdToken").checked,
      addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
    };
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(body.name) ||
      !body.sourceClaim ||
      body.sourceClaim.length > 200 ||
      !body.target ||
      body.target.length > 200 ||
      !["user-attribute", "claim", "role", "group"].includes(body.mapperType) ||
      !["inherit", "legacy", "import", "read_only", "force"].includes(
        body.syncMode,
      )
    )
      return;
    const draftKey = mapperId ?? "new";
    const errorKey = `${providerId}:${draftKey}`;
    state.data.providerMapperDrafts ??= {};
    state.data.providerMapperDrafts[providerId] ??= {};
    state.data.providerMapperDrafts[providerId][draftKey] = body;
    state.data.providerMapperErrorKey = errorKey;
    state.error = null;
    state.notice = null;
    state.busy = `provider-mapper-save:${errorKey}`;
    render();
    try {
      const path = `/api/admin/identity-providers/${providerId}/mappers${mapperId ? `/${mapperId}` : ""}`;
      const saved = await request(path, {
        method: mapperId ? "PUT" : "POST",
        body,
      });
      const savedMapper = saved ?? {
        ...body,
        id: mapperId,
        providerAlias: provider.alias,
      };
      state.data.identityProviderMappers[providerId] = mapperId
        ? mappers.map((mapper) =>
            mapper.id === mapperId ? savedMapper : mapper,
          )
        : [...mappers, savedMapper];
      state.data.identityProviders = {
        ...state.data.identityProviders,
        content: providers.map((item) =>
          item.id === providerId
            ? {
                ...item,
                mapperCount: mapperId
                  ? item.mapperCount
                  : (Number.isSafeInteger(item.mapperCount)
                      ? item.mapperCount
                      : 0) + 1,
              }
            : item,
        ),
      };
      delete state.data.providerMapperDrafts[providerId][draftKey];
      state.data.providerMapperEditor = null;
      state.data.providerMapperErrorKey = null;
      state.notice = text(
        mapperId ? "adminProviderMapperUpdated" : "adminProviderMapperCreated",
      );
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-mapper") {
    const scopeId = form.dataset.scopeId ?? "";
    const mapperId = form.dataset.mapperId || null;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (item) => item.id === scopeId,
    );
    const mappers = state.data.clientScopeMappers?.[scopeId] ?? [];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
      !scope ||
      scope.builtIn ||
      !Array.isArray(mappers) ||
      (mapperId !== null &&
        (!/^[1-9]\d*$/.test(mapperId) ||
          !mappers.some((item) => String(item.id) === mapperId)))
    )
      return;
    const body = {
      name: String(values.name ?? "").trim(),
      mapperType: String(values.mapperType ?? ""),
      source: String(values.source ?? "").trim() || null,
      claimName: String(values.claimName ?? "").trim() || null,
      value: String(values.value ?? "").trim() || null,
      priority: Number(values.priority ?? 100),
      addToIdToken: form.elements.namedItem("addToIdToken").checked,
      addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
    };
    const needsSource = [
      "user-property",
      "user-attribute",
      "group-attribute",
    ].includes(body.mapperType);
    const needsValue = ["hardcoded-claim", "audience"].includes(
      body.mapperType,
    );
    const usesAudienceClaim = ["audience", "audience-resolve"].includes(
      body.mapperType,
    );
    form.elements
      .namedItem("source")
      .setCustomValidity(
        needsSource && !body.source ? text("apiValidation") : "",
      );
    form.elements
      .namedItem("value")
      .setCustomValidity(
        needsValue && !body.value ? text("apiValidation") : "",
      );
    form.elements
      .namedItem("claimName")
      .setCustomValidity(
        !usesAudienceClaim && !body.claimName ? text("apiValidation") : "",
      );
    const idTokenTarget = form.elements.namedItem("addToIdToken");
    const accessClaimTarget = form.elements.namedItem("addToAccessToken");
    idTokenTarget.setCustomValidity(
      !body.addToIdToken && !body.addToAccessToken ? text("apiValidation") : "",
    );
    accessClaimTarget.setCustomValidity("");
    if (!form.reportValidity()) return;
    if (
      !body.name ||
      body.name.length > 100 ||
      ![
        "user-property",
        "user-attribute",
        "group-membership",
        "group-attribute",
        "application-role",
        "client-role",
        "audience",
        "audience-resolve",
        "hardcoded-claim",
        "email",
        "full-name",
        "locale",
        "username",
      ].includes(body.mapperType) ||
      (needsSource && !body.source) ||
      (needsValue && !body.value) ||
      (!usesAudienceClaim && !body.claimName) ||
      (body.source?.length ?? 0) > 200 ||
      (body.claimName?.length ?? 0) > 200 ||
      (body.value?.length ?? 0) > 1000 ||
      !Number.isSafeInteger(body.priority) ||
      body.priority < 0 ||
      body.priority > 10000 ||
      (!body.addToIdToken && !body.addToAccessToken)
    )
      return;
    const draftKey = mapperId ?? "new";
    const errorKey = `${scopeId}:${draftKey}`;
    state.data.clientScopeMapperDrafts ??= {};
    state.data.clientScopeMapperDrafts[scopeId] ??= {};
    state.data.clientScopeMapperDrafts[scopeId][draftKey] = body;
    state.data.clientScopeMapperErrorKey = errorKey;
    state.error = null;
    state.notice = null;
    state.busy = `client-scope-mapper-save:${errorKey}`;
    render();
    try {
      const saved = await request(
        `/api/admin/client-scopes/${scopeId}/mappers${mapperId ? `/${mapperId}` : ""}`,
        {
          method: mapperId ? "PUT" : "POST",
          body,
        },
      );
      state.data.clientScopeMappers[scopeId] = mapperId
        ? mappers.map((item) => (String(item.id) === mapperId ? saved : item))
        : [...mappers, saved];
      delete state.data.clientScopeMapperDrafts[scopeId][draftKey];
      state.data.clientScopeMapperEditor = null;
      state.data.clientScopeMapperErrorKey = null;
      state.notice = text(
        mapperId
          ? "adminClientScopeMapperUpdated"
          : "adminClientScopeMapperCreated",
      );
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-mapper") {
    const clientId = form.dataset.clientId ?? "";
    const mapperId = form.dataset.mapperId || null;
    const client = (state.data.clients?.content ?? []).find(
      (item) => String(item.id) === clientId,
    );
    const mappers = state.data.clientMappers?.[clientId] ?? [];
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !client ||
      !Array.isArray(mappers) ||
      (mapperId !== null &&
        (!/^[1-9]\d*$/.test(mapperId) ||
          !mappers.some((item) => String(item.id) === mapperId)))
    )
      return;
    const body = {
      name: String(values.name ?? "").trim(),
      mapperType: String(values.mapperType ?? ""),
      source: String(values.source ?? "").trim() || null,
      claimName: String(values.claimName ?? "").trim() || null,
      value: String(values.value ?? "").trim() || null,
      priority: Number(values.priority ?? 100),
      addToIdToken: form.elements.namedItem("addToIdToken").checked,
      addToAccessToken: form.elements.namedItem("addToAccessToken").checked,
    };
    const needsSource = [
      "user-property",
      "user-attribute",
      "group-attribute",
    ].includes(body.mapperType);
    const needsValue = ["hardcoded-claim", "audience"].includes(
      body.mapperType,
    );
    const usesAudienceClaim = ["audience", "audience-resolve"].includes(
      body.mapperType,
    );
    form.elements
      .namedItem("source")
      .setCustomValidity(
        needsSource && !body.source ? text("apiValidation") : "",
      );
    form.elements
      .namedItem("value")
      .setCustomValidity(
        needsValue && !body.value ? text("apiValidation") : "",
      );
    form.elements
      .namedItem("claimName")
      .setCustomValidity(
        !usesAudienceClaim && !body.claimName ? text("apiValidation") : "",
      );
    const idTokenTarget = form.elements.namedItem("addToIdToken");
    const accessClaimTarget = form.elements.namedItem("addToAccessToken");
    idTokenTarget.setCustomValidity(
      !body.addToIdToken && !body.addToAccessToken ? text("apiValidation") : "",
    );
    accessClaimTarget.setCustomValidity("");
    if (!form.reportValidity()) return;
    const mapperTypes = [
      "user-property",
      "user-attribute",
      "group-membership",
      "group-attribute",
      "application-role",
      "client-role",
      "audience",
      "audience-resolve",
      "hardcoded-claim",
      "email",
      "full-name",
      "locale",
      "username",
    ];
    if (
      !body.name ||
      body.name.length > 100 ||
      !mapperTypes.includes(body.mapperType) ||
      (needsSource && !body.source) ||
      (needsValue && !body.value) ||
      (!usesAudienceClaim && !body.claimName) ||
      (body.source?.length ?? 0) > 200 ||
      (body.claimName?.length ?? 0) > 200 ||
      (body.value?.length ?? 0) > 1000 ||
      !Number.isSafeInteger(body.priority) ||
      body.priority < 0 ||
      body.priority > 10000 ||
      (!body.addToIdToken && !body.addToAccessToken)
    )
      return;
    const draftKey = mapperId ?? "new";
    const errorKey = `${clientId}:${draftKey}`;
    state.data.clientMapperDrafts ??= {};
    state.data.clientMapperDrafts[clientId] ??= {};
    state.data.clientMapperDrafts[clientId][draftKey] = body;
    state.data.clientMapperErrorKey = errorKey;
    state.error = null;
    state.notice = null;
    state.busy = `client-mapper-save:${errorKey}`;
    render();
    try {
      const saved = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/mappers${mapperId ? `/${mapperId}` : ""}`,
        { method: mapperId ? "PUT" : "POST", body },
      );
      state.data.clientMappers[clientId] = mapperId
        ? mappers.map((item) => (String(item.id) === mapperId ? saved : item))
        : [...mappers, saved];
      delete state.data.clientMapperDrafts[clientId][draftKey];
      state.data.clientMapperEditor = null;
      state.data.clientMapperErrorKey = null;
      state.notice = text(
        mapperId ? "adminClientMapperUpdated" : "adminClientMapperCreated",
      );
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-group-roles") {
    const id = Number(form.dataset.groupId);
    const groups = state.data.groups?.content ?? [];
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !groups.some((group) => Number(group.id) === id)
    )
      return;
    const body = {
      roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
        (input) => input.value,
      ),
    };
    state.data.groupRoleDrafts ??= {};
    state.data.groupRoleDrafts[id] = body;
    state.data.groupRoleErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `group-roles-update:${id}`;
    render();
    try {
      await request(`/api/admin/groups/${id}/roles`, { method: "PUT", body });
      delete state.data.groupRoleDrafts[id];
      state.data.groupRoleErrorId = null;
      state.data.groupRolesOpenId = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminGroupRolesUpdated");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-group-rename") {
    const id = Number(form.dataset.groupId);
    const group = (state.data.groups?.content ?? []).find(
      (item) => Number(item.id) === id,
    );
    const name = String(values.name ?? "").trim();
    if (!Number.isSafeInteger(id) || id < 1 || !group || !form.reportValidity())
      return;
    state.data.groupNameDrafts ??= {};
    state.data.groupNameDrafts[id] = { name };
    state.data.groupNameErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `group-name-update:${id}`;
    render();
    try {
      await request(`/api/admin/groups/${id}/name`, {
        method: "PUT",
        body: { name },
      });
      delete state.data.groupNameDrafts[id];
      state.data.groupNameErrorId = null;
      state.data.groupNameOpenId = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminGroupRenamed");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-edit") {
    const id = Number(form.dataset.userId);
    const users = state.data.users?.content ?? [];
    const user = users.find((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !user || !form.reportValidity())
      return;
    const body = {
      username: String(values.username ?? "").trim(),
      firstName: String(values.firstName ?? "").trim() || null,
      lastName: String(values.lastName ?? "").trim() || null,
      email: String(values.email ?? "").trim() || null,
      emailVerified: form.elements.namedItem("emailVerified").checked,
      enabled: form.elements.namedItem("enabled").checked,
      roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
        (input) => input.value,
      ),
    };
    if (!body.email) body.emailVerified = false;
    if (!body.username || body.username.length > 100) return;
    if (body.roles.length === 0) {
      state.data.userEditDrafts ??= {};
      state.data.userEditDrafts[id] = body;
      state.data.userEditErrorId = id;
      state.data.userEditLocalError = text("adminUserRoleRequired");
      render();
      return;
    }
    state.data.userEditDrafts ??= {};
    state.data.userEditDrafts[id] = body;
    state.data.userEditErrorId = id;
    state.data.userEditLocalError = null;
    state.error = null;
    state.notice = null;
    state.busy = `user-update:${id}`;
    render();
    try {
      await request(`/api/admin/users/${id}`, { method: "PUT", body });
      delete state.data.userEditDrafts[id];
      state.data.userEditErrorId = null;
      state.data.userEditOpenId = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminUserProfileUpdated");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-localization-message-create") {
    if (!form.reportValidity()) return;
    const body = {
      locale: String(values.locale ?? "").trim(),
      bundle: String(values.bundle ?? "").trim(),
      messageKey: String(values.messageKey ?? "").trim(),
      messageValue: String(values.messageValue ?? "").trim(),
    };
    if (
      !/^[A-Za-z]{2,10}$/.test(body.locale) ||
      !/^[A-Za-z0-9_-]{1,50}$/.test(body.bundle) ||
      !/^[A-Za-z0-9_.-]{1,255}$/.test(body.messageKey) ||
      !body.messageValue ||
      body.messageValue.length > 4000
    )
      return;
    state.data.adminMessageOverrideCreateDraft = body;
    state.data.adminMessageOverrideErrorTarget = "create";
    state.busy = "admin-message-create";
    state.error = null;
    state.notice = null;
    render();
    try {
      await request("/api/admin/settings/localization/messages", {
        method: "POST",
        body,
      });
      await loadRoute({ keepContent: true });
      state.data.adminMessageOverrideCreateDraft = null;
      state.data.adminMessageOverrideErrorTarget = null;
      state.notice = text("adminMessageOverrideCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-edit") {
    const scopeId = form.dataset.scopeId ?? "";
    const scopeName = form.dataset.scopeName ?? "";
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(scopeId)) return;
    if (!scopeName || !form.reportValidity()) return;
    const body = {
      name: scopeName,
      displayName: String(values.displayName ?? "").trim() || null,
      description: String(values.description ?? "").trim() || null,
    };
    state.data.adminClientScopeDrafts ??= {};
    state.data.adminClientScopeDrafts[scopeId] = body;
    state.data.adminClientScopeErrorId = scopeId;
    state.error = null;
    state.notice = null;
    state.busy = `client-scope-update:${scopeId}`;
    render();
    try {
      await request(`/api/admin/client-scopes/${encodeURIComponent(scopeId)}`, {
        method: "PUT",
        body,
      });
      delete state.data.adminClientScopeDrafts[scopeId];
      state.data.adminClientScopeErrorId = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminClientScopeUpdated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-role-edit") {
    const roleName = form.dataset.roleName ?? "";
    if (!/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName)) return;
    if (!form.reportValidity()) return;
    const description = String(values.description ?? "").trim() || null;
    state.data.adminRoleDrafts ??= {};
    state.data.adminRoleDrafts[roleName] = {
      description: description ?? "",
    };
    state.error = null;
    state.notice = null;
    state.data.adminRoleErrorName = roleName;
    state.busy = `role-update:${roleName}`;
    render();
    try {
      await request(`/api/admin/roles/${encodeURIComponent(roleName)}`, {
        method: "PUT",
        body: { name: roleName, description },
      });
      delete state.data.adminRoleDrafts[roleName];
      state.data.adminRoleErrorName = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminRoleUpdated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-role-create") {
    const body = {
      name: String(values.name ?? "").trim(),
      description: String(values.description ?? "").trim() || null,
    };
    const localErrors = {};
    if (!body.name) localErrors.name = text("adminRoleNameRequired");
    else if (!/^ROLE_[A-Z0-9_]+$/.test(body.name))
      localErrors.name = text("adminRoleNameFormat");
    if ((body.description?.length ?? 0) > 500)
      localErrors.description = text("adminRoleDescriptionTooLong");
    if (Object.keys(localErrors).length > 0) {
      state.data.adminRoleCreateDraft = {
        name: body.name,
        description: body.description ?? "",
      };
      state.error = {
        kind: "validation",
        body: {
          detail: Object.values(localErrors)[0],
          violations: Object.entries(localErrors).map(([field, message]) => ({
            field,
            message,
          })),
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;
    state.data.adminRoleCreateDraft = body;
    state.error = null;
    state.notice = null;
    state.busy = "role-create";
    render();
    try {
      await request("/api/admin/roles", { method: "POST", body });
      state.data.adminRoleCreateDraft = null;
      state.data.roleQuery = "";
      state.data.rolePage = 0;
      state.route = "roles";
      await loadRoute();
      state.notice = text("adminRoleCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-group-create") {
    const body = {
      name: String(values.name ?? "").trim(),
      parentId: null,
      attributes: {},
      defaultGroup: false,
    };
    if (!body.name) {
      state.data.adminGroupCreateDraft = { name: body.name };
      state.error = {
        kind: "validation",
        body: {
          detail: text("adminGroupNameRequired"),
          violations: [
            { field: "name", message: text("adminGroupNameRequired") },
          ],
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;
    state.data.adminGroupCreateDraft = { name: body.name };
    state.error = null;
    state.notice = null;
    state.busy = "group-create";
    render();
    try {
      await request("/api/admin/groups", { method: "POST", body });
      state.data.adminGroupCreateDraft = null;
      state.data.groupQuery = "";
      state.data.groupPage = 0;
      state.route = "groups";
      await loadRoute();
      state.notice = text("adminGroupCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-group-child-create") {
    const parentId = Number(form.dataset.parentId);
    const parent = (state.data.groups?.content ?? []).find(
      (group) => Number(group.id) === parentId,
    );
    const name = String(values.name ?? "").trim();
    if (!Number.isSafeInteger(parentId) || parentId < 1 || !parent) return;
    if (!name) {
      state.data.groupChildCreateErrorId = parentId;
      state.data.groupChildCreateDrafts ??= {};
      state.data.groupChildCreateDrafts[parentId] = { name };
      state.error = {
        kind: "validation",
        body: {
          detail: text("adminGroupNameRequired"),
          violations: [
            { field: "name", message: text("adminGroupNameRequired") },
          ],
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;
    const body = {
      name,
      parentId,
      attributes: {},
      defaultGroup: false,
    };
    state.data.groupChildCreateErrorId = parentId;
    state.data.groupChildCreateDrafts ??= {};
    state.data.groupChildCreateDrafts[parentId] = { name };
    state.error = null;
    state.notice = null;
    state.busy = `group-child-create:${parentId}`;
    render();
    try {
      await request("/api/admin/groups", { method: "POST", body });
      delete state.data.groupChildCreateDrafts[parentId];
      state.data.groupChildCreateOpenId = null;
      state.data.groupChildCreateErrorId = null;
      state.data.groupQuery = "";
      state.data.groupPage = 0;
      await loadRoute();
      state.notice = text("adminChildGroupCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-create") {
    const body = {
      name: String(values.name ?? "").trim(),
      displayName: String(values.displayName ?? "").trim() || null,
      description: String(values.description ?? "").trim() || null,
    };
    const localErrors = {};
    if (!body.name) localErrors.name = text("adminClientScopeNameRequired");
    if ((body.displayName?.length ?? 0) > 200)
      localErrors.displayName = text("adminClientScopeDisplayNameTooLong");
    if ((body.description?.length ?? 0) > 500)
      localErrors.description = text("adminClientScopeDescriptionTooLong");
    if (Object.keys(localErrors).length > 0) {
      state.data.adminClientScopeCreateDraft = {
        name: body.name,
        displayName: body.displayName ?? "",
        description: body.description ?? "",
      };
      state.error = {
        kind: "validation",
        body: {
          detail: Object.values(localErrors)[0],
          violations: Object.entries(localErrors).map(([field, message]) => ({
            field,
            message,
          })),
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;
    state.data.adminClientScopeCreateDraft = body;
    state.error = null;
    state.notice = null;
    state.busy = "client-scope-create";
    render();
    try {
      await request("/api/admin/client-scopes", { method: "POST", body });
      state.data.adminClientScopeCreateDraft = null;
      state.data.clientScopeQuery = "";
      state.data.clientScopePage = 0;
      state.route = "client-scopes";
      await loadRoute();
      state.notice = text("adminClientScopeCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-create") {
    const createdUserId = Number(form.dataset.createdUserId);
    if (Number.isSafeInteger(createdUserId) && createdUserId > 0) {
      const attributes = profileAttributeValues(form);
      state.data.userCreateDraft ??= {};
      state.data.userCreateDraft.profile = attributes;
      state.busy = "user-create-profile-save";
      state.error = null;
      state.notice = null;
      render();
      try {
        await request(`/api/admin/users/${createdUserId}/profile-attributes`, {
          method: "PUT",
          body: { attributes },
        });
        state.data.userCreateDraft = null;
        state.data.userCreateCreatedUserId = null;
        state.data.userQuery = "";
        state.data.userPage = 0;
        state.route = "users";
        await loadRoute();
        state.notice = text("adminUserCreated");
      } catch {
        /* Preserve the created account and profile draft; retry only the profile save. */
      }
      state.busy = null;
      render();
      return;
    }
    const body = {
      username: String(values.username ?? "").trim(),
      firstName: String(values.firstName ?? "").trim() || null,
      lastName: String(values.lastName ?? "").trim() || null,
      email: String(values.email ?? "").trim() || null,
      emailVerified: form.elements.namedItem("emailVerified").checked,
      password: String(values.password ?? ""),
      temporary: form.elements.namedItem("temporary").checked,
      enabled: form.elements.namedItem("enabled").checked,
      roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(
        (input) => input.value,
      ),
    };
    if (!form.reportValidity()) return;
    state.data.userCreateDraft = { ...body };
    delete state.data.userCreateDraft.password;
    if (body.roles.length === 0) {
      state.error = {
        kind: "validation",
        body: {
          detail: text("adminUserRoleRequired"),
          violations: [
            { field: "roles", message: text("adminUserRoleRequired") },
          ],
        },
      };
      render();
      return;
    }
    state.busy = "user-create";
    state.error = null;
    state.notice = null;
    render();
    try {
      const createdUser = await request("/api/admin/users", {
        method: "POST",
        body,
      });
      if (
        Array.isArray(state.data.userCreateProfileDefinitions) &&
        state.data.userCreateProfileDefinitions.some(
          (definition) => definition.enabled && !definition.builtIn,
        )
      ) {
        if (
          !Number.isSafeInteger(Number(createdUser?.id)) ||
          Number(createdUser.id) < 1
        )
          throw new Error("Created user response missing ID");
        try {
          await request(
            `/api/admin/users/${Number(createdUser.id)}/profile-attributes`,
            {
              method: "PUT",
              body: { attributes: state.data.userCreateDraft?.profile ?? {} },
            },
          );
        } catch {
          state.data.userCreateCreatedUserId = Number(createdUser.id);
          throw new Error("Profile attributes require retry");
        }
      }
      state.data.userCreateDraft = null;
      state.data.userQuery = "";
      state.data.userPage = 0;
      state.route = "users";
      await loadRoute();
      state.notice = text("adminUserCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-localization-settings") {
    const body = {
      internationalizationEnabled: form.elements.namedItem(
        "internationalizationEnabled",
      ).checked,
      defaultLocale: String(values.defaultLocale ?? ""),
      supportedLocales: [
        ...form.querySelectorAll('input[name="supportedLocales"]:checked'),
      ].map((input) => input.value),
    };
    state.data.adminLocalizationDraft = body;
    state.busy = "admin-localization-settings";
    state.error = null;
    state.notice = null;
    render();
    try {
      const savedLocalization = await request(
        "/api/admin/settings/localization",
        { method: "PUT", body },
      );
      state.data.adminLocalization = {
        ...state.data.adminLocalization,
        ...savedLocalization,
      };
      state.data.adminLocalizationDraft = null;
      state.notice = text("adminLocalizationSaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-localization-message") {
    const id = Number(form.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const body = {
      locale: String(values.locale ?? "").trim(),
      bundle: String(values.bundle ?? "").trim(),
      messageKey: String(values.messageKey ?? "").trim(),
      messageValue: String(values.messageValue ?? "").trim(),
    };
    state.data.adminMessageOverrideDrafts ??= {};
    state.data.adminMessageOverrideDrafts[id] = { id, ...body };
    state.data.adminMessageOverrideErrorTarget = `update:${id}`;
    state.busy = `admin-message-${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const updated = await request(
        `/api/admin/settings/localization/messages/${id}`,
        { method: "PUT", body },
      );
      const page = state.data.adminMessageOverrides ?? { content: [] };
      state.data.adminMessageOverrides = {
        ...page,
        content: page.content.map((item) => (item.id === id ? updated : item)),
      };
      delete state.data.adminMessageOverrideDrafts[id];
      state.data.adminMessageOverrideErrorTarget = null;
      state.notice = text("adminMessageOverrideSaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-branding") {
    const body = {
      applicationName: String(values.applicationName ?? "").trim(),
      primaryColor: String(values.primaryColor ?? "").trim(),
      accentColor: String(values.accentColor ?? "").trim(),
      backgroundColor: String(values.backgroundColor ?? "").trim(),
    };
    state.data.adminBrandingDraft = body;
    state.busy = "admin-branding";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.adminBranding = await request("/api/admin/settings/branding", {
        method: "PUT",
        body,
      });
      state.data.adminBrandingDraft = null;
      state.notice = text("adminBrandingSaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-login-settings") {
    const body = {
      userRegistration: form.elements.namedItem("userRegistration").checked,
      forgotPassword: form.elements.namedItem("forgotPassword").checked,
      rememberMe: form.elements.namedItem("rememberMe").checked,
      loginWithEmail: form.elements.namedItem("loginWithEmail").checked,
      verifyEmail: form.elements.namedItem("verifyEmail").checked,
      sessionTimeoutMinutes: Number(values.sessionTimeoutMinutes),
      passwordMinimumLength: Number(values.passwordMinimumLength),
      bruteForceEnabled: form.elements.namedItem("bruteForceEnabled").checked,
      bruteForceMaxFailures: Number(values.bruteForceMaxFailures),
      otpEnabled: form.elements.namedItem("otpEnabled").checked,
      otpRequired: form.elements.namedItem("otpRequired").checked,
      passkeys: form.elements.namedItem("passkeys").checked,
    };
    if (!form.reportValidity()) return;
    state.data.adminLoginSettingsDraft = body;
    if (body.otpRequired && !body.otpEnabled) {
      const message = text("adminOtpRequiredNeedsEnabled");
      state.error = {
        message,
        body: { violations: [{ field: "otpRequired", message }] },
      };
      render();
      return;
    }
    state.busy = "admin-login-settings";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.adminLoginSettings = await request(
        "/api/admin/settings/login/native",
        { method: "PUT", body },
      );
      state.data.adminLoginSettingsDraft = null;
      state.notice = text("adminLoginPolicySaved");
    } catch {
      /* request rendered localized authorization or validation feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-email-settings") {
    const current = state.data.adminEmailSettings ?? {};
    const draft = state.data.adminEmailDraft ?? {};
    const body = {
      enabled: form.elements.namedItem("enabled").checked,
      fromAddress: String(values.fromAddress ?? "").trim(),
      baseUrl: String(values.baseUrl ?? "").trim(),
      host: String(values.host ?? "").trim(),
      port: Number(values.port),
      username:
        String(values.username ?? "").trim() ||
        draft.username ||
        current.username ||
        "",
      password: String(values.password ?? ""),
      smtpAuth: form.elements.namedItem("smtpAuth").checked,
      starttls: form.elements.namedItem("starttls").checked,
      ssl: form.elements.namedItem("ssl").checked,
    };
    if (!form.reportValidity()) return;
    state.data.adminEmailDraft = { ...body };
    delete state.data.adminEmailDraft.password;
    state.busy = "admin-email-settings";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.adminEmailSettings = await request(
        "/api/admin/settings/email",
        { method: "PUT", body },
      );
      state.data.adminEmailDraft = null;
      state.notice = text("adminEmailSettingsSaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-ciba-policy") {
    const body = {
      requestLifespanSeconds: Number(values.requestLifespanSeconds),
      pollingIntervalSeconds: Number(values.pollingIntervalSeconds),
      deliveryMode: String(values.deliveryMode),
      userVerification: String(values.userVerification),
      mfaRequired: form.elements.namedItem("mfaRequired").checked,
      stepUpRequired: form.elements.namedItem("stepUpRequired").checked,
      stepUpAcr: String(values.stepUpAcr ?? "").trim() || null,
    };
    state.data.cibaPolicyDraft = body;
    state.busy = "admin-ciba-policy";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.cibaPolicy = await request("/api/admin/settings/ciba-policy", {
        method: "PUT",
        body,
      });
      state.data.cibaPolicyDraft = null;
      state.notice = text("adminPolicySaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-offline-access-policy") {
    const body = {
      idleTimeout: String(values.idleTimeout ?? "").trim(),
      maxLifespan: String(values.maxLifespan ?? "").trim() || null,
      maxLimited: form.elements.namedItem("maxLimited").checked,
    };
    state.data.offlineAccessPolicyDraft = body;
    state.busy = "admin-offline-access-policy";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.offlineAccessPolicy = await request(
        "/api/admin/settings/offline-access",
        { method: "PUT", body },
      );
      state.data.offlineAccessPolicyDraft = null;
      state.notice = text("adminPolicySaved");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "profile") {
    state.data.accountProfileDraft = {
      firstName: String(values.firstName ?? ""),
      lastName: String(values.lastName ?? ""),
      email: String(values.email ?? ""),
      preferredLocale: String(values.preferredLocale ?? "en"),
    };
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
      state.error = {
        message: text("invalidEmail"),
        body: {
          violations: [{ field: "email", message: text("invalidEmail") }],
        },
      };
      render();
      return;
    }
    state.busy = "profile";
    state.error = null;
    render();
    try {
      state.profile = await request("/api/account/profile", {
        method: "PUT",
        body: {
          firstName: String(values.firstName).trim(),
          lastName: String(values.lastName).trim(),
          email: String(values.email).trim(),
          currentPassword: String(values.currentPassword).trim() || undefined,
        },
      });
      await request("/api/auth/localization/me", {
        method: "PUT",
        body: { locale: values.preferredLocale },
      });
      state.data.accountProfileDraft = null;
      state.notice = text("passwordSaved");
    } catch {
      /* request rendered the sanitized error */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "password") {
    if (
      String(values.newPassword).length < 12 ||
      values.newPassword !== values.confirmPassword
    ) {
      state.error = { message: text("passwordMismatch") };
      render();
      return;
    }
    state.busy = "password";
    state.error = null;
    render();
    try {
      await request("/api/account/password", {
        method: "PUT",
        body: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      });
      state.notice = text("passwordSaved");
      form.reset();
    } catch {
      /* request rendered the sanitized error */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "delete") {
    if (!values.deletePassword) {
      state.error = { message: text("passwordRequired") };
      render();
      return;
    }
    if (!confirm(text("deleteAccountConfirm"))) return;
    state.busy = "delete";
    state.error = null;
    render();
    try {
      await request("/api/account", {
        method: "DELETE",
        body: { currentPassword: values.deletePassword },
      });
      await api.auth.clearSession(state.console);
      state.session = null;
      state.notice = text("deleteAccount");
    } catch {
      /* request rendered the sanitized error */
    }
    state.busy = null;
    render();
  }
}

async function action(action, element) {
  if (action === "admin-client-scope-role-mappings-toggle") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (candidate) => candidate.id === scopeId,
    );
    if (
      typeof scopeId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
      !scope ||
      scope.builtIn
    )
      return;
    if (state.data.adminClientScopeRoleMappingsOpenId === scopeId) {
      state.data.adminClientScopeRoleMappingsOpenId = null;
      render();
      return;
    }
    state.data.adminClientScopeRoleMappingsOpenId = scopeId;
    state.busy = `client-scope-role-mappings-load:${scopeId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const current = await request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
      );
      state.data.adminClientScopeRoleMappings ??= {};
      state.data.adminClientScopeRoleMappings[scopeId] = {
        current,
        draft: {
          applicationRoles: [...(current.applicationRoles ?? [])],
          clientRoleIds: (current.clientRoles ?? []).map((role) => role.id),
        },
        applicationRoleQuery: "",
        clientRoleIdsQuery: "",
      };
      await Promise.all([
        loadClientScopeRoleCandidates(scopeId, "applicationRoles", 0),
        loadClientScopeRoleCandidates(scopeId, "clientRoleIds", 0),
      ]);
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-scope-role-mappings-save") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (candidate) => candidate.id === scopeId,
    );
    const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
    const panel = document.querySelector(
      `[data-client-scope-role-mappings-panel][data-scope-id="${CSS.escape(scopeId ?? "")}"]`,
    );
    if (
      typeof scopeId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
      !scope ||
      scope.builtIn ||
      !mapping ||
      !panel
    )
      return;
    const applicationRoles = [
      ...new Set(
        [...panel.querySelectorAll('input[name="applicationRoles"]:checked')]
          .map((input) => input.value.trim())
          .filter(Boolean),
      ),
    ].sort();
    const clientRoleIds = [
      ...new Set(
        [...panel.querySelectorAll('input[name="clientRoleIds"]:checked')]
          .map((input) => Number(input.value))
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ].sort((left, right) => left - right);
    const body = { applicationRoles, clientRoleIds };
    mapping.draft = body;
    state.busy = `client-scope-role-mappings-save:${scopeId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const saved = await request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
        { method: "PUT", body },
      );
      mapping.current = saved;
      mapping.draft = {
        applicationRoles: [...(saved.applicationRoles ?? [])],
        clientRoleIds: (saved.clientRoles ?? []).map((role) => role.id),
      };
      state.notice = text("adminClientScopeRoleMappingsSaved");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-scope-role-mappings-cancel") {
    if (state.busy) return;
    const scopeId = element.dataset.id;
    const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
    if (!mapping) return;
    mapping.draft = {
      applicationRoles: [...(mapping.current.applicationRoles ?? [])],
      clientRoleIds: (mapping.current.clientRoles ?? []).map((role) => role.id),
    };
    state.data.adminClientScopeRoleMappingsOpenId = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-scope-mappers-toggle") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (item) => item.id === scopeId,
    );
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") ||
      !scope ||
      scope.builtIn
    )
      return;
    if (state.data.clientScopeMappersOpenId === scopeId) {
      state.data.clientScopeMappersOpenId = null;
      render();
      return;
    }
    const cached = state.data.clientScopeMappers?.[scopeId];
    if (Array.isArray(cached)) {
      state.data.clientScopeMappersOpenId = scopeId;
      render();
      return;
    }
    state.busy = `client-scope-mappers:${scopeId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const page = await request(
        `/api/admin/client-scopes/${scopeId}/mappers?page=0&size=20&sort=name,asc`,
      );
      state.data.clientScopeMappers ??= {};
      state.data.clientScopeMappers[scopeId] = Array.isArray(page?.content)
        ? page.content
        : [];
      state.data.clientScopeMappersOpenId = scopeId;
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-mappers-toggle") {
    if (state.busy || state.offline) return;
    const clientId = element.dataset.id;
    const client = (state.data.clients?.content ?? []).find(
      (item) => String(item.id) === clientId,
    );
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "") || !client) return;
    if (state.data.clientMappersOpenId === clientId) {
      state.data.clientMappersOpenId = null;
      render();
      return;
    }
    state.data.clientMappersOpenId = clientId;
    if (Array.isArray(state.data.clientMappers?.[clientId])) {
      render();
      return;
    }
    state.busy = `client-mappers-load:${clientId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const page = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/mappers?page=0&size=20&sort=name,asc`,
      );
      state.data.clientMappers ??= {};
      state.data.clientMappers[clientId] = Array.isArray(page?.content)
        ? page.content
        : [];
    } catch {
      state.data.clientMappersOpenId = null;
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-mapper-create") {
    if (state.busy || state.offline) return;
    const clientId = element.dataset.id;
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "") ||
      !(state.data.clients?.content ?? []).some(
        (item) => String(item.id) === clientId,
      ) ||
      !Array.isArray(state.data.clientMappers?.[clientId])
    )
      return;
    state.data.clientMappersOpenId = clientId;
    state.data.clientMapperEditor = { clientId, mapperId: null };
    state.data.clientMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-mapper-edit") {
    if (state.busy || state.offline) return;
    const clientId = element.dataset.id;
    const mapperId = element.dataset.mapper;
    const mappers = state.data.clientMappers?.[clientId] ?? [];
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "") ||
      !/^[1-9]\d*$/.test(mapperId ?? "") ||
      !(state.data.clients?.content ?? []).some(
        (item) => String(item.id) === clientId,
      ) ||
      !Array.isArray(mappers) ||
      !mappers.some((item) => String(item.id) === mapperId)
    )
      return;
    state.data.clientMappersOpenId = clientId;
    state.data.clientMapperEditor = { clientId, mapperId };
    state.data.clientMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-mapper-editor-cancel") {
    if (state.busy) return;
    const clientId = element.dataset.id;
    const editor = state.data.clientMapperEditor;
    if (editor?.clientId !== clientId) return;
    delete state.data.clientMapperDrafts?.[clientId]?.[
      editor.mapperId ?? "new"
    ];
    state.data.clientMapperEditor = null;
    state.data.clientMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (
    action === "admin-client-mapper-delete-request" ||
    action === "admin-client-mapper-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const clientId = element.dataset.id;
    const mapperId = element.dataset.mapper;
    const mappers = state.data.clientMappers?.[clientId] ?? [];
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "") ||
      !/^[1-9]\d*$/.test(mapperId ?? "") ||
      !(state.data.clients?.content ?? []).some(
        (item) => String(item.id) === clientId,
      ) ||
      !Array.isArray(mappers) ||
      !mappers.some((item) => String(item.id) === mapperId)
    )
      return;
    if (action === "admin-client-mapper-delete-request") {
      state.data.clientMapperDeleteConfirm = { clientId, mapperId };
      render();
      return;
    }
    const confirmation = state.data.clientMapperDeleteConfirm;
    if (
      confirmation?.clientId !== clientId ||
      confirmation?.mapperId !== mapperId
    )
      return;
    state.busy = `client-mapper-delete:${clientId}:${mapperId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/mappers/${mapperId}`,
        { method: "DELETE" },
      );
      state.data.clientMappers[clientId] = mappers.filter(
        (item) => String(item.id) !== mapperId,
      );
      state.data.clientMapperDeleteConfirm = null;
      state.notice = text("adminClientMapperDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-mapper-delete-cancel") {
    if (state.busy) return;
    const confirmation = state.data.clientMapperDeleteConfirm;
    if (
      confirmation?.clientId !== element.dataset.id ||
      confirmation?.mapperId !== element.dataset.mapper
    )
      return;
    state.data.clientMapperDeleteConfirm = null;
    render();
    return;
  }
  if (action === "admin-client-scope-mapper-create") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (item) => item.id === scopeId,
    );
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") ||
      !scope ||
      scope.builtIn ||
      !Array.isArray(state.data.clientScopeMappers?.[scopeId])
    )
      return;
    state.data.clientScopeMappersOpenId = scopeId;
    state.data.clientScopeMapperEditor = { scopeId, mapperId: null };
    state.data.clientScopeMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-scope-mapper-edit") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const mapperId = element.dataset.mapper;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (item) => item.id === scopeId,
    );
    const mappers = state.data.clientScopeMappers?.[scopeId] ?? [];
    if (
      !scope ||
      scope.builtIn ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") ||
      !/^[1-9]\d*$/.test(mapperId ?? "") ||
      !Array.isArray(mappers) ||
      !mappers.some((item) => String(item.id) === mapperId)
    )
      return;
    state.data.clientScopeMappersOpenId = scopeId;
    state.data.clientScopeMapperEditor = { scopeId, mapperId };
    state.data.clientScopeMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-scope-mapper-editor-cancel") {
    if (state.busy) return;
    const scopeId = element.dataset.id;
    const editor = state.data.clientScopeMapperEditor;
    if (editor?.scopeId !== scopeId) return;
    delete state.data.clientScopeMapperDrafts?.[scopeId]?.[
      editor.mapperId ?? "new"
    ];
    state.data.clientScopeMapperEditor = null;
    state.data.clientScopeMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (
    action === "admin-client-scope-mapper-delete-request" ||
    action === "admin-client-scope-mapper-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const mapperId = element.dataset.mapper;
    const scope = (state.data.clientScopes?.content ?? []).find(
      (item) => item.id === scopeId,
    );
    const mappers = state.data.clientScopeMappers?.[scopeId] ?? [];
    if (
      !scope ||
      scope.builtIn ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") ||
      !/^[1-9]\d*$/.test(mapperId ?? "") ||
      !Array.isArray(mappers) ||
      !mappers.some((item) => String(item.id) === mapperId)
    )
      return;
    if (action === "admin-client-scope-mapper-delete-request") {
      state.data.clientScopeMapperDeleteConfirm = { scopeId, mapperId };
      render();
      return;
    }
    const confirmation = state.data.clientScopeMapperDeleteConfirm;
    if (
      confirmation?.scopeId !== scopeId ||
      confirmation?.mapperId !== mapperId
    )
      return;
    state.busy = `client-scope-mapper-delete:${scopeId}:${mapperId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/client-scopes/${scopeId}/mappers/${mapperId}`, {
        method: "DELETE",
      });
      state.data.clientScopeMappers[scopeId] = mappers.filter(
        (item) => String(item.id) !== mapperId,
      );
      state.data.clientScopeMapperDeleteConfirm = null;
      state.notice = text("adminClientScopeMapperDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-scope-mapper-delete-cancel") {
    if (state.busy) return;
    const confirmation = state.data.clientScopeMapperDeleteConfirm;
    if (
      confirmation?.scopeId !== element.dataset.id ||
      confirmation?.mapperId !== element.dataset.mapper
    )
      return;
    state.data.clientScopeMapperDeleteConfirm = null;
    render();
    return;
  }
  if (
    action === "admin-offline-access-revoke-request" ||
    action === "admin-offline-access-revoke-confirm"
  ) {
    if (state.busy || state.offline) return;
    if (action === "admin-offline-access-revoke-request") {
      state.data.offlineAccessRevokeConfirm = true;
      render();
      return;
    }
    if (!state.data.offlineAccessRevokeConfirm) return;
    state.busy = "admin-offline-access-revoke";
    state.error = null;
    state.notice = null;
    render();
    try {
      state.data.offlineAccessPolicy = await request(
        "/api/admin/settings/offline-access/revoke-all",
        { method: "POST" },
      );
      state.data.offlineAccessRevokeConfirm = false;
      state.notice = text("adminRevokeAllOfflineTokensDone");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-offline-access-revoke-cancel") {
    if (state.busy) return;
    state.data.offlineAccessRevokeConfirm = false;
    render();
    return;
  }
  if (
    action === "admin-key-rotate-request" ||
    action === "admin-key-rotate-confirm"
  ) {
    if (state.busy || state.offline) return;
    if (action === "admin-key-rotate-request") {
      state.data.adminKeyRotateConfirm = true;
      state.error = null;
      render();
      return;
    }
    if (!state.data.adminKeyRotateConfirm) return;
    state.busy = "admin-key-rotate";
    state.error = null;
    state.notice = null;
    render();
    try {
      await request("/api/admin/keys/rotate", { method: "POST" });
      state.data.adminKeyQuery = "";
      state.data.adminKeyActive = "true";
      state.data.adminKeyPage = 0;
      await loadRoute({ keepContent: true });
      state.data.adminKeyRotateConfirm = false;
      state.notice = text("adminSigningKeyRotated");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-key-rotate-cancel") {
    if (state.busy) return;
    state.data.adminKeyRotateConfirm = false;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-user-bulk-select") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !(state.data.users?.content ?? []).some((user) => Number(user.id) === id)
    )
      return;
    const selected = new Set(
      (state.data.adminSelectedUserIds ?? []).map(Number),
    );
    if (element.checked) selected.add(id);
    else selected.delete(id);
    state.data.adminSelectedUserIds = [...selected].slice(0, 100);
    state.data.adminUserBulkConfirmAction = null;
    render();
    return;
  }
  if (
    action === "admin-user-bulk-enable" ||
    action === "admin-user-bulk-disable" ||
    action === "admin-user-bulk-delete"
  ) {
    if (state.busy || state.offline) return;
    const selected = state.data.adminSelectedUserIds ?? [];
    if (!selected.length || selected.length > 100) return;
    state.data.adminUserBulkConfirmAction = action
      .slice("admin-user-bulk-".length)
      .toUpperCase();
    render();
    return;
  }
  if (action === "admin-user-bulk-cancel") {
    if (state.busy) return;
    state.data.adminUserBulkConfirmAction = null;
    render();
    return;
  }
  if (action === "admin-user-bulk-confirm") {
    if (state.busy || state.offline) return;
    const userIds = [
      ...new Set(
        (state.data.adminSelectedUserIds ?? [])
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];
    const bulkAction = state.data.adminUserBulkConfirmAction;
    if (
      !userIds.length ||
      userIds.length > 100 ||
      !["ENABLE", "DISABLE", "DELETE"].includes(bulkAction)
    )
      return;
    state.busy = "user-bulk-action";
    state.error = null;
    state.notice = null;
    render();
    try {
      await request("/api/admin/users/bulk", {
        method: "POST",
        body: { userIds, action: bulkAction },
      });
      state.data.adminSelectedUserIds = [];
      state.data.adminUserBulkConfirmAction = null;
      await loadRoute({ keepContent: true });
      state.notice = text("adminBulkUsersUpdated");
    } catch {
      /* request rendered localized authorization, validation, or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-user-avatar-toggle" ||
    action === "admin-user-avatar-close"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    state.data.userAvatarOpenId =
      action === "admin-user-avatar-close" ||
      Number(state.data.userAvatarOpenId) === id
        ? null
        : id;
    state.data.adminAvatarDeleteConfirmId = null;
    delete state.data.adminAvatarErrors?.[id];
    render();
    return;
  }
  if (
    action === "admin-user-avatar-delete-request" ||
    action === "admin-user-avatar-delete-cancel"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    state.data.adminAvatarDeleteConfirmId =
      action === "admin-user-avatar-delete-request" && userAvatarSource(user)
        ? id
        : null;
    render();
    return;
  }
  if (action === "admin-user-avatar-upload") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    const fileInput = element
      .closest("article")
      ?.querySelector(`[data-admin-avatar-file="${id}"]`);
    const file = fileInput?.files?.[0];
    if (!Number.isSafeInteger(id) || id < 1 || !user || !file) {
      state.data.adminAvatarErrors ??= {};
      state.data.adminAvatarErrors[id] = text("adminUserAvatarHelp");
      render();
      return;
    }
    state.data.adminAvatarErrors ??= {};
    state.busy = `admin-avatar-upload:${id}`;
    delete state.data.adminAvatarErrors[id];
    state.error = null;
    state.notice = null;
    render();
    try {
      const payload = await encodeAvatarFile(file);
      const result = await request(`/api/admin/users/${id}/avatar`, {
        method: "PUT",
        body: payload,
      });
      if (typeof result?.avatarUrl !== "string")
        throw new Error("Invalid avatar response");
      user.avatarUrl = result.avatarUrl;
      state.notice = text("adminUserAvatarUpdated");
    } catch (error) {
      if (error?.message === "invalid_avatar") {
        state.data.adminAvatarErrors[id] = text("adminUserAvatarHelp");
      }
    } finally {
      state.busy = null;
      render();
    }
    return;
  }
  if (action === "admin-user-avatar-delete-confirm") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !userAvatarSource(user ?? {}))
      return;
    state.busy = `admin-avatar-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}/avatar`, { method: "DELETE" });
      user.avatarUrl = null;
      state.data.adminAvatarDeleteConfirmId = null;
      state.notice = text("adminUserAvatarRemoved");
    } catch {
      /* request rendered localized authorization or transport feedback */
    } finally {
      state.busy = null;
      render();
    }
    return;
  }
  if (
    action === "admin-user-profile-attributes-toggle" ||
    action === "admin-user-profile-attributes-close"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (
      action === "admin-user-profile-attributes-close" ||
      Number(state.data.userProfileAttributesOpenId) === id
    ) {
      delete state.data.adminUserProfileAttributes?.[id];
      delete state.data.adminProfileAttributeDrafts?.[id];
      state.data.userProfileAttributesOpenId = null;
      state.data.adminProfileAttributesErrorId = null;
      render();
      return;
    }
    state.busy = `user-profile-attributes-load:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const profile = await request(
        `/api/admin/users/${id}/profile-attributes`,
      );
      state.data.adminUserProfileAttributes ??= {};
      state.data.adminUserProfileAttributes[id] = profile;
      state.data.userProfileAttributesOpenId = id;
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-user-action-email-toggle" ||
    action === "admin-user-action-email-close"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user?.email) return;
    if (
      action === "admin-user-action-email-close" ||
      Number(state.data.userActionEmailOpenId) === id
    ) {
      state.data.userActionEmailOpenId = null;
      delete state.data.adminUserActionEmailDrafts?.[id];
      render();
      return;
    }
    state.data.userActionEmailOpenId = id;
    state.data.adminUserActionEmailDrafts ??= {};
    state.data.adminUserActionEmailDrafts[id] ??= {
      action: "UPDATE_PASSWORD",
      lifespan: "43200",
    };
    render();
    return;
  }
  if (action === "admin-user-edit-toggle") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (Number(state.data.userEditOpenId) === id) {
      state.data.userEditOpenId = null;
      render();
      return;
    }
    if (!Array.isArray(state.data.userEditRoles)) {
      state.busy = `user-edit-roles:${id}`;
      state.error = null;
      render();
      try {
        const rolePage = await request(
          "/api/admin/roles?page=0&size=100&sort=name,asc",
        );
        state.data.userEditRoles = Array.isArray(rolePage?.content)
          ? rolePage.content
          : [];
      } catch {
        state.busy = null;
        render();
        return;
      }
      state.busy = null;
    }
    state.data.userEditOpenId = id;
    state.data.userEditErrorId = null;
    state.data.userEditLocalError = null;
    render();
    return;
  }
  if (action === "admin-user-edit-cancel") {
    if (state.busy) return;
    const id = Number(element.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (state.data.userEditDrafts) delete state.data.userEditDrafts[id];
    state.data.userEditOpenId = null;
    state.data.userEditErrorId = null;
    state.data.userEditLocalError = null;
    render();
    return;
  }
  if (
    action === "admin-user-toggle-enabled" ||
    action === "admin-user-toggle-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const users = state.data.users?.content ?? [];
    const user = users.find((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (action === "admin-user-toggle-enabled" && user.enabled) {
      state.data.userDisableConfirmId = id;
      render();
      return;
    }
    if (
      action === "admin-user-toggle-confirm" &&
      Number(state.data.userDisableConfirmId) !== id
    )
      return;
    const enabled = !user.enabled;
    state.busy = `user-enabled:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}/enabled`, {
        method: "PUT",
        body: { enabled },
      });
      state.data.users = {
        ...state.data.users,
        content: users.map((item) =>
          Number(item.id) === id ? { ...item, enabled } : item,
        ),
      };
      state.data.userDisableConfirmId = null;
      state.notice = text("adminUserEnabledUpdated");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-user-totp-reset-request" ||
    action === "admin-user-totp-reset-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (action === "admin-user-totp-reset-request") {
      state.data.userTotpResetConfirmId = id;
      render();
      return;
    }
    if (Number(state.data.userTotpResetConfirmId) !== id) return;
    state.busy = `user-totp-reset:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}/totp`, { method: "DELETE" });
      state.data.users = {
        ...state.data.users,
        content: (state.data.users?.content ?? []).map((item) =>
          Number(item.id) === id ? { ...item, totpEnabled: false } : item,
        ),
      };
      state.data.userTotpResetConfirmId = null;
      state.notice = text("adminAuthenticatorReset");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-unlock") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const users = state.data.users?.content ?? [];
    const user = users.find((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !user?.locked) return;
    state.busy = `user-unlock:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}/unlock`, { method: "POST" });
      state.data.users = {
        ...state.data.users,
        content: users.map((item) =>
          Number(item.id) === id
            ? { ...item, locked: false, lockedUntil: null, failedLoginCount: 0 }
            : item,
        ),
      };
      state.notice = text("adminUserUnlocked");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-user-password-reset-toggle" ||
    action === "admin-user-password-reset-cancel"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    state.data.userPasswordResetOpenId =
      action === "admin-user-password-reset-cancel" ||
      Number(state.data.userPasswordResetOpenId) === id
        ? null
        : id;
    state.data.userPasswordResetErrorId = null;
    state.error = null;
    render();
    return;
  }
  if (
    action === "admin-user-passkeys-toggle" ||
    action === "admin-user-passkeys-close"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const user = (state.data.users?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (
      action === "admin-user-passkeys-close" ||
      Number(state.data.userPasskeysOpenId) === id
    ) {
      state.data.userPasskeysOpenId = null;
      state.data.adminPasskeyEditTarget = null;
      state.data.adminPasskeyDeleteConfirmTarget = null;
      render();
      return;
    }
    state.busy = `user-passkeys-load:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const page = await request(
        `/api/admin/users/${id}/webauthn/credentials?page=0&size=100`,
      );
      state.data.adminUserPasskeys ??= {};
      state.data.adminUserPasskeys[id] = page;
      state.data.userPasskeysOpenId = id;
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-passkey-page") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const pageNumber = Number(element.dataset.index);
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 0 ||
      Number(state.data.userPasskeysOpenId) !== id
    )
      return;
    state.busy = `admin-passkey-page:${id}:${pageNumber}`;
    state.error = null;
    render();
    try {
      const page = await request(
        `/api/admin/users/${id}/webauthn/credentials?page=${pageNumber}&size=100`,
      );
      state.data.adminUserPasskeys[id] = page;
      state.data.adminPasskeyEditTarget = null;
      state.data.adminPasskeyDeleteConfirmTarget = null;
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-passkey-rename-toggle") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const index = Number(element.dataset.index);
    const target = `${id}:${index}`;
    if (!adminUserPasskeyPath(id, index)) return;
    state.data.adminPasskeyEditTarget =
      state.data.adminPasskeyEditTarget === target ? null : target;
    state.data.adminPasskeyErrorTarget = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-user-passkey-rename-cancel") {
    if (state.busy) return;
    const target = `${Number(element.dataset.id)}:${Number(element.dataset.index)}`;
    delete state.data.adminPasskeyDrafts?.[target];
    state.data.adminPasskeyEditTarget = null;
    state.data.adminPasskeyErrorTarget = null;
    state.error = null;
    render();
    return;
  }
  if (
    action === "admin-user-passkey-delete-request" ||
    action === "admin-user-passkey-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const index = Number(element.dataset.index);
    const target = `${id}:${index}`;
    const path = adminUserPasskeyPath(id, index);
    if (!path || Number(state.data.userPasskeysOpenId) !== id) return;
    if (action === "admin-user-passkey-delete-request") {
      state.data.adminPasskeyDeleteConfirmTarget = target;
      render();
      return;
    }
    if (state.data.adminPasskeyDeleteConfirmTarget !== target) return;
    state.busy = `admin-passkey-delete:${target}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(path, { method: "DELETE" });
      const page = state.data.adminUserPasskeys[id];
      const content = page.content.filter(
        (_, passkeyIndex) => passkeyIndex !== index,
      );
      const totalElements = Math.max(0, Number(page.totalElements ?? 0) - 1);
      state.data.adminUserPasskeys[id] = {
        ...page,
        content,
        totalElements,
        totalPages: Math.ceil(totalElements / 100),
      };
      state.data.adminPasskeyDeleteConfirmTarget = null;
      state.notice = text("adminPasskeyDeleted");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-passkey-delete-cancel") {
    if (state.busy) return;
    state.data.adminPasskeyDeleteConfirmTarget = null;
    render();
    return;
  }
  if (action === "admin-user-totp-reset-cancel") {
    if (state.busy) return;
    state.data.userTotpResetConfirmId = null;
    render();
    return;
  }
  if (action === "admin-user-toggle-cancel") {
    if (state.busy) return;
    state.data.userDisableConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-user-delete-request" ||
    action === "admin-user-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const users = state.data.users?.content ?? [];
    const user = users.find((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (action === "admin-user-delete-request") {
      state.data.userDeleteConfirmId = id;
      render();
      return;
    }
    if (Number(state.data.userDeleteConfirmId) !== id) return;
    state.busy = `user-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}`, { method: "DELETE" });
      state.data.users = {
        ...state.data.users,
        content: users.filter((item) => Number(item.id) !== id),
      };
      state.data.userDeleteConfirmId = null;
      state.notice = text("adminUserDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-delete-cancel") {
    if (state.busy) return;
    state.data.userDeleteConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-group-delete-request" ||
    action === "admin-group-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const groups = state.data.groups?.content ?? [];
    const group = groups.find((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !group) return;
    if (action === "admin-group-delete-request") {
      state.data.groupDeleteConfirmId = id;
      render();
      return;
    }
    if (Number(state.data.groupDeleteConfirmId) !== id) return;
    state.busy = `group-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/groups/${id}`, { method: "DELETE" });
      state.data.groups = {
        ...state.data.groups,
        content: groups.filter((item) => Number(item.id) !== id),
      };
      state.data.groupDeleteConfirmId = null;
      state.notice = text("adminGroupDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-group-delete-cancel") {
    if (state.busy) return;
    state.data.groupDeleteConfirmId = null;
    render();
    return;
  }
  if (action === "admin-group-child-create-toggle") {
    if (state.busy || state.offline) return;
    const parentId = Number(element.dataset.id);
    const parent = (state.data.groups?.content ?? []).find(
      (group) => Number(group.id) === parentId,
    );
    if (!Number.isSafeInteger(parentId) || parentId < 1 || !parent) return;
    if (Number(state.data.groupChildCreateOpenId) === parentId) {
      state.data.groupChildCreateOpenId = null;
      state.data.groupChildCreateErrorId = null;
      delete state.data.groupChildCreateDrafts?.[parentId];
    } else {
      state.data.groupChildCreateOpenId = parentId;
      state.data.groupChildCreateErrorId = null;
      state.data.groupChildCreateDrafts ??= {};
      state.data.groupChildCreateDrafts[parentId] ??= { name: "" };
      state.error = null;
    }
    render();
    return;
  }
  if (action === "admin-group-child-create-cancel") {
    if (state.busy) return;
    const parentId = Number(element.dataset.id);
    if (!Number.isSafeInteger(parentId) || parentId < 1) return;
    state.data.groupChildCreateOpenId = null;
    state.data.groupChildCreateErrorId = null;
    delete state.data.groupChildCreateDrafts?.[parentId];
    render();
    return;
  }
  if (action === "admin-group-roles-toggle") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const group = (state.data.groups?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !group) return;
    if (Number(state.data.groupRolesOpenId) === id) {
      state.data.groupRolesOpenId = null;
      render();
      return;
    }
    if (!Array.isArray(state.data.userEditRoles)) {
      state.busy = `group-role-catalog:${id}`;
      state.error = null;
      render();
      try {
        const page = await request(
          "/api/admin/roles?page=0&size=100&sort=name,asc",
        );
        state.data.userEditRoles = Array.isArray(page?.content)
          ? page.content
          : [];
      } catch {
        state.busy = null;
        render();
        return;
      }
      state.busy = null;
    }
    state.data.groupRolesOpenId = id;
    state.data.groupRoleErrorId = null;
    render();
    return;
  }
  if (action === "admin-group-name-toggle") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    const group = (state.data.groups?.content ?? []).find(
      (candidate) => Number(candidate.id) === id,
    );
    if (!Number.isSafeInteger(id) || id < 1 || !group) return;
    if (Number(state.data.groupNameOpenId) === id) {
      state.data.groupNameOpenId = null;
      render();
      return;
    }
    state.data.groupNameOpenId = id;
    state.data.groupNameErrorId = null;
    state.data.groupNameDrafts ??= {};
    state.data.groupNameDrafts[id] = { name: group.name ?? "" };
    render();
    return;
  }
  if (action === "admin-group-name-cancel") {
    if (state.busy) return;
    const id = Number(element.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (state.data.groupNameDrafts) delete state.data.groupNameDrafts[id];
    state.data.groupNameOpenId = null;
    state.data.groupNameErrorId = null;
    render();
    return;
  }
  if (action === "admin-group-roles-cancel") {
    if (state.busy) return;
    const id = Number(element.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (state.data.groupRoleDrafts) delete state.data.groupRoleDrafts[id];
    state.data.groupRolesOpenId = null;
    state.data.groupRoleErrorId = null;
    render();
    return;
  }
  if (action === "admin-group-members-toggle") {
    if (state.busy || state.offline) return;
    const groupId = Number(element.dataset.id);
    const groups = state.data.groups?.content ?? [];
    if (
      !Number.isSafeInteger(groupId) ||
      groupId < 1 ||
      !groups.some((group) => Number(group.id) === groupId)
    )
      return;
    if (Number(state.data.groupMembersOpenId) === groupId) {
      state.data.groupMembersOpenId = null;
      render();
      return;
    }
    state.data.groupMembersOpenId = groupId;
    state.busy = `group-members:${groupId}`;
    state.error = null;
    render();
    try {
      await loadGroupMembership(groupId);
    } catch {
      /* request rendered localized transport or authorization feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-group-member-remove-request" ||
    action === "admin-group-member-remove-cancel"
  ) {
    if (state.busy) return;
    const groupId = Number(element.dataset.provider);
    const userId = Number(element.dataset.id);
    const memberState = state.data.groupMembers?.[groupId];
    if (!Number.isSafeInteger(groupId) || groupId < 1 || !memberState) return;
    if (action === "admin-group-member-remove-cancel") {
      memberState.removeConfirmId = null;
      render();
      return;
    }
    if (
      state.offline ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !(memberState.members?.content ?? []).some(
        (user) => Number(user.id) === userId,
      )
    )
      return;
    memberState.removeConfirmId = userId;
    render();
    return;
  }
  if (
    action === "admin-group-member-add" ||
    action === "admin-group-member-remove-confirm"
  ) {
    if (state.busy || state.offline) return;
    const groupId = Number(element.dataset.provider);
    const userId = Number(element.dataset.id);
    const memberState = state.data.groupMembers?.[groupId];
    const userList =
      action === "admin-group-member-add"
        ? memberState?.available?.content
        : memberState?.members?.content;
    if (
      !Number.isSafeInteger(groupId) ||
      groupId < 1 ||
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !Array.isArray(userList) ||
      !userList.some((user) => Number(user.id) === userId) ||
      (action === "admin-group-member-remove-confirm" &&
        Number(memberState.removeConfirmId) !== userId)
    )
      return;
    const adding = action === "admin-group-member-add";
    state.busy = `group-member-${adding ? "add" : "remove"}:${groupId}:${userId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(
        `/api/admin/groups/${groupId}/users${adding ? "" : `/${userId}`}`,
        adding ? { method: "POST", body: { userId } } : { method: "DELETE" },
      );
      if (!adding) memberState.removeConfirmId = null;
      await loadGroupMembership(groupId);
      const groups = state.data.groups?.content ?? [];
      state.data.groups = {
        ...state.data.groups,
        content: groups.map((group) =>
          Number(group.id) === groupId
            ? {
                ...group,
                userCount: Math.max(
                  0,
                  Number(group.userCount ?? 0) + (adding ? 1 : -1),
                ),
              }
            : group,
        ),
      };
      state.notice = text(
        adding ? "adminGroupUserAdded" : "adminGroupUserRemoved",
      );
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-role-delete-request" ||
    action === "admin-role-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const name = element.dataset.id;
    const roles = state.data.roles?.content ?? [];
    if (
      typeof name !== "string" ||
      !/^ROLE_[A-Z0-9_]{1,45}$/.test(name) ||
      !roles.some((role) => role.name === name)
    )
      return;
    if (action === "admin-role-delete-request") {
      state.data.roleDeleteConfirmName = name;
      render();
      return;
    }
    if (state.data.roleDeleteConfirmName !== name) return;
    state.busy = `role-delete:${name}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/roles/${name}`, { method: "DELETE" });
      state.data.roles = {
        ...state.data.roles,
        content: roles.filter((role) => role.name !== name),
      };
      state.data.roleDeleteConfirmName = null;
      state.notice = text("adminRoleDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-role-delete-cancel") {
    if (state.busy) return;
    state.data.roleDeleteConfirmName = null;
    render();
    return;
  }
  if (action === "admin-provider-mapper-create") {
    if (state.busy || state.offline) return;
    const providerId = element.dataset.provider;
    if (
      typeof providerId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
      !state.data.identityProviders?.content?.some(
        (provider) => provider.id === providerId,
      ) ||
      !Array.isArray(state.data.identityProviderMappers?.[providerId])
    )
      return;
    state.data.providerMapperEditor = { providerId, mapperId: null };
    state.data.providerMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-provider-mapper-edit") {
    if (state.busy || state.offline) return;
    const providerId = element.dataset.provider;
    const mapperId = element.dataset.id;
    const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
    if (
      typeof providerId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
      typeof mapperId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(mapperId) ||
      !Array.isArray(mappers) ||
      !mappers.some((mapper) => mapper.id === mapperId)
    )
      return;
    state.data.providerMapperEditor = { providerId, mapperId };
    state.data.providerMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-provider-mapper-editor-cancel") {
    if (state.busy) return;
    const editor = state.data.providerMapperEditor;
    const providerId = element.dataset.provider;
    if (editor?.providerId !== providerId) return;
    const draftKey = editor.mapperId ?? "new";
    if (state.data.providerMapperDrafts?.[providerId])
      delete state.data.providerMapperDrafts[providerId][draftKey];
    state.data.providerMapperEditor = null;
    state.data.providerMapperErrorKey = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-provider-mappers-toggle") {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const providers = state.data.identityProviders?.content ?? [];
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !providers.some((provider) => provider.id === id)
    )
      return;
    if (state.data.identityProviderMappersOpenId === id) {
      state.data.identityProviderMappersOpenId = null;
      render();
      return;
    }
    const cached = state.data.identityProviderMappers?.[id];
    if (Array.isArray(cached)) {
      state.data.identityProviderMappersOpenId = id;
      render();
      return;
    }
    state.busy = `provider-mappers:${id}`;
    state.error = null;
    render();
    try {
      const page = await request(
        `/api/admin/identity-providers/${id}/mappers?page=0&size=20&sort=name,asc`,
      );
      state.data.identityProviderMappers ??= {};
      state.data.identityProviderMappers[id] = Array.isArray(page?.content)
        ? page.content
        : [];
      state.data.identityProviderMappersOpenId = id;
    } catch {
      /* request rendered localized transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-provider-mapper-delete-request" ||
    action === "admin-provider-mapper-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const providerId = element.dataset.provider;
    const mapperId = element.dataset.id;
    const providers = state.data.identityProviders?.content ?? [];
    const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
    if (
      typeof providerId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
      typeof mapperId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(mapperId) ||
      !providers.some((provider) => provider.id === providerId) ||
      !Array.isArray(mappers) ||
      !mappers.some((mapper) => mapper.id === mapperId)
    )
      return;
    if (action === "admin-provider-mapper-delete-request") {
      state.data.providerMapperDeleteConfirm = { providerId, mapperId };
      render();
      return;
    }
    const confirmation = state.data.providerMapperDeleteConfirm;
    if (
      confirmation?.providerId !== providerId ||
      confirmation?.mapperId !== mapperId
    )
      return;
    state.busy = `provider-mapper-delete:${providerId}:${mapperId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(
        `/api/admin/identity-providers/${providerId}/mappers/${mapperId}`,
        { method: "DELETE" },
      );
      state.data.identityProviderMappers[providerId] = mappers.filter(
        (mapper) => mapper.id !== mapperId,
      );
      state.data.identityProviders = {
        ...state.data.identityProviders,
        content: providers.map((provider) =>
          provider.id === providerId
            ? {
                ...provider,
                mapperCount: Math.max(0, provider.mapperCount - 1),
              }
            : provider,
        ),
      };
      state.data.providerMapperDeleteConfirm = null;
      state.notice = text("adminProviderMapperDeleted");
    } catch {
      /* request rendered localized server or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-provider-mapper-delete-cancel") {
    if (state.busy) return;
    const confirmation = state.data.providerMapperDeleteConfirm;
    if (
      confirmation?.providerId !== element.dataset.provider ||
      confirmation?.mapperId !== element.dataset.id
    )
      return;
    state.data.providerMapperDeleteConfirm = null;
    render();
    return;
  }
  if (action === "admin-identity-provider-policy-toggle") {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const provider = (state.data.identityProviders?.content ?? []).find(
      (item) => item.id === id,
    );
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") || !provider) return;
    if (state.data.identityProviderPolicyOpenId === id) {
      state.data.identityProviderPolicyOpenId = null;
      delete state.data.identityProviderPolicyDrafts?.[id];
      state.data.identityProviderPolicyErrorId = null;
      render();
      return;
    }
    state.busy = `identity-provider-policy-load:${id}`;
    state.error = null;
    render();
    try {
      const policy = await request(
        `/api/admin/identity-providers/${id}/native-policy`,
      );
      state.data.identityProviderPolicies ??= {};
      state.data.identityProviderPolicies[id] = policy;
      state.data.identityProviderPolicyOpenId = id;
      state.data.identityProviderPolicyDrafts ??= {};
      state.data.identityProviderPolicyDrafts[id] = policy;
      state.data.identityProviderPolicyErrorId = null;
    } catch {
      /* request rendered localized transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-client-delete-request" ||
    action === "admin-client-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const clients = state.data.clients?.content ?? [];
    const client = clients.find((item) => item.id === id);
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !client ||
      PLATFORM_CONSOLE_CLIENT_IDS.has(client.clientId)
    )
      return;
    if (action === "admin-client-delete-request") {
      state.data.clientDeleteConfirmId = id;
      render();
      return;
    }
    if (state.data.clientDeleteConfirmId !== id) return;
    state.busy = `client-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/clients/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      state.data.clients = {
        ...state.data.clients,
        content: clients.filter((item) => item.id !== id),
      };
      state.data.clientDeleteConfirmId = null;
      state.notice = text("adminClientDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-delete-cancel") {
    if (state.busy) return;
    if (state.data.clientDeleteConfirmId !== element.dataset.id) return;
    state.data.clientDeleteConfirmId = null;
    render();
    return;
  }
  if (action === "admin-client-metadata-edit") {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const client = (state.data.clients?.content ?? []).find(
      (item) => item.id === id,
    );
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") || !client) return;
    if (state.data.clientMetadataEditId === id) {
      state.data.clientMetadataEditId = null;
      delete state.data.clientMetadataDrafts?.[id];
      state.data.clientMetadataErrorId = null;
      render();
      return;
    }
    state.busy = `client-metadata-load:${id}`;
    state.error = null;
    render();
    try {
      const metadata = await request(
        `/api/admin/clients/${encodeURIComponent(id)}/native-metadata`,
      );
      state.data.clientMetadataEditId = id;
      state.data.clientMetadataDrafts ??= {};
      state.data.clientMetadataDrafts[id] = {
        clientName: metadata.clientName,
      };
      state.data.clientMetadataErrorId = null;
    } catch {
      /* request rendered localized transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-metadata-cancel") {
    if (state.busy) return;
    const id = element.dataset.id;
    if (state.data.clientMetadataEditId !== id) return;
    state.data.clientMetadataEditId = null;
    delete state.data.clientMetadataDrafts?.[id];
    state.data.clientMetadataErrorId = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-client-scope-assignments-toggle") {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const client = (state.data.clients?.content ?? []).find(
      (item) => item.id === id,
    );
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") || !client) return;
    if (state.data.clientScopeAssignmentsOpenId === id) {
      state.data.clientScopeAssignmentsOpenId = null;
      render();
      return;
    }
    const cached = state.data.clientScopeAssignments?.[id];
    state.data.clientScopeAssignmentsOpenId = id;
    state.data.clientScopeAssignmentErrorId = null;
    state.error = null;
    if (cached) {
      state.data.clientScopeAssignmentDrafts ??= {};
      state.data.clientScopeAssignmentDrafts[id] = {
        defaultScopes: [...(cached.defaultScopes ?? [])],
        optionalScopes: [...(cached.optionalScopes ?? [])],
      };
      render();
      return;
    }
    state.busy = `client-scope-assignments-load:${id}`;
    render();
    try {
      const assignments = await request(
        `/api/admin/clients/${encodeURIComponent(id)}/scope-assignments`,
      );
      state.data.clientScopeAssignments ??= {};
      state.data.clientScopeAssignments[id] = assignments;
      state.data.clientScopeAssignmentDrafts ??= {};
      state.data.clientScopeAssignmentDrafts[id] = {
        defaultScopes: [...(assignments.defaultScopes ?? [])],
        optionalScopes: [...(assignments.optionalScopes ?? [])],
      };
    } catch {
      state.data.clientScopeAssignmentsOpenId = null;
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-scope-assignments-cancel") {
    if (state.busy) return;
    const id = element.dataset.id;
    const current = state.data.clientScopeAssignments?.[id];
    if (!current || state.data.clientScopeAssignmentsOpenId !== id) return;
    state.data.clientScopeAssignmentDrafts ??= {};
    state.data.clientScopeAssignmentDrafts[id] = {
      defaultScopes: [...(current.defaultScopes ?? [])],
      optionalScopes: [...(current.optionalScopes ?? [])],
    };
    state.data.clientScopeAssignmentsOpenId = null;
    state.data.clientScopeAssignmentErrorId = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-identity-provider-policy-cancel") {
    if (state.busy) return;
    const id = element.dataset.id;
    if (state.data.identityProviderPolicyOpenId !== id) return;
    state.data.identityProviderPolicyOpenId = null;
    delete state.data.identityProviderPolicyDrafts?.[id];
    state.data.identityProviderPolicyErrorId = null;
    render();
    return;
  }
  if (
    action === "admin-identity-provider-delete-request" ||
    action === "admin-identity-provider-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const providers = state.data.identityProviders?.content ?? [];
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !providers.some((provider) => provider.id === id)
    )
      return;
    if (action === "admin-identity-provider-delete-request") {
      state.data.identityProviderDeleteConfirmId = id;
      render();
      return;
    }
    if (state.data.identityProviderDeleteConfirmId !== id) return;
    state.busy = `identity-provider-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/identity-providers/${id}`, {
        method: "DELETE",
      });
      state.data.identityProviders = {
        ...state.data.identityProviders,
        content: providers.filter((provider) => provider.id !== id),
      };
      state.data.identityProviderDeleteConfirmId = null;
      state.notice = text("adminIdentityProviderDeleted");
    } catch {
      /* request rendered localized server or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-identity-provider-delete-cancel") {
    if (state.busy) return;
    const id = element.dataset.id;
    if (state.data.identityProviderDeleteConfirmId !== id) return;
    state.data.identityProviderDeleteConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-client-scope-delete-request" ||
    action === "admin-client-scope-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    const scopes = state.data.clientScopes?.content ?? [];
    const scope = scopes.find((candidate) => candidate.id === id);
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !scope ||
      scope.builtIn
    )
      return;
    if (action === "admin-client-scope-delete-request") {
      state.data.clientScopeDeleteConfirmId = id;
      render();
      return;
    }
    if (state.data.clientScopeDeleteConfirmId !== id) return;
    state.busy = `client-scope-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/client-scopes/${id}`, { method: "DELETE" });
      state.data.clientScopes = {
        ...state.data.clientScopes,
        content: scopes.filter((item) => item.id !== id),
      };
      state.data.clientScopeDeleteConfirmId = null;
      state.notice = text("adminClientScopeDeleted");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-scope-delete-cancel") {
    if (state.busy) return;
    state.data.clientScopeDeleteConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-offline-session-revoke-request" ||
    action === "admin-offline-session-revoke-confirm"
  ) {
    if (state.busy || state.offline) return;
    const index = Number(element.dataset.index);
    const sessions = state.data.adminOfflineSessions?.content ?? [];
    const session = sessions[index];
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      !session ||
      typeof session.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(session.id)
    )
      return;
    if (action === "admin-offline-session-revoke-request") {
      state.data.offlineSessionDeleteConfirmId = session.id;
      render();
      return;
    }
    if (state.data.offlineSessionDeleteConfirmId !== session.id) return;
    state.busy = `admin-offline-session-delete:${index}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/offline-sessions/${session.id}`, {
        method: "DELETE",
      });
      state.data.adminOfflineSessions = {
        ...state.data.adminOfflineSessions,
        content: sessions.filter((_, itemIndex) => itemIndex !== index),
      };
      state.data.offlineSessionDeleteConfirmId = null;
      state.notice = text("adminOfflineSessionRevoked");
    } catch {
      /* request rendered localized validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-offline-session-revoke-cancel") {
    if (state.busy) return;
    state.data.offlineSessionDeleteConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-session-delete-request" ||
    action === "admin-session-delete-confirm"
  ) {
    if (state.busy || state.offline) return;
    const index = Number(element.dataset.index);
    const sessions = state.data.adminSessions?.content ?? [];
    const session = sessions[index];
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      !session ||
      typeof session.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(session.id)
    )
      return;
    if (action === "admin-session-delete-request") {
      state.data.adminSessionDeleteConfirmId = session.id;
      render();
      return;
    }
    if (state.data.adminSessionDeleteConfirmId !== session.id) return;
    state.busy = `admin-session-delete:${index}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/sessions/${session.id}`, {
        method: "DELETE",
      });
      state.data.adminSessions = {
        ...state.data.adminSessions,
        content: sessions.filter((_, itemIndex) => itemIndex !== index),
      };
      state.data.adminSessionDeleteConfirmId = null;
      state.notice = text("adminSessionDeleted");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-session-delete-cancel") {
    if (state.busy) return;
    state.data.adminSessionDeleteConfirmId = null;
    render();
    return;
  }
  if (
    action === "admin-consent-revoke-request" ||
    action === "admin-consent-revoke-confirm"
  ) {
    if (state.busy || state.offline) return;
    const index = Number(element.dataset.index);
    const consents = state.data.adminConsents?.content ?? [];
    const consent = consents[index];
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      !consent ||
      typeof consent.clientId !== "string" ||
      consent.clientId.length === 0 ||
      consent.clientId.length > 100 ||
      typeof consent.principalName !== "string" ||
      consent.principalName.length === 0 ||
      consent.principalName.length > 100
    )
      return;
    if (action === "admin-consent-revoke-request") {
      state.data.consentRevokeConfirmKey = JSON.stringify([
        consent.clientId,
        consent.principalName,
      ]);
      render();
      return;
    }
    if (
      state.data.consentRevokeConfirmKey !==
      JSON.stringify([consent.clientId, consent.principalName])
    )
      return;
    state.busy = `admin-consent-revoke:${index}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(
        `/api/admin/consents/consents/${encodeURIComponent(consent.clientId)}/${encodeURIComponent(consent.principalName)}`,
        { method: "DELETE" },
      );
      state.data.adminConsents = {
        ...state.data.adminConsents,
        content: consents.filter((_, itemIndex) => itemIndex !== index),
      };
      state.data.consentRevokeConfirmKey = null;
      state.notice = text("adminConsentRevoked");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-consent-revoke-cancel") {
    if (state.busy) return;
    state.data.consentRevokeConfirmKey = null;
    render();
    return;
  }
  if (
    [
      "logout",
      "sign-in",
      "cancel-sign-in",
      "switch-console",
      "switch-account",
      "toggle-locale",
      "retry",
    ].includes(action)
  ) {
    if (action === "logout") return logout();
    if (action === "sign-in") return signIn();
    if (action === "cancel-sign-in") return cancelSignIn();
    if (action === "switch-console" || action === "switch-account") {
      state.console = state.console === "admin" ? "account" : "admin";
      state.route = state.console === "admin" ? "dashboard" : "profile";
      state.session = null;
      state.error = null;
      render();
      return signIn();
    }
    if (action === "toggle-locale") {
      if (state.busy) return;
      state.busy = "locale";
      render();
      const next = state.locale === "en" ? "tr" : "en";
      try {
        await api.language.set(next);
        state.locale = next;
        if (state.error) state.error.message = problemMessage(state.error);
      } finally {
        state.busy = null;
      }
      render();
      return;
    }
    if (action === "retry") {
      if (state.busy) return;
      state.busy = "retry";
      await loadRoute({ preserveError: true });
      state.busy = null;
      render();
      return;
    }
  }
  if (action === "choose-admin" || action === "choose-account") {
    state.console = action === "choose-admin" ? "admin" : "account";
    state.route = state.console === "admin" ? "dashboard" : "profile";
    history.replaceState(null, "", `?console=${state.console}`);
    return signIn();
  }
  if (action === "create-user") {
    if (state.busy || state.offline) return;
    state.busy = "user-create-route";
    state.route = "user-create";
    state.data.userCreateDraft = null;
    state.data.userCreateCreatedUserId = null;
    state.data.userCreateProfileDefinitionsLoaded = false;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "create-role") {
    if (state.busy || state.offline) return;
    state.busy = "role-create-route";
    state.route = "role-create";
    state.data.adminRoleCreateDraft = null;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "create-group") {
    if (state.busy || state.offline) return;
    state.busy = "group-create-route";
    state.route = "group-create";
    state.data.adminGroupCreateDraft = null;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "create-client-scope") {
    if (state.busy || state.offline) return;
    state.busy = "client-scope-create-route";
    state.route = "client-scope-create";
    state.data.adminClientScopeCreateDraft = null;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "mfa-setup") {
    state.busy = "mfa";
    render();
    try {
      state.data.mfa.setup = await request("/api/account/mfa/setup", {
        method: "POST",
      });
    } catch {}
    state.busy = null;
    render();
    return;
  }
  if (action === "mfa-enable" || action === "mfa-disable") {
    const code = document.getElementById("mfaCode")?.value ?? "";
    const digits = state.data.mfa.setup?.digits ?? state.data.mfa.digits ?? 6;
    if (!new RegExp(`^\\d{${digits}}$`).test(code)) {
      state.error = { message: text("mfaInvalidCode") };
      render();
      return;
    }
    state.busy = "mfa";
    render();
    try {
      await request(
        `/api/account/mfa/${action === "mfa-enable" ? "enable" : "disable"}`,
        { method: "POST", body: { code } },
      );
      state.data.mfa = await request("/api/account/mfa");
      state.data.mfa.setup = null;
      state.notice = text("mfaEnabled");
    } catch {}
    state.busy = null;
    render();
    return;
  }
  if (action === "delete-session" || action === "delete-other-sessions") {
    if (!confirm(text("signOutSessionConfirm"))) return;
    state.busy = "sessions";
    render();
    try {
      await request(
        action === "delete-other-sessions"
          ? "/api/account/sessions/others"
          : `/api/account/sessions/${encodeURIComponent(element.closest(".list-item")?.dataset.id ?? "")}`,
        { method: "DELETE" },
      );
      state.notice = text("signOutSession");
      await loadRoute();
    } catch {
      state.busy = null;
      render();
    }
    return;
  }
  if (action === "revoke-application" || action === "revoke-offline") {
    if (
      !confirm(
        text(
          action === "revoke-application"
            ? "revokeApplicationConfirm"
            : "revokeOfflineSessionConfirm",
        ),
      )
    )
      return;
    state.busy = action;
    render();
    const identity = element.closest(".list-item")?.dataset.id ?? "";
    try {
      await request(
        action === "revoke-application"
          ? `/api/account/applications/${encodeURIComponent(identity)}`
          : `/api/account/offline-sessions/${encodeURIComponent(identity)}`,
        { method: "DELETE" },
      );
      state.notice = text(
        action === "revoke-application"
          ? "revokeApplicationSuccess"
          : "revokeOfflineSessionSuccess",
      );
      await loadRoute();
    } catch {
      state.busy = null;
      render();
    }
    return;
  }
  if (action === "social-remove") {
    if (!confirm(text("socialRemoveConfirm"))) return;
    const item = element.closest(".list-item");
    const provider = state.data.social.find(
      (candidate) =>
        candidate.displayName === item?.querySelector("strong")?.textContent,
    );
    state.busy = "social";
    render();
    try {
      await request(
        `/api/account/social-links/${encodeURIComponent(provider?.provider ?? "")}`,
        { method: "DELETE" },
      );
      state.notice = text("socialRemoveSuccess");
      await loadRoute();
    } catch {
      state.busy = null;
      render();
    }
  }
  if (action === "admin-message-delete-request") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    state.data.adminMessageDeleteConfirmId = id;
    render();
    return;
  }
  if (action === "admin-message-delete-cancel") {
    if (state.busy) return;
    state.data.adminMessageDeleteConfirmId = null;
    render();
    return;
  }
  if (action === "admin-message-delete-confirm") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      Number(state.data.adminMessageDeleteConfirmId) !== id
    )
      return;
    state.busy = `admin-message-delete:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/settings/localization/messages/${id}`, {
        method: "DELETE",
      });
      const page = state.data.adminMessageOverrides ?? { content: [] };
      state.data.adminMessageOverrides = {
        ...page,
        content: page.content.filter((item) => item.id !== id),
      };
      state.data.adminMessageDeleteConfirmId = null;
      state.notice = text("adminMessageOverrideDeleted");
    } catch {
      /* request rendered localized transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "social-start") {
    if (state.busy || state.offline) return;
    state.busy = "social";
    state.error = null;
    render();
    try {
      const result = await api.auth.socialLink.start(element.dataset.provider);
      if (!result || result.status < 200 || result.status >= 300) {
        setError(result);
      } else {
        state.notice = text("socialLinkStarted");
      }
    } catch {
      state.error = { message: text("socialLinkError") };
    }
    state.busy = null;
    render();
  }
}

function bind() {
  document.querySelectorAll("[data-route]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      state.route = element.dataset.route;
      state.notice = null;
      state.busy = `route:${state.route}`;
      void loadRoute().finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-user-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.userQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.userPage = 0;
      state.data.adminSelectedUserIds = [];
      state.data.adminUserBulkConfirmAction = null;
      state.busy = "users-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.page);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.userPage = nextPage;
      state.data.adminSelectedUserIds = [];
      state.data.adminUserBulkConfirmAction = null;
      state.busy = `users-page-${nextPage < Number(state.data.users?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-role-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.roleQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.rolePage = 0;
      state.busy = "roles-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-role-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.rolePage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.rolePage = nextPage;
      state.busy = `roles-page-${nextPage < Number(state.data.roles?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-group-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.groupQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.groupPage = 0;
      state.busy = "groups-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-group-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.groupPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.groupPage = nextPage;
      state.busy = `groups-page-${nextPage < Number(state.data.groups?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-client-scope-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.clientScopeQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.clientScopePage = 0;
      state.busy = "client-scopes-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-client-scope-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.clientScopePage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.clientScopePage = nextPage;
      state.busy = `client-scopes-page-${nextPage < Number(state.data.clientScopes?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .querySelectorAll("[data-client-scope-role-page]")
    .forEach((element) =>
      element.addEventListener("click", () => {
        if (state.busy || element.disabled || state.offline) return;
        const scopeId = element.dataset.scopeId;
        const kind = element.dataset.clientScopeRolePage;
        const page = Number(element.dataset.page);
        const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
        const currentPage = mapping?.[`${kind}Candidates`];
        if (
          typeof scopeId !== "string" ||
          !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
          !["applicationRoles", "clientRoleIds"].includes(kind) ||
          !Number.isSafeInteger(page) ||
          page < 0 ||
          !currentPage ||
          page >= Number(currentPage.totalPages ?? 0)
        )
          return;
        state.busy = `client-scope-role-page:${scopeId}:${kind}`;
        state.error = null;
        render();
        void loadClientScopeRoleCandidates(scopeId, kind, page)
          .catch(() => {
            /* request rendered localized authorization or transport feedback */
          })
          .finally(() => {
            state.busy = null;
            render();
          });
      }),
    );
  document
    .getElementById("admin-client-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.clientQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.clientPage = 0;
      state.busy = "clients-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-client-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.clientPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.clientPage = nextPage;
      state.busy = `clients-page-${nextPage < Number(state.data.clients?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-identity-provider-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.identityProviderQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.identityProviderPage = 0;
      state.busy = "identity-providers-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .querySelectorAll("[data-identity-provider-page]")
    .forEach((element) =>
      element.addEventListener("click", () => {
        if (state.busy || element.disabled) return;
        const nextPage = Number(element.dataset.identityProviderPage);
        if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
        state.data.identityProviderPage = nextPage;
        state.busy = `identity-providers-page-${nextPage < Number(state.data.identityProviders?.number ?? 0) ? "prev" : "next"}`;
        void loadRoute({ keepContent: true }).finally(() => {
          state.busy = null;
          render();
        });
      }),
    );
  document
    .getElementById("admin-session-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      const values = new FormData(event.currentTarget);
      state.data.adminSessionQuery = String(values.get("q") ?? "").trim();
      state.data.adminSessionStatus = String(values.get("status") ?? "active");
      state.data.adminSessionPage = 0;
      state.busy = "admin-sessions-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-admin-session-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.adminSessionPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.adminSessionPage = nextPage;
      state.busy = `admin-sessions-page-${nextPage < Number(state.data.adminSessions?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-consent-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.adminConsentQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.adminConsentPage = 0;
      state.busy = "admin-consents-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-admin-consent-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.adminConsentPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.adminConsentPage = nextPage;
      state.busy = `admin-consents-page-${nextPage < Number(state.data.adminConsents?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .querySelectorAll("[data-admin-offline-session-page]")
    .forEach((element) =>
      element.addEventListener("click", () => {
        if (state.busy || element.disabled) return;
        const nextPage = Number(element.dataset.adminOfflineSessionPage);
        if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
        state.data.adminOfflineSessionPage = nextPage;
        state.busy = `admin-offline-sessions-page-${nextPage < Number(state.data.adminOfflineSessions?.number ?? 0) ? "prev" : "next"}`;
        void loadRoute({ keepContent: true }).finally(() => {
          state.busy = null;
          render();
        });
      }),
    );
  document
    .getElementById("admin-event-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.adminEventQuery = String(
        new FormData(event.currentTarget).get("q") ?? "",
      ).trim();
      state.data.adminEventPage = 0;
      state.busy = "admin-events-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-admin-event-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.adminEventPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.adminEventPage = nextPage;
      state.busy = `admin-events-page-${nextPage < Number(state.data.adminEvents?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-key-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      const values = new FormData(event.currentTarget);
      state.data.adminKeyQuery = String(values.get("q") ?? "").trim();
      state.data.adminKeyActive = String(values.get("active") ?? "all");
      state.data.adminKeyPage = 0;
      state.busy = "admin-keys-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll("[data-admin-key-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.adminKeyPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.adminKeyPage = nextPage;
      state.busy = `admin-keys-page-${nextPage < Number(state.data.adminKeys?.number ?? 0) ? "prev" : "next"}`;
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document.querySelectorAll("[data-action]").forEach((element) =>
    element.addEventListener("click", () => {
      if (element.disabled) return;
      void action(element.dataset.action, element);
    }),
  );
  document.querySelectorAll("form").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitForm(form);
    }),
  );
  document
    .querySelectorAll("[data-client-scope-role-mappings-panel]")
    .forEach((panel) =>
      panel.addEventListener("change", () => {
        const scopeId = panel.dataset.scopeId;
        const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
        if (!mapping || state.busy) return;
        mapping.draft = {
          applicationRoles: [
            ...new Set(
              [
                ...panel.querySelectorAll(
                  'input[name="applicationRoles"]:checked',
                ),
              ]
                .map((input) => input.value.trim())
                .filter(Boolean),
            ),
          ],
          clientRoleIds: [
            ...new Set(
              [...panel.querySelectorAll('input[name="clientRoleIds"]:checked')]
                .map((input) => Number(input.value))
                .filter((id) => Number.isSafeInteger(id) && id > 0),
            ),
          ],
        };
      }),
    );
  document
    .querySelectorAll("[data-client-scope-assignments-panel]")
    .forEach((panel) =>
      panel.addEventListener("change", (event) => {
        const input = event.target;
        const clientId = panel.dataset.clientId;
        if (
          state.busy ||
          !input.matches(
            'input[type="checkbox"][name="defaultScopes"], input[type="checkbox"][name="optionalScopes"]',
          )
        )
          return;
        if (input.checked) {
          const otherName =
            input.name === "defaultScopes" ? "optionalScopes" : "defaultScopes";
          const counterpart = [
            ...panel.querySelectorAll(`input[name="${otherName}"]`),
          ].find((item) => item.value === input.value);
          if (counterpart) counterpart.checked = false;
        }
        state.data.clientScopeAssignmentErrorId = null;
        state.data.clientScopeAssignmentDrafts ??= {};
        state.data.clientScopeAssignmentDrafts[clientId] = {
          defaultScopes: [
            ...panel.querySelectorAll('input[name="defaultScopes"]:checked'),
          ].map((item) => item.value),
          optionalScopes: [
            ...panel.querySelectorAll('input[name="optionalScopes"]:checked'),
          ].map((item) => item.value),
        };
      }),
    );
  document.getElementById("theme")?.addEventListener("change", (event) => {
    void api.theme.set(event.target.value);
  });
  document.getElementById("language")?.addEventListener("change", (event) => {
    void api.language.set(event.target.value);
  });
}

async function hydrate() {
  try {
    const preferred = await api.auth.hasSession(state.console);
    state.session = preferred;
    const other = await api.auth.hasSession(
      state.console === "admin" ? "account" : "admin",
    );
    if (!state.session && other) {
      state.console = state.console === "admin" ? "account" : "admin";
      state.session = other;
    }
  } catch {
    state.session = null;
  }
  state.loading = false;
  render();
  if (state.session) {
    state.route = state.console === "admin" ? "dashboard" : "profile";
    void loadRoute();
  } else if (hasConsoleSelection()) void signIn();
}

api.theme.onChanged(setTheme);
api.language.onChanged((locale) => {
  state.locale = locale;
  if (state.error) state.error.message = problemMessage(state.error);
  render();
});
api.onAuthCallback((callback) => {
  clearTimeout(authTimeout);
  state.authCanceling = false;
  if (callback.error) {
    state.error = { message: text("authError") };
    state.authStarting = false;
    render();
    return;
  }
  state.authStarting = false;
  void hydrate();
});
api.auth.socialLink.onCallback((callback) => {
  state.busy = null;
  if (callback.error) {
    state.error = { message: text("socialLinkError") };
    render();
    return;
  }
  state.notice = text("socialLinkSuccess");
  void loadRoute();
});
api.onMenuLogout(() => {
  void logout();
});
window.addEventListener("online", () => {
  preserveOfflineDrafts();
  state.offline = false;
  render();
});
window.addEventListener("offline", () => {
  preserveOfflineDrafts();
  state.offline = true;
  render();
});
setTheme(boot.theme);
void hydrate();
