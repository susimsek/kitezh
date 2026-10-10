const boot = globalThis.__KITEZH_NATIVE_BOOTSTRAP__ ?? {};
const api = globalThis.desktopApi;
const messages = boot.messages ?? { en: {}, tr: {} };
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
};

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
const spin = (busy) =>
  busy ? '<span class="spinner" aria-hidden="true"></span>' : "";
const button = (label, options = {}) =>
  `<button class="${options.danger ? "danger-button" : "primary-button"}" type="${options.type ?? "button"}" data-action="${options.action ?? ""}" ${options.provider ? `data-provider="${escapeHtml(options.provider)}"` : ""} ${options.disabled || options.busy ? "disabled" : ""} ${options.busy ? 'aria-busy="true"' : ""}>${spin(options.busy)}${escapeHtml(label)}</button>`;
const field = (
  name,
  label,
  value = "",
  error = "",
  type = "text",
  extra = "",
) =>
  `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" aria-invalid="${Boolean(error)}" ${extra}/><div class="field-error" id="${name}-error">${escapeHtml(error)}</div></div>`;
const pageHeader = (title, description) =>
  `<div class="topbar"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</div></div>`;

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
}

function problemMessage(error) {
  if (error?.kind === "offline")
    return state.locale === "tr"
      ? "Çevrimdışısınız. Bağlantıyı kontrol edip tekrar deneyin."
      : "You are offline. Check your connection and try again.";
  if (error?.kind === "timeout")
    return state.locale === "tr"
      ? "İstek zaman aşımına uğradı. Tekrar deneyin."
      : "The request timed out. Try again.";
  if (error?.kind === "forbidden" && state.console === "admin")
    return text("adminForbidden");
  if (error?.kind === "forbidden")
    return state.locale === "tr"
      ? "Bu işlemi yapma yetkiniz yok."
      : "You are not allowed to perform this action.";
  if (error?.kind === "unauthorized")
    return state.locale === "tr"
      ? "Oturumunuz sona erdi. Tekrar giriş yapın."
      : "Your session expired. Sign in again.";
  if (error?.kind === "validation")
    return (
      error.body?.detail ??
      (state.locale === "tr"
        ? "Alanları kontrol edin."
        : "Check the fields and try again.")
    );
  return state.locale === "tr"
    ? "İşlem tamamlanamadı. Tekrar deneyin."
    : "The operation could not be completed. Try again.";
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
      ? `${navButton("dashboard", text("adminDashboard"))}${navButton("users", text("adminUsers"))}${navButton("roles", text("adminRoles"))}${navButton("groups", text("adminGroups"))}${navButton("client-scopes", text("adminClientScopes"))}${navButton("clients", text("adminClients"))}${navButton("identity-providers", text("adminIdentityProviders"))}${navButton("sessions", text("adminSessions"))}${navButton("consents", text("adminConsents"))}${navButton("offline-sessions", text("adminOfflineSessions"))}${navButton("events", text("adminEvents"))}${navButton("keys", text("adminKeys"))}`
      : `${navButton("profile", text("firstName"))}${navButton("security", text("security"))}${navButton("sessions", text("sessions"))}${navButton("applications", text("applications"))}${navButton("settings", text("settings"))}`;
  return `<div class="app"><aside class="sidebar" aria-label="${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}</p><nav class="nav" aria-label="${escapeHtml(text("settings"))}">${navigation}</nav><div class="sidebar-footer">${state.console === "admin" ? button(text("accountTitle"), { action: "switch-account" }) : ""}${button(state.locale === "tr" ? text("english") : text("turkish"), { action: "toggle-locale", busy: state.busy === "locale" })}</div></aside><main class="main">${pageHeader(routeTitle(), routeDescription())}<div class="content">${state.offline ? `<div class="notice warning" role="status">${escapeHtml(state.locale === "tr" ? "Çevrimdışı mod: güvenli değişiklikler bağlantı gelene kadar devre dışı." : "Offline mode: safe mutations are disabled until connectivity returns.")}</div>` : ""}${state.notice ? `<div class="notice success" role="status">${escapeHtml(state.notice)}</div>` : ""}${state.error ? `<div class="notice error" role="alert">${escapeHtml(problemMessage(state.error))} ${state.error.kind === "unauthorized" ? button(text("signIn"), { action: "sign-in" }) : button(state.console === "admin" ? text("adminRetry") : text("sessionsRetry"), { action: "retry", busy: state.busy === "retry" })}</div>` : ""}${content()}</div></main></div>`;
}

function navButton(route, label) {
  const busy = state.busy === `route:${route}`;
  return `<button type="button" data-route="${route}" aria-current="${state.route === route ? "page" : "false"}" ${busy ? 'disabled aria-busy="true"' : ""}>${spin(busy)}${escapeHtml(label)}</button>`;
}

function routeTitle() {
  if (state.console === "admin")
    return {
      users: text("adminUsers"),
      roles: text("adminRoles"),
      groups: text("adminGroups"),
      "client-scopes": text("adminClientScopes"),
      clients: text("adminClients"),
      "identity-providers": text("adminIdentityProviders"),
      sessions: text("adminSessions"),
      consents: text("adminConsents"),
      "offline-sessions": text("adminOfflineSessions"),
      events: text("adminEvents"),
      keys: text("adminKeys"),
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
      roles: text("adminSearchRoles"),
      groups: text("adminSearchGroups"),
      "client-scopes": text("adminSearchClientScopes"),
      clients: text("adminSearchClients"),
      "identity-providers": text("adminSearchIdentityProviders"),
      sessions: text("adminSearchSessions"),
      consents: text("adminSearchConsents"),
      "offline-sessions": text("offlineSessionsHelp"),
      events: text("adminSearchEvents"),
      keys: text("adminSearchKeys"),
      dashboard: text("adminOverview"),
    }[state.route];
  return {
    profile:
      state.locale === "tr"
        ? "Profil bilgilerinizi yönetin."
        : "Manage your profile information.",
    security: text("mfaHelp"),
    sessions: text("sessionsError"),
    applications: text("applicationsError"),
    settings:
      state.locale === "tr"
        ? "Masaüstü tercihlerini yönetin."
        : "Manage desktop preferences.",
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
  if (state.route === "roles") return adminRolesContent();
  if (state.route === "groups") return adminGroupsContent();
  if (state.route === "client-scopes") return adminClientScopesContent();
  if (state.route === "clients") return adminClientsContent();
  if (state.route === "identity-providers")
    return adminIdentityProvidersContent();
  if (state.route === "sessions") return adminAdminSessionsContent();
  if (state.route === "consents") return adminAdminConsentsContent();
  if (state.route === "offline-sessions")
    return adminAdminOfflineSessionsContent();
  if (state.route === "events") return adminAdminEventsContent();
  if (state.route === "keys") return adminAdminKeysContent();
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
  return `<section class="card" aria-label="${escapeHtml(text("adminUsers"))}"><form id="admin-user-search" class="actions" role="search"><input id="admin-user-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchUsers"))}" value="${escapeHtml(state.data.userQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchUsers"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "users-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "users-search")}${escapeHtml(text("adminSearchUsers"))}</button></form>${users.length ? `<div class="list">${users.map((user) => `<article class="list-item"><div><strong>${escapeHtml(user.username)}</strong>${user.email ? `<span class="muted">${escapeHtml(user.email)}</span>` : ""}<span class="muted">${escapeHtml((user.effectiveRoles ?? user.authorities ?? []).join(", "))}</span></div><span>${escapeHtml(user.enabled ? text("adminUserEnabled") : text("adminUserDisabled"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoUsers"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminUsers"))} pagination"><button class="secondary-button" type="button" data-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "users-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "users-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminRolesContent() {
  const page = state.data.roles ?? { content: [], number: 0, totalPages: 0 };
  const roles = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  return `<section class="card" aria-label="${escapeHtml(text("adminRoles"))}"><form id="admin-role-search" class="actions" role="search"><input id="admin-role-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchRoles"))}" value="${escapeHtml(state.data.roleQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchRoles"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "roles-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "roles-search")}${escapeHtml(text("adminSearchRoles"))}</button></form>${roles.length ? `<div class="list">${roles.map((role) => `<article class="list-item"><div><strong>${escapeHtml(role.name)}</strong>${role.description ? `<span class="muted">${escapeHtml(role.description)}</span>` : ""}</div></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoRoles"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminRoles"))} pagination"><button class="secondary-button" type="button" data-role-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "roles-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-role-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "roles-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminGroupsContent() {
  const page = state.data.groups ?? { content: [], number: 0, totalPages: 0 };
  const groups = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  return `<section class="card" aria-label="${escapeHtml(text("adminGroups"))}"><form id="admin-group-search" class="actions" role="search"><input id="admin-group-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchGroups"))}" value="${escapeHtml(state.data.groupQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchGroups"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "groups-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "groups-search")}${escapeHtml(text("adminSearchGroups"))}</button></form>${groups.length ? `<div class="list">${groups.map((group) => `<article class="list-item"><div><strong>${escapeHtml(group.path || group.name)}</strong><span class="muted">${escapeHtml((group.effectiveRoles ?? group.roles ?? []).join(", "))}</span></div><span>${Number.isSafeInteger(group.userCount) ? group.userCount : 0}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoGroups"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminGroups"))} pagination"><button class="secondary-button" type="button" data-group-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "groups-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-group-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "groups-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminClientScopes"))}"><form id="admin-client-scope-search" class="actions" role="search"><input id="admin-client-scope-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClientScopes"))}" value="${escapeHtml(state.data.clientScopeQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchClientScopes"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "client-scopes-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "client-scopes-search")}${escapeHtml(text("adminSearchClientScopes"))}</button></form>${scopes.length ? `<div class="list">${scopes.map((scope) => `<article class="list-item"><div><strong>${escapeHtml(scope.displayName || scope.name)}</strong><span class="muted">${escapeHtml(scope.description ?? scope.name)}</span></div><span>${escapeHtml(scope.builtIn ? text("adminBuiltIn") : text("adminCustom"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopes"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminClientScopes"))} pagination"><button class="secondary-button" type="button" data-client-scope-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-client-scope-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminClientsContent() {
  const page = state.data.clients ?? { content: [], number: 0, totalPages: 0 };
  const clients = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  return `<section class="card" aria-label="${escapeHtml(text("adminClients"))}"><form id="admin-client-search" class="actions" role="search"><input id="admin-client-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClients"))}" value="${escapeHtml(state.data.clientQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchClients"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "clients-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "clients-search")}${escapeHtml(text("adminSearchClients"))}</button></form>${clients.length ? `<div class="list">${clients.map((client) => `<article class="list-item"><div><strong>${escapeHtml(client.clientName || client.clientId)}</strong><span class="muted">${escapeHtml(client.clientId)}</span><span class="muted">${escapeHtml((client.scopes ?? []).join(", "))}</span></div><span>${escapeHtml(client.requireProofKey ? text("adminConfigured") : text("adminUnconfigured"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoClients"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminClients"))} pagination"><button class="secondary-button" type="button" data-client-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "clients-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-client-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "clients-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminIdentityProviders"))}"><form id="admin-identity-provider-search" class="actions" role="search"><input id="admin-identity-provider-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchIdentityProviders"))}" value="${escapeHtml(state.data.identityProviderQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchIdentityProviders"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "identity-providers-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "identity-providers-search")}${escapeHtml(text("adminSearchIdentityProviders"))}</button></form>${providers.length ? `<div class="list">${providers.map((provider) => `<article class="list-item"><div><strong>${escapeHtml(provider.displayName || provider.alias)}</strong><span class="muted">${escapeHtml(`${provider.providerType} · ${provider.alias}`)}</span><span class="muted">${escapeHtml(`${provider.mapperCount} ${text("adminProviderMappers")}`)}</span></div><span>${escapeHtml(provider.enabled ? text("adminProviderEnabled") : text("adminProviderDisabled"))} · ${escapeHtml(provider.configured ? text("adminConfigured") : text("adminUnconfigured"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoIdentityProviders"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminIdentityProviders"))} pagination"><button class="secondary-button" type="button" data-identity-provider-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-identity-provider-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminSessions"))}"><form id="admin-session-search" class="actions" role="search"><input id="admin-session-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchSessions"))}" value="${escapeHtml(state.data.adminSessionQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchSessions"))}" maxlength="200"/><select id="admin-session-status" name="status" aria-label="${escapeHtml(text("adminSessions"))}"><option value="active" ${state.data.adminSessionStatus !== "expired" ? "selected" : ""}>${escapeHtml(text("adminActive"))}</option><option value="expired" ${state.data.adminSessionStatus === "expired" ? "selected" : ""}>${escapeHtml(text("adminExpired"))}</option></select><button class="primary-button" type="submit" ${state.busy === "admin-sessions-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-sessions-search")}${escapeHtml(text("adminSearchSessions"))}</button></form>${sessions.length ? `<div class="list">${sessions.map((session) => `<article class="list-item"><div><strong>${escapeHtml(session.username)}</strong><span class="muted">${Number.isSafeInteger(session.authorizationCount) ? session.authorizationCount : 0} ${escapeHtml(text("adminAuthorizations"))}</span></div><span>${escapeHtml(session.active ? text("adminActive") : text("adminExpired"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoSessions"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminSessions"))} pagination"><button class="secondary-button" type="button" data-admin-session-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-sessions-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-session-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-sessions-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminConsents"))}"><form id="admin-consent-search" class="actions" role="search"><input id="admin-consent-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchConsents"))}" value="${escapeHtml(state.data.adminConsentQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchConsents"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "admin-consents-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-consents-search")}${escapeHtml(text("adminSearchConsents"))}</button></form>${consents.length ? `<div class="list">${consents.map((consent) => `<article class="list-item"><div><strong>${escapeHtml(consent.clientName || consent.clientId)}</strong><span class="muted">${escapeHtml(consent.principalName)}</span><span class="muted">${escapeHtml((consent.authorities ?? []).join(", "))}</span></div></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoConsents"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminConsents"))} pagination"><button class="secondary-button" type="button" data-admin-consent-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-consents-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-consent-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-consents-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminOfflineSessions"))}">${sessions.length ? `<div class="list">${sessions.map((session) => `<article class="list-item"><div><strong>${escapeHtml(session.clientName || session.clientId)}</strong><span class="muted">${escapeHtml(session.username)}</span></div></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("offlineSessionsEmpty"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminOfflineSessions"))} pagination"><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
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
  return `<section class="card" aria-label="${escapeHtml(text("adminKeys"))}"><form id="admin-key-search" class="actions" role="search"><input id="admin-key-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchKeys"))}" value="${escapeHtml(state.data.adminKeyQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchKeys"))}" maxlength="200"/><select id="admin-key-active" name="active" aria-label="${escapeHtml(text("adminKeys"))}"><option value="all" ${state.data.adminKeyActive === "all" ? "selected" : ""}>${escapeHtml(text("adminKeys"))}</option><option value="true" ${state.data.adminKeyActive !== "all" && state.data.adminKeyActive !== "false" ? "selected" : ""}>${escapeHtml(text("adminKeyActive"))}</option><option value="false" ${state.data.adminKeyActive === "false" ? "selected" : ""}>${escapeHtml(text("adminKeyInactive"))}</option></select><button class="primary-button" type="submit" ${state.busy === "admin-keys-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-keys-search")}${escapeHtml(text("adminSearchKeys"))}</button></form>${keys.length ? `<div class="list">${keys.map((key) => `<article class="list-item"><div><strong>${escapeHtml(key.kid)}</strong><span class="muted">${escapeHtml(`${key.type} · ${key.algorithm} · ${key.use}`)}</span></div><span>${escapeHtml(key.active ? text("adminKeyActive") : text("adminKeyInactive"))}</span></article>`).join("")}</div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoKeys"))}</div>`}<div class="actions" aria-label="${escapeHtml(text("adminKeys"))} pagination"><button class="secondary-button" type="button" data-admin-key-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-keys-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-key-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-keys-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function profileContent() {
  const profile = state.profile ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><h2>${escapeHtml(text("firstName"))} &amp; ${escapeHtml(text("lastName"))}</h2><p>${escapeHtml(text("profileLoadError"))}</p><form data-form="profile" novalidate><div class="form-grid">${field("firstName", text("firstName"), profile.firstName ?? "", errors.firstName)}${field("lastName", text("lastName"), profile.lastName ?? "", errors.lastName)}${field("email", text("email"), profile.email ?? "", errors.email, "email")}<div class="field"><label for="preferredLocale">${escapeHtml(text("language"))}</label><select id="preferredLocale" name="preferredLocale"><option value="en" ${profile.preferredLocale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${profile.preferredLocale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select><div class="field-error"></div></div>${field("currentPassword", text("currentPassword"), "", errors.currentPassword, "password", 'autocomplete="current-password"')}</div><div class="actions">${button(text("save"), { action: "save-profile", type: "submit", busy: state.busy === "profile" })}</div></form></section>`;
}

function securityContent() {
  const mfa = state.data.mfa ?? {};
  const social = state.data.social ?? [];
  const passwordErrors = violations(state.error?.body);
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("passwordPolicy"))}</h2><p>${escapeHtml(text("securityTitle"))}</p><form data-form="password" novalidate>${field("currentPassword", text("currentPassword"), "", passwordErrors.currentPassword, "password")}${field("newPassword", text("newPassword"), "", passwordErrors.newPassword, "password")}${field("confirmPassword", text("confirmPassword"), "", passwordErrors.confirmPassword, "password")}<div class="actions">${button(text("save"), { action: "save-password", type: "submit", busy: state.busy === "password" })}</div></form></section><section class="card"><h2>${escapeHtml(text("mfaTitle"))}</h2><p>${escapeHtml(text("mfaHelp"))}</p>${mfa.available === false ? `<div class="notice">${escapeHtml(text("mfaUnavailable"))}</div>` : mfa.enabled ? `<div class="notice success">${escapeHtml(text("mfaEnabled"))}</div>${field("mfaCode", text("mfaCode"), "", "", "text", 'inputmode="numeric" maxlength="${mfa.digits ?? 6}"')}${button(text("mfaDisable"), { action: "mfa-disable", busy: state.busy === "mfa" })}` : mfa.setup ? `<div class="notice">${escapeHtml(text("mfaSecret"))}: <code>${escapeHtml(mfa.setup.secret ?? "")}</code></div>${field("mfaCode", text("mfaCode"), "", "", "text", 'inputmode="numeric" maxlength="${mfa.setup.digits ?? 6}"')}${button(text("mfaEnable"), { action: "mfa-enable", busy: state.busy === "mfa" })}` : button(text("mfaSetup"), { action: "mfa-setup", busy: state.busy === "mfa" })}</section><section class="card"><h2>${escapeHtml(text("socialLinksTitle"))}</h2><p>${escapeHtml(text("socialLinksHelp"))}</p><div class="list">${social.length ? social.map((link) => `<div class="list-item"><div><strong>${escapeHtml(link.displayName ?? link.provider)}</strong><span class="muted">${escapeHtml(link.linked ? text("socialConnected") : link.configured && link.enabled ? text("socialNotConnected") : text("socialNotConfigured"))}</span></div>${link.linked ? button(text("socialRemove"), { action: "social-remove", danger: true }) : button(text("socialConnect"), { action: "social-start", busy: state.busy === "social", disabled: !link.configured || !link.enabled, value: link.provider })}</div>`).join("") : `<div class="empty">${escapeHtml(text("socialLinksEmpty"))}</div>`}</div></section><section class="card"><h2>${escapeHtml(text("deleteAccount"))}</h2><p>${escapeHtml(text("deleteAccountWarning"))}</p><form data-form="delete" novalidate>${field("deletePassword", text("currentPassword"), "", "", "password")}<div class="actions">${button(text("deleteAccount"), { action: "delete-account", danger: true, type: "submit", busy: state.busy === "delete" })}</div></form></section></div>`;
}

function pageItems(items, emptyText, renderItem) {
  return items?.length
    ? `<div class="list">${items.map(renderItem).join("")}</div>`
    : `<div class="empty">${escapeHtml(emptyText)}</div>`;
}

function sessionsContent() {
  const sessions = state.data.sessions ?? [];
  return `<section class="card"><h2>${escapeHtml(text("sessionsTitle"))}</h2><p>${escapeHtml(text("sessionsError"))}</p>${pageItems(sessions, text("sessionsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.current ? text("currentSession") : item.id)}</strong><span class="muted">${escapeHtml(item.createdAt ?? "")} · ${escapeHtml(item.lastAccessedAt ?? "")}</span></div>${item.current ? "" : button(text("signOutSession"), { action: "delete-session", danger: true })}</div>`)}<div class="actions">${button(text("signOutOthers"), { action: "delete-other-sessions", busy: state.busy === "sessions" })}</div></section>`;
}

function applicationsContent() {
  const applications = state.data.applications ?? [];
  const offline = state.data.offlineSessions ?? [];
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("applicationsTitle"))}</h2><p>${escapeHtml(text("applicationsError"))}</p>${pageItems(applications, text("applicationsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.clientId)}"><div><strong>${escapeHtml(item.clientName ?? item.clientId)}</strong><span class="muted">${escapeHtml((item.scopes ?? []).join(", "))}</span></div>${button(text("revokeApplication"), { action: "revoke-application", danger: true })}</div>`)}</section><section class="card"><h2>${escapeHtml(text("offlineSessionsTitle"))}</h2><p>${escapeHtml(text("offlineSessionsHelp"))}</p>${pageItems(offline, text("offlineSessionsEmpty"), (item) => `<div class="list-item" data-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.clientName ?? item.clientId)}</strong><span class="muted">${escapeHtml(item.issuedAt ?? "")}</span></div>${button(text("revokeOfflineSession"), { action: "revoke-offline", danger: true })}</div>`)}</section></div>`;
}

function settingsContent() {
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("appearance"))}</h2><div class="settings-row"><label for="theme">${escapeHtml(text("theme"))}</label><select id="theme"><option value="system">${escapeHtml(text("system"))}</option><option value="light">${escapeHtml(text("light"))}</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>${escapeHtml(text("dark"))}</option></select></div><div class="settings-row"><label for="language">${escapeHtml(text("language"))}</label><select id="language"><option value="en" ${state.locale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${state.locale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select></div></section><section class="card"><h2>${escapeHtml(text("security"))}</h2><p>${escapeHtml(state.locale === "tr" ? "Oturum anahtarları yalnızca masaüstü ana sürecinin güvenli kasasında tutulur." : "Session keys are kept only in the desktop main-process secure vault.")}</p>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</section></div>`;
}

function loginContent() {
  if (!hasConsoleSelection()) {
    return `<div class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(text("signInNote"))}</p><h1>${escapeHtml(state.locale === "tr" ? "Bir konsol seçin" : "Choose a console")}</h1><p>${escapeHtml(state.locale === "tr" ? "Devam etmek istediğiniz konsolu seçin." : "Select where you want to continue.")}</p><div class="actions">${button(text("adminTitle"), { action: "choose-admin" })}${button(text("accountTitle"), { action: "choose-account" })}</div></section></div>`;
  }
  const title =
    state.console === "admin" ? text("adminTitle") : text("accountTitle");
  return `<div class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text("signInNote"))}</p>${state.error ? `<div class="notice error" role="alert">${escapeHtml(state.error.message)}</div>` : ""}<div class="actions">${button(text("signIn"), { action: "sign-in", busy: state.authStarting })}${button(state.console === "admin" ? text("accountTitle") : text("adminTitle"), { action: "switch-console" })}</div></section></div>`;
}

function render() {
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

async function signIn() {
  if (state.authStarting) return;
  state.authStarting = true;
  state.error = null;
  render();
  clearTimeout(authTimeout);
  authTimeout = setTimeout(
    () => {
      state.authStarting = false;
      state.error = { message: text("authTimeout") };
      render();
    },
    5 * 60 * 1000,
  );
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
      message:
        state.locale === "tr"
          ? "Çıkış yapılamadı."
          : "Sign out could not be completed.",
    };
  }
  state.busy = null;
  render();
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitForm(form) {
  if (state.busy) return;
  const values = formValues(form);
  if (form.dataset.form === "profile") {
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
  if (
    [
      "logout",
      "sign-in",
      "switch-console",
      "switch-account",
      "toggle-locale",
      "retry",
    ].includes(action)
  ) {
    if (action === "logout") return logout();
    if (action === "sign-in") return signIn();
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
  state.offline = false;
  render();
});
window.addEventListener("offline", () => {
  state.offline = true;
  render();
});
setTheme(boot.theme);
void hydrate();
