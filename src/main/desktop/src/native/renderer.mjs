import { userMessages } from "./user-messages.mjs";
import { createRoleScreens } from "./roles.mjs";
import { createGroupScreens } from "./groups.mjs";
import { createOrganizationScreens } from "./organizations.mjs";

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
  busy: /** @type {string | null} */ (null),
  error: null,
  notice: null,
  offline: !navigator.onLine,
  authStarting: false,
  authCanceling: false,
};
const chooseLazy = (condition, whenTrue, whenFalse) =>
  condition ? whenTrue() : whenFalse();
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
let adminGroupSearchTimer;
let adminUserSearchTimer;
let adminClientSearchTimer;
let adminKeySearchTimer;
let adminEventSearchTimer;
let identityProviderSearchTimer;
let identityProviderMapperSearchTimer;
const hasConsoleSelection = () =>
  new URLSearchParams(location.search).has("console");
const text = (key) =>
  userMessages[state.locale]?.[key] ??
  messages[state.locale]?.[key] ??
  messages.en?.[key] ??
  key;
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
function adminUserById(id) {
  return (
    (Number(state.data.adminUserDetail?.id) === Number(id)
      ? state.data.adminUserDetail
      : null) ??
    (state.data.users?.content ?? []).find(
      (user) => Number(user.id) === Number(id),
    )
  );
}
const spin = (busy) =>
  busy ? '<span class="spinner" aria-hidden="true"></span>' : "";
const actionIcons = {
  "admin-provider-mappers-toggle": "edit",
  "admin-identity-provider-config-edit": "edit",
  "admin-saml-provider-config-edit": "edit",
  "admin-oidc-provider-create": "add",
  "admin-saml-provider-create": "add",
  "admin-message-delete-request": "delete",
  "admin-message-delete-confirm": "delete",
  "admin-provider-mapper-create": "add",
  "admin-user-toggle-confirm": "check",
  "admin-user-toggle-enabled": "check",
  "admin-user-action-email-toggle": "arrowRight",
  "admin-user-profile-attributes-toggle": "gear",
  "admin-user-passkeys-toggle": "shield",
  "admin-user-detail-open": "arrowRight",
  "admin-user-detail-delete": "delete",
  "admin-user-detail-impersonate": "user",
  "admin-user-detail-unlock": "reset",
  "admin-user-detail-add-group": "add",
  "admin-user-detail-remove-group": "remove",
  "admin-user-detail-revoke-session": "remove",
  "admin-user-detail-revoke-consent": "remove",
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
  "admin-client-roles-toggle": "edit",
  "admin-client-role-assignments-toggle": "edit",
  "admin-client-role-assignment-add": "add",
  "admin-client-role-assignment-remove-request": "delete",
  "admin-client-role-assignment-remove-confirm": "delete",
  "admin-client-role-composites-toggle": "edit",
  "admin-client-role-composite-search": "search",
  "admin-client-role-composite-add-request": "add",
  "admin-client-role-composite-add-confirm": "add",
  "admin-client-role-composite-remove-request": "delete",
  "admin-client-role-composite-remove-confirm": "delete",
  "admin-client-role-edit": "edit",
  "admin-client-role-delete-request": "delete",
  "admin-client-role-delete-confirm": "delete",
  "admin-consent-revoke-request": "delete",
  "admin-consent-revoke-confirm": "delete",
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
  "admin-session-detail": "view",
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
const nativeButtonSvg = {
  filter: '<path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/>',
  disable:
    '<circle cx="10" cy="7" r="3"/><path d="M4 20v-2a6 6 0 0 1 9-5.2M16 14l5 5m0-5-5 5"/>',
  enable:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 9-5.2m3 4 2 2 4-4"/>',
  logout:
    '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m5-4 4-4-4-4m4 4H9"/>',
  remove:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-8h5"/>',
  save: '<path d="M4 3h14l3 3v15H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/>',
  send: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  trash: '<path d="M4 7h16M10 3h4m4 4-1 13H7L6 7m4 4v6m4-6v6"/>',
  upload: '<path d="M12 16V3m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};
const actionIcon = (name) => {
  const metadata = icons[name];
  const svg = metadata?.svg ?? nativeButtonSvg[name];
  return svg
    ? `<span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>`
    : metadata
      ? `<span class="button-icon" aria-hidden="true">${escapeHtml(metadata.unicode)}</span>`
      : "";
};
const providerIconMarkup = (iconKey) => {
  const brandIcons = {
    google: [
      "512 512",
      "M500 261.8C500 403.3 403.1 504 260 504 122.8 504 12 393.2 12 256S122.8 8 260 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9c-88.3-85.2-252.5-21.2-252.5 118.2 0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9l-140.8 0 0-85.3 236.1 0c2.3 12.7 3.9 24.9 3.9 41.4z",
    ],
    github: [
      "512 512",
      "M216.5 362.5c-66-8-112.5-55.5-112.5-117 0-25 9-52 24-70-6.5-16.5-5.5-51.5 2-66 20-2.5 47 8 63 22.5 19-6 39-9 63.5-9s44.5 3 62.5 8.5c15.5-14 43-24.5 63-22 7 13.5 8 48.5 1.5 65.5 16 19 24.5 44.5 24.5 70.5 0 61.5-46.5 108-113.5 116.5 17 11 28.5 35 28.5 62.5l0 52C323 491.5 335.5 500 350.5 494 441 459.5 512 369 512 257 512 115.5 397 0 255.5 0S0 115.5 0 257c0 111 70.5 203 165.5 237.5 13.5 5 26.5-4 26.5-17.5l0-40c-7 3-16 5-24 5-33 0-52.5-18-66.5-51.5-5.5-13.5-11.5-21.5-23-23-6-.5-8-3-8-6 0-6 10-10.5 20-10.5 14.5 0 27 9 40 27.5 10 14.5 20.5 21 33 21s20.5-4.5 32-16c8.5-8.5 15-16 21-21z",
    ],
    linkedin: [
      "448 512",
      "M100.3 448l-92.9 0 0-299.1 92.9 0 0 299.1zM53.8 108.1C24.1 108.1 0 83.5 0 53.8 0 39.5 5.7 25.9 15.8 15.8s23.8-15.8 38-15.8 27.9 5.7 38 15.8 15.8 23.8 15.8 38c0 29.7-24.1 54.3-53.8 54.3zM447.9 448l-92.7 0 0-145.6c0-34.7-.7-79.2-48.3-79.2-48.3 0-55.7 37.7-55.7 76.7l0 148.1-92.8 0 0-299.1 89.1 0 0 40.8 1.3 0c12.4-23.5 42.7-48.3 87.9-48.3 94 0 111.3 61.9 111.3 142.3l0 164.3-.1 0z",
    ],
    microsoft: [
      "448 512",
      "M0 32l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6zM0 265.4l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6z",
    ],
  };
  const icon = brandIcons[String(iconKey ?? "").toLowerCase()];
  if (!icon) return actionIcon("globe");
  return `<svg viewBox="0 0 ${icon[0]}" aria-hidden="true" focusable="false"><path d="${icon[1]}"/></svg>`;
};
const providerSearchIconMarkup =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>';
const button = (label, options = {}) => {
  const iconName =
    options.icon ??
    actionIcons[options.action] ??
    (label === text("save") ? "check" : null);
  const buttonClass =
    options.className ??
    (options.danger
      ? "danger-button"
      : options.variant === "secondary"
        ? "secondary-button"
        : options.variant === "info"
          ? "info-button"
          : options.variant === "warning"
            ? "warning-button"
            : options.variant === "success"
              ? "success-button"
              : "primary-button");
  const optionalAttribute = (name, value) =>
    value == null ? "" : `${name}="${escapeHtml(value)}"`;
  const attributes = [
    `class="${buttonClass}"`,
    `type="${options.type ?? "button"}"`,
    optionalAttribute("form", options.form),
    `data-action="${options.action ?? ""}"`,
    options.provider
      ? optionalAttribute("data-provider", options.provider)
      : "",
    optionalAttribute("data-id", options.id),
    optionalAttribute("data-target", options.target),
    optionalAttribute("data-child", options.child),
    optionalAttribute("data-client-role-id", options.clientRoleId),
    optionalAttribute("data-member-id", options.memberId),
    optionalAttribute("data-member-kind", options.memberKind),
    optionalAttribute("data-mapper", options.mapper),
    options.index == null ? "" : `data-index="${options.index}"`,
    options.disabled || options.busy || (options.mutation && state.offline)
      ? "disabled"
      : "",
    options.busy ? 'aria-busy="true"' : "",
  ]
    .filter(Boolean)
    .join(" ");
  const iconMarkup = actionIcon(iconName);
  return `<button ${attributes}>${spin(options.busy)}${options.busy ? "" : iconMarkup}${escapeHtml(label)}</button>`;
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
  const createOrganization =
    state.route === "organizations" &&
    (state.data.adminAccess?.manageOrganizations === true ||
      state.data.adminAccess?.isAdmin === true);
  const createClientScope =
    (state.route === "client-scopes" &&
      adminRouteAllowed("client-scope-create")) ||
    (state.route === "client-scope-create" &&
      state.busy === "client-scope-create-route");
  const createClient =
    (state.route === "clients" && adminRouteAllowed("client-create")) ||
    (state.route === "client-create" && state.busy === "client-create-route");
  const createIdentityProvider =
    state.route === "identity-providers" &&
    adminRouteAllowed("identity-providers");
  const createAction = (() => {
    const disabled = state.offline || Boolean(state.busy);
    if (state.console !== "admin") return "";
    if (createUser)
      return button(text("adminCreateUser"), {
        action: "create-user",
        busy:
          state.busy === "user-create-route" || state.busy === "route:users",
        disabled,
        icon: "add",
      });
    if (createRole && state.data.adminAccess?.manageRoles === true)
      return button(text("adminCreateRole"), {
        action: "create-role",
        busy:
          state.busy === "role-create-route" || state.busy === "route:roles",
        disabled,
        icon: "add",
      });
    if (createGroup && state.data.adminAccess?.manageUsers === true)
      return button(text("adminCreateGroup"), {
        action: "create-group",
        busy:
          state.busy === "group-create-route" || state.busy === "route:groups",
        disabled,
        icon: "add",
      });
    if (createOrganization)
      return button(text("adminOrganizationCreate"), {
        action: "create-organization",
        busy:
          state.busy === "organization-create-route" ||
          state.busy === "route:organizations",
        disabled,
        icon: "add",
      });
    if (createClient)
      return button(text("adminCreateClient"), {
        action: "create-client",
        busy:
          state.busy === "client-create-route" ||
          state.busy === "route:clients",
        disabled,
        icon: "add",
      });
    if (createIdentityProvider)
      return button(text("adminCreateProvider"), {
        action: "admin-provider-create",
        disabled,
        icon: "add",
      });
    if (createClientScope)
      return button(text("adminCreateClientScope"), {
        action: "create-client-scope",
        busy:
          state.busy === "client-scope-create-route" ||
          state.busy === "route:client-scopes",
        disabled,
        icon: "add",
      });
    return "";
  })();
  const detailScope = state.data.clientScopeDetail;
  const deleteScopeAction =
    state.console === "admin" &&
    state.route === "client-scope-detail" &&
    detailScope &&
    !detailScope.builtIn &&
    state.data.adminAccess?.manageClients === true
      ? button(text("adminDeleteClientScope"), {
          action: "admin-client-scope-delete-request",
          id: detailScope.id,
          danger: true,
          disabled: state.offline || Boolean(state.busy),
        })
      : "";
  const sessionAction =
    state.console === "admin" &&
    state.route === "sessions" &&
    state.data.adminAccess?.manageSessions === true
      ? state.data.adminSessionRevokeAllConfirm === true
        ? `<div class="session-header-confirm"><span role="status">${escapeHtml(text("adminSessionRevokeAllConfirm"))}</span>${button(text("adminSessionRevokeAll"), { action: "admin-session-revoke-all-confirm", danger: true, busy: state.busy === "admin-session-revoke-all", disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-session-revoke-all-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : button(text("adminSessionRevokeAll"), {
            action: "admin-session-revoke-all-request",
            danger: true,
            disabled: state.offline || Boolean(state.busy),
            icon: "logout",
          })
      : "";
  const keyAction =
    state.console === "admin" &&
    state.route === "keys" &&
    state.data.adminAccess?.manageKeys === true
      ? state.data.adminKeyRotateConfirm === true
        ? `<div class="session-header-confirm"><span role="status">${escapeHtml(text("adminRotateSigningKeyConfirm"))}</span>${button(text("adminRotateSigningKeyNow"), { action: "admin-key-rotate-confirm", danger: true, busy: state.busy === "admin-key-rotate", mutation: true })}<button class="secondary-button" type="button" data-action="admin-key-rotate-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>`
        : button(text("adminRotateSigningKey"), {
            action: "admin-key-rotate-request",
            disabled: state.offline || Boolean(state.busy),
            icon: "reset",
            mutation: true,
          })
      : "";
  const eventCount =
    state.console === "admin" && state.route === "events"
      ? `<span class="admin-event-total-badge">${Number(state.data.adminEvents?.totalElements ?? 0)} ${escapeHtml(text("adminEventRecords"))}</span>`
      : "";
  if (state.console === "admin" && state.route === "user-detail")
    return `<div class="topbar is-user-detail"></div>`;
  return `<div class="topbar ${["clients", "client-detail", "client-create"].includes(state.route) ? "is-client-screen" : ""}"><div><h1 tabindex="-1" class="${state.route === "role-detail" ? "role-name" : ""}">${escapeHtml(title)}${eventCount}</h1>${state.route === "client-detail" ? `<code class="muted client-heading-id">${escapeHtml(state.data.clientConfiguration?.clientId ?? "")}</code>` : `<p>${escapeHtml(description)}</p>`}</div><div class="actions">${createAction}${deleteScopeAction}${sessionAction}${keyAction}</div></div>`;
};

function identityProviderBreadcrumb() {
  if (
    !["identity-provider-create", "identity-provider-detail"].includes(
      state.route,
    )
  )
    return "";
  const provider = (state.data.identityProviders?.content ?? []).find(
    (item) => String(item.id) === String(state.data.identityProviderDetailId),
  );
  const current =
    state.route === "identity-provider-create"
      ? text("adminCreateProvider")
      : (provider?.displayName ?? text("adminIdentityProviders"));
  return `<nav class="admin-breadcrumb" aria-label="${escapeHtml(text("adminBreadcrumb"))}"><a href="#/admin/identity-providers" data-action="admin-provider-list">${escapeHtml(text("adminIdentityProviders"))}</a><span aria-current="page">${escapeHtml(current)}</span></nav>`;
}

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

const adminNavigation = [
  [
    "dashboard",
    "adminNavDashboard",
    "gaugeHigh",
    (access) => access?.isAdmin === true,
  ],
  [
    "clients",
    "adminNavClients",
    "addressCard",
    (access) => access?.queryClients === true || access?.viewClients === true,
  ],
  [
    "client-scopes",
    "adminNavClientScopes",
    "layerGroup",
    (access) => access?.queryClients === true || access?.viewClients === true,
  ],
  [
    "identity-providers",
    "adminNavIdentityProviders",
    "globe",
    (access) => access?.isAdmin === true,
  ],
  [
    "users",
    "adminNavUsers",
    "users",
    (access) => access?.queryUsers === true || access?.viewUsers === true,
  ],
  [
    "roles",
    "adminNavRoles",
    "userShield",
    (access) => access?.viewRoles === true,
  ],
  [
    "groups",
    "adminNavGroups",
    "layerGroup",
    (access) => access?.queryGroups === true || access?.viewGroups === true,
  ],
  [
    "organizations",
    "adminNavOrganizations",
    "layerGroup",
    (access) =>
      access?.queryOrganizations === true || access?.viewOrganizations === true,
  ],
  [
    "sessions",
    "adminNavSessions",
    "laptop",
    (access) => access?.viewSessions === true,
  ],
  [
    "offline-sessions",
    "adminNavOfflineSessions",
    "clock",
    (access) => access?.viewSessions === true,
  ],
  [
    "consents",
    "adminNavConsents",
    "shieldHalved",
    (access) => access?.viewConsents === true,
  ],
  ["keys", "adminNavKeys", "key", (access) => access?.viewKeys === true],
  [
    "events",
    "adminNavEvents",
    "clockRotateLeft",
    (access) => access?.viewEvents === true,
  ],
  [
    "server-info",
    "adminServerInfo",
    "circleInfo",
    (access) => access?.viewKeys === true,
  ],
  [
    "authentication",
    "adminNavAuthentication",
    "userShield",
    (access) => access?.isAdmin === true,
  ],
  [
    "configuration",
    "adminNavSettings",
    "sliders",
    (access) => access?.isAdmin === true || access?.viewEvents === true,
  ],
  // Desktop-only administration screens remain available after the shared Web menu.
  [
    "notifications",
    "notificationsTitle",
    "globe",
    (access) => access?.isAdmin === true,
  ],
  [
    "policies",
    "adminPolicies",
    "shieldHalved",
    (access) => access?.isAdmin === true,
  ],
  [
    "login-email",
    "adminLoginEmail",
    "sliders",
    (access) => access?.isAdmin === true,
  ],
  [
    "localization",
    "adminLocalization",
    "globe",
    (access) => access?.isAdmin === true,
  ],
  ["ldap", "adminLdap", "globe", (access) => access?.isAdmin === true],
];
const ADMIN_ACCESS_KEYS = [
  "isAdmin",
  "queryUsers",
  "viewUsers",
  "manageUsers",
  "viewRoles",
  "manageRoles",
  "queryGroups",
  "viewGroups",
  "manageGroups",
  "queryOrganizations",
  "viewOrganizations",
  "manageOrganizations",
  "queryClients",
  "viewClients",
  "manageClients",
  "viewSessions",
  "manageSessions",
  "viewConsents",
  "manageConsents",
  "viewEvents",
  "manageEvents",
  "viewKeys",
  "manageKeys",
];

function normalizeAdminAccess(value) {
  if (!value || typeof value !== "object") return null;
  const access = {};
  for (const key of ADMIN_ACCESS_KEYS) {
    if (typeof value[key] !== "boolean") return null;
    access[key] = value[key];
  }
  return access;
}

function adminRouteAllowed(route) {
  const access = state.data.adminAccess;
  if (!access) return false;
  const routeAccess = adminNavigation.find(
    ([candidate]) => candidate === route,
  );
  if (routeAccess) return routeAccess[3](access);
  if (["user-create"].includes(route)) return access.manageUsers;
  if (["role-create"].includes(route)) return access.manageRoles;
  if (route === "role-detail") return access.viewRoles;
  if (route === "group-create") return access.manageUsers;
  if (route === "group-detail") return access.queryGroups || access.viewGroups;
  if (route === "organization-create")
    return access.manageOrganizations || access.isAdmin;
  if (["client-scope-create"].includes(route)) return access.manageClients;
  if (route === "client-scope-detail")
    return access.queryClients || access.viewClients || access.manageClients;
  if (["client-create"].includes(route)) return access.manageClients;
  if (route === "client-detail")
    return access.viewClients || access.manageClients;
  if (["identity-provider-create", "identity-provider-detail"].includes(route))
    return access.isAdmin === true;
  if (route === "user-detail")
    return access.viewUsers === true || access.queryUsers === true;
  return false;
}

function firstAuthorizedAdminRoute() {
  return (
    adminNavigation.find(([, , , allowed]) =>
      allowed(state.data.adminAccess),
    )?.[0] ?? null
  );
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
  if (options.isCurrent && !options.isCurrent()) return undefined;
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

async function userRequiredActions(id) {
  const actions = await request(`/api/admin/required-actions/users/${id}`);
  if (
    !Array.isArray(actions) ||
    actions.some(
      (action) =>
        typeof action.key !== "string" ||
        !/^[A-Z][A-Z0-9_]{0,99}$/.test(action.key) ||
        typeof action.displayName !== "string" ||
        typeof action.assigned !== "boolean" ||
        typeof action.enabled !== "boolean" ||
        typeof action.globalPolicy !== "boolean",
    )
  ) {
    throw new Error("Invalid required actions response");
  }
  return actions;
}

async function loadClientScopeRoleCandidates(scopeId, kind, page) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  if (!mapping || !["applicationRoles", "clientRoleIds"].includes(kind))
    throw new Error("Invalid client-scope role candidate request");
  const queryKey =
    kind === "applicationRoles" ? "applicationRoleQuery" : "clientRoleQuery";
  const query = new URLSearchParams({
    q: mapping[queryKey] ?? "",
    page: String(page),
    size: "100",
    sort: "name,asc",
  });
  const endpoint =
    kind === "applicationRoles" ? "application-roles" : "client-roles";
  const response = await request(
    `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/${endpoint}?${query.toString()}`,
  );
  const candidatesKey =
    kind === "applicationRoles"
      ? "applicationRoleCandidates"
      : "clientRoleCandidates";
  mapping[candidatesKey] = normalizeClientScopeRolePage(response, page);
}

function normalizeClientScopeRolePage(response, fallbackPage = 0) {
  return {
    ...response,
    content: Array.isArray(response?.content) ? response.content : [],
    number: Number(response?.page?.number ?? response?.number ?? fallbackPage),
    totalPages: Number(response?.page?.totalPages ?? response?.totalPages ?? 0),
    totalElements: Number(
      response?.page?.totalElements ??
        response?.totalElements ??
        response?.content?.length ??
        0,
    ),
  };
}

async function loadClientScopeDetailSections(scopeId) {
  const [current, applicationRoles, clientRoles, mapperPage] =
    await Promise.all([
      request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings`,
      ),
      request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/application-roles?page=0&size=100&sort=name,asc`,
      ),
      request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/role-mappings/client-roles?page=0&size=100&sort=name,asc`,
      ),
      request(
        `/api/admin/client-scopes/${encodeURIComponent(scopeId)}/mappers?page=0&size=20&sort=name,asc`,
      ),
    ]);
  state.data.adminClientScopeRoleMappings ??= {};
  state.data.adminClientScopeRoleMappings[scopeId] = {
    current,
    draft: {
      applicationRoles: [...(current.applicationRoles ?? [])],
      clientRoleIds: (current.clientRoles ?? []).map((role) => role.id),
    },
    applicationRoleQuery: "",
    clientRoleQuery: "",
    applicationRoleCandidates: normalizeClientScopeRolePage(applicationRoles),
    clientRoleCandidates: normalizeClientScopeRolePage(clientRoles),
  };
  state.data.clientScopeMappers ??= {};
  state.data.clientScopeMappers[scopeId] = Array.isArray(mapperPage?.content)
    ? mapperPage.content
    : [];
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
      ? adminNavigation
          .filter(([, , , allowed]) => allowed(state.data.adminAccess))
          .map(([route, messageKey, icon]) =>
            navButton(route, text(messageKey), icon),
          )
          .join("")
      : `${navButton("profile", text("firstName"))}${navButton("security", text("security"))}${navButton("sessions", text("sessions"))}${navButton("applications", text("applications"))}${navButton("notifications", text("notificationsTitle"))}${navButton("settings", text("settings"))}`;
  const authorizedRoute =
    state.error?.kind === "forbidden" && state.console === "admin"
      ? firstAuthorizedAdminRoute()
      : null;
  const errorAction =
    state.error?.kind === "unauthorized"
      ? button(text("signIn"), { action: "sign-in" })
      : chooseLazy(
          authorizedRoute,
          () =>
            button(text("adminForbiddenReturn"), {
              action: "admin-return-authorized",
              busy: state.busy === "admin-return-authorized",
            }),
          () =>
            chooseLazy(
              state.error?.kind === "forbidden" && state.console === "admin",
              () => "",
              () =>
                button(
                  chooseLazy(
                    state.console === "admin",
                    () => text("adminRetry"),
                    () => text("sessionsRetry"),
                  ),
                  { action: "retry", busy: state.busy === "retry" },
                ),
            ),
        );
  return `<div class="app ${["roles", "role-detail", "role-create", "groups", "group-detail", "group-create"].includes(state.route) ? "is-role-screen" : isClientScopeScreen() ? "is-scope-screen" : ""}"><aside class="sidebar" aria-label="${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}"><div class="brand"><span class="brand-mark" aria-hidden="true"><img class="brand-light" src="app://renderer/native/brand/logo-light.svg" alt=""/><img class="brand-dark" src="app://renderer/native/brand/logo-dark.svg" alt=""/></span><span>Kitezh</span></div><p class="console-label">${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}</p><nav class="nav" aria-label="${escapeHtml(text("settings"))}">${navigation}</nav><div class="sidebar-footer">${state.console === "admin" ? button(text("accountTitle"), { action: "switch-account" }) : ""}${button(state.locale === "tr" ? text("english") : text("turkish"), { action: "toggle-locale", busy: state.busy === "locale", icon: "globe", variant: "secondary" })}${button(text("signOut"), { action: "logout", busy: state.busy === "logout", disabled: Boolean(state.busy), icon: "logout", variant: "secondary" })}</div></aside><main class="main">${state.console === "admin" && ["role-detail", "role-create"].includes(state.route) ? roleScreens.breadcrumb() : ""}${state.console === "admin" && ["group-detail", "group-create"].includes(state.route) && !state.loading ? groupScreens.breadcrumb() : ""}${state.console === "admin" ? nativeClientBreadcrumb() + clientScopeBreadcrumb() + identityProviderBreadcrumb() : ""}${pageHeader(routeTitle(), routeDescription())}<div class="content">${state.offline ? '<div class="notice warning" role="status">' + escapeHtml(text("offlineNotice")) + "</div>" : ""}${state.notice ? '<div class="notice success" role="status">' + escapeHtml(state.notice) + "</div>" : ""}${state.error ? '<div class="notice error" role="alert">' + escapeHtml(problemMessage(state.error)) + " " + errorAction + "</div>" : ""}${content()}</div></main></div>`;
}

function navButton(route, label, icon) {
  const busy = state.busy === `route:${route}`;
  const current =
    state.route === route ||
    (route === "users" && state.route === "user-detail") ||
    (route === "client-scopes" && isClientScopeScreen()) ||
    (route === "clients" &&
      ["client-detail", "client-create"].includes(state.route)) ||
    (route === "groups" &&
      ["group-detail", "group-create"].includes(state.route)) ||
    (route === "organizations" && state.route === "organization-create");
  return `<button type="button" data-route="${route}" aria-current="${current ? "page" : "false"}" ${busy ? 'disabled aria-busy="true"' : ""}>${spin(busy)}${actionIcon(icon)}${escapeHtml(label)}</button>`;
}

function routeTitle() {
  if (state.console === "admin" && state.route === "user-detail")
    return state.data.adminUserDetail?.username ?? text("adminUsers");
  if (state.console === "admin")
    return {
      users: text("adminUsers"),
      "user-create": text("adminCreateUser"),
      roles: text("adminRoles"),
      "role-create": text("adminCreateRole"),
      "role-detail": state.data.roleDetailName,
      groups: text("adminGroups"),
      "group-create": text("adminCreateGroup"),
      "group-detail": state.data.groupDetail?.name ?? text("adminGroups"),
      organizations: text("adminOrganizationTitle"),
      "organization-create": text("adminOrganizationCreateTitle"),
      "client-scopes": text("adminClientScopes"),
      "client-scope-create": text("adminCreateClientScope"),
      "client-scope-detail":
        state.data.clientScopeDetail?.name ??
        state.data.clientScopeDetailId ??
        text("adminClientScopes"),
      "client-create": text("adminCreateClient"),
      clients: text("adminClients"),
      "client-detail":
        state.data.clientConfiguration?.clientName ?? text("adminClients"),
      "identity-providers": text("adminIdentityProviders"),
      "identity-provider-create": text("adminCreateProvider"),
      "identity-provider-detail":
        (state.data.identityProviders?.content ?? []).find(
          (item) =>
            String(item.id) === String(state.data.identityProviderDetailId),
        )?.displayName ?? text("adminIdentityProviders"),
      sessions: text("adminSessions"),
      notifications: text("notificationsTitle"),
      consents: text("adminNavConsents"),
      "offline-sessions": text("adminOfflineSessions"),
      events: text("adminEvents"),
      keys: text("adminNavKeys"),
      policies: text("adminPolicies"),
      configuration: text("adminConfiguration"),
      "server-info": text("adminServerInfo"),
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
    notifications: text("notificationsTitle"),
  }[state.route];
}

function routeDescription() {
  if (state.console === "admin" && state.route === "user-detail")
    return state.locale === "tr" ? "Kullanıcı" : "User";
  if (state.console === "admin")
    return {
      users: text("adminSearchUsers"),
      "user-create": text("adminCreateUserDescription"),
      roles: roleScreens.subtitle(),
      "role-detail": roleScreens.subtitle(),
      "role-create": text("adminCreateRoleDescription"),
      groups: groupScreens.subtitle(),
      "group-create": groupScreens.subtitle(),
      "group-detail": groupScreens.subtitle(),
      organizations: text("adminOrganizationSubtitle"),
      "organization-create": text("adminOrganizationCreateSubtitle"),
      "client-scopes": text("adminClientScopesDescription"),
      "client-scope-detail":
        state.data.clientScopeDetail?.displayName ||
        text("adminClientScopeDetailDescription"),
      "client-scope-create": text("adminCreateClientScopeDescription"),
      "client-create": text("adminCreateClientDescription"),
      clients: text("adminClientsDescription"),
      "client-detail": "",
      "identity-providers": text("adminSearchIdentityProviders"),
      "identity-provider-create": text("adminIdentityProvidersSubtitle"),
      "identity-provider-detail": "",
      sessions: text("adminSessionsDescription"),
      notifications: text("notificationsDescription"),
      consents: text("adminConsentDescription"),
      "offline-sessions": text("offlineSessionsHelp"),
      events: text("adminEventsDescription"),
      keys: text("adminKeysDescription"),
      policies: text("adminPoliciesDescription"),
      configuration: text("adminConfigurationDescription"),
      "server-info": text("adminServerInfoDescription"),
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
    notifications: text("notificationsDescription"),
  }[state.route];
}

function content() {
  if (state.console === "admin" && state.error?.kind === "forbidden")
    return `<section class="card" role="status">${escapeHtml(problemMessage(state.error))}</section>`;
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
  if (state.route === "notifications") return notificationsContent();
  return settingsContent();
}

function adminContent() {
  if (state.route === "notifications") return notificationsContent();
  if (state.route === "users") return adminUsersContent();
  if (state.route === "user-detail") return adminUserDetailContent();
  if (state.route === "user-create") return adminUserCreateContent();
  if (state.route === "roles") return adminRolesContent();
  if (state.route === "role-create") return adminRoleCreateContent();
  if (state.route === "role-detail") return roleScreens.detail();
  if (state.route === "groups") return groupScreens.list();
  if (state.route === "group-create") return groupScreens.create();
  if (state.route === "group-detail") return groupScreens.detail();
  if (state.route === "organizations") return organizationScreens.list();
  if (state.route === "organization-create")
    return organizationScreens.create();
  if (state.route === "client-scopes") return adminClientScopesContent();
  if (state.route === "client-scope-detail")
    return adminClientScopeDetailContent();
  if (state.route === "client-scope-create")
    return adminClientScopeCreateContent();
  if (state.route === "client-create") return adminClientCreateContent();
  if (state.route === "clients") return adminClientsContent();
  if (state.route === "client-detail") return adminNativeClientDetail();
  if (state.route === "identity-providers")
    return adminIdentityProvidersContent();
  if (state.route === "identity-provider-create")
    return identityProviderDetailContent("new", "details");
  if (state.route === "identity-provider-detail")
    return identityProviderDetailContent(
      state.data.identityProviderDetailId,
      state.data.identityProviderDetailTab ?? "details",
    );
  if (state.route === "sessions") return adminAdminSessionsContent();
  if (state.route === "consents") return adminAdminConsentsContent();
  if (state.route === "offline-sessions")
    return adminAdminOfflineSessionsContent();
  if (state.route === "events") return adminAdminEventsContent();
  if (state.route === "keys") return adminAdminKeysContent();
  if (state.route === "policies") return adminAdminPoliciesContent();
  if (state.route === "configuration") return adminAdminConfigurationContent();
  if (state.route === "server-info") return adminServerInfoContent();
  if (state.route === "login-email") return adminAdminLoginEmailContent();
  if (state.route === "localization") return adminAdminLocalizationContent();
  if (state.route === "ldap") return adminAdminLdapContent();
  if (state.route === "authentication")
    return adminAdminAuthenticationContent();
  const dashboard = state.data.dashboard ?? {};
  const stats = [
    ["clients", "adminStatClients", "layers", "clients"],
    ["users", "adminStatUsers", "home", "users"],
    ["sessions", "adminStatSessions", "gear", "sessions"],
    ["consents", "adminStatConsents", "shield", "consents"],
  ];
  const statCards = stats
    .map(([key, label, iconName, route]) => {
      const icon = icons[iconName];
      return `<article class="card stat-card"><div><h2>${escapeHtml(text(label))}</h2><p class="stat-value">${Number.isSafeInteger(dashboard[key]) && dashboard[key] >= 0 ? dashboard[key] : "—"}</p></div><span class="admin-stat-icon" aria-hidden="true">${icon ? escapeHtml(icon.unicode) : ""}</span><div class="stat-action">${navButton(route, text("adminViewAll"))}</div></article>`;
    })
    .join("");
  const health = state.data.adminHealth ?? "DOWN";
  const server = state.data.adminServerInfo ?? {};
  const signingKey = server.activeSigningKey;
  const events = Array.isArray(state.data.adminDashboardEvents)
    ? state.data.adminDashboardEvents
    : [];
  const eventRows = events
    .map(
      (event) =>
        `<div class="dashboard-event"><span class="event-action">${escapeHtml(event.action)}</span><div class="event-summary"><strong>${escapeHtml(event.actor)}</strong><span>${escapeHtml(event.targetType)}</span><small>${escapeHtml(event.targetId)}</small></div><time datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(new Date(event.occurredAt).toLocaleString(state.locale === "tr" ? "tr-TR" : "en-US"))}</time></div>`,
    )
    .join("");
  return `<div class="dashboard-layout"><section class="stat-grid" aria-label="${escapeHtml(text("adminDashboard"))}">${statCards}</section><section class="dashboard-panels"><article class="card dashboard-panel"><h2><span aria-hidden="true">${escapeHtml(icons.heartPulse?.unicode ?? "")}</span>${escapeHtml(text("adminServerHealth"))}</h2><div class="health-row"><span class="health-badge ${health === "UP" ? "is-up" : "is-down"}" role="status">${escapeHtml(health)}</span><span>${escapeHtml(text("adminReadinessProbe"))}</span></div><p class="issuer-value">${escapeHtml(server.issuer ?? "—")}</p>${navButton("configuration", text("adminOpenServerInfo"))}</article><article class="card dashboard-panel"><h2><span aria-hidden="true">${escapeHtml(icons.key?.unicode ?? "")}</span>${escapeHtml(text("adminActiveSigningKey"))}</h2>${signingKey ? '<p class="signing-key-id">' + escapeHtml(signingKey.kid) + '</p><span class="key-algorithm">' + escapeHtml(signingKey.algorithm) + "</span>" : '<p class="empty-value">—</p>'}${navButton("keys", text("adminManageKeys"))}</article></section><section class="card dashboard-events"><div class="dashboard-events-heading"><div><h2><span aria-hidden="true">${escapeHtml(icons.clockRotateLeft?.unicode ?? "")}</span>${escapeHtml(text("adminRecentEvents"))}</h2><p>${escapeHtml(text("adminRecentActivity"))}</p></div>${navButton("events", text("adminViewAll"))}</div><div class="dashboard-event-list">${eventRows || '<p class="empty-value">' + escapeHtml(text("adminNoRecentEvents")) + "</p>"}</div></section></div>`;
}

function notificationsContent() {
  const page = state.data.notifications ?? { content: [] };
  const items = Array.isArray(page.content) ? page.content : [];
  const unread = Number.isSafeInteger(state.data.notificationUnreadCount)
    ? state.data.notificationUnreadCount
    : 0;
  const itemRows = items
    .map((item) => {
      const busy = state.busy === `notification-read:${item.id}`;
      const key = typeof item.messageKey === "string" ? item.messageKey : "";
      const safeMessageKeys = new Set([
        "notificationAccountPasswordChanged",
        "notificationAccountMfaEnabled",
        "notificationAccountMfaDisabled",
        "notificationAccountSessionRevoked",
        "notificationAdminUserRegistered",
      ]);
      const createdAt =
        typeof item.createdAt === "string" ? item.createdAt : "";
      const date = Number.isNaN(Date.parse(createdAt))
        ? ""
        : new Date(createdAt).toLocaleString(
            chooseLazy(
              state.locale === "tr",
              () => "tr-TR",
              () => "en-US",
            ),
          );
      return `<article class="list-item"><div><strong>${escapeHtml(text(safeMessageKeys.has(key) ? key : "notificationsUnknown"))}</strong><span class="muted">${escapeHtml(date)}</span><span>${escapeHtml(item.read ? text("notificationRead") : text("notificationUnread"))}</span></div>${item.read ? "" : button(text("notificationMarkRead"), { action: "notification-read", id: item.id, busy, disabled: state.offline || Boolean(state.busy) })}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("notificationsTitle"))}"><h2>${escapeHtml(text("notificationsTitle"))}</h2><p>${escapeHtml(text("notificationsUnreadCount"))}: ${unread}</p>${items.length ? '<div class="list">' + itemRows + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("notificationsEmpty")) + "</div>"}<div class="actions">${button(text("refresh"), { action: "notifications-refresh", busy: state.busy === "notifications-refresh", disabled: state.offline || Boolean(state.busy) })}</div></section>`;
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
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDisableUserPrompt"))}</span>${button(text("adminDisableUser"), { action: "admin-user-toggle-confirm", id: user.id, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-toggle-cancel" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(
            text(
              chooseLazy(
                user.enabled,
                () => "adminDisableUser",
                () => "adminEnableUser",
              ),
            ),
            {
              action: "admin-user-toggle-enabled",
              id: user.id,
              variant: "secondary",
              disabled: state.offline || Boolean(state.busy),
            },
          )}</div>`;
      const deleteConfirming =
        Number(state.data.userDeleteConfirmId) === Number(user.id);
      const deleting = state.busy === `user-delete:${user.id}`;
      const deleteControls = deleteConfirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteUserPrompt"))}</span>${button(text("adminDeleteUser"), { action: "admin-user-delete-confirm", id: user.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-delete-cancel" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminDeleteUser"), { action: "admin-user-delete-request", id: user.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const totpConfirming =
        Number(state.data.userTotpResetConfirmId) === Number(user.id);
      const totpBusy = state.busy === `user-totp-reset:${user.id}`;
      const totpControls = !user.totpEnabled
        ? ""
        : chooseLazy(
            totpConfirming,
            () =>
              `<div class="actions"><span role="status">${escapeHtml(text("adminResetAuthenticatorPrompt"))}</span>${button(text("adminResetAuthenticator"), { action: "admin-user-totp-reset-confirm", id: user.id, danger: true, busy: totpBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-totp-reset-cancel" ${chooseLazy(
                state.busy,
                () => "disabled",
                () => "",
              )}>${escapeHtml(text("cancel"))}</button></div>`,
            () =>
              `<div class="actions">${button(text("adminResetAuthenticator"), { action: "admin-user-totp-reset-request", id: user.id, icon: "reset", variant: "secondary", disabled: state.offline || Boolean(state.busy) })}</div>`,
          );
      const unlockBusy = state.busy === `user-unlock:${user.id}`;
      const actionEmailOpen =
        Number(state.data.userActionEmailOpenId) === Number(user.id);
      const actionEmailControl = user.email
        ? button(text("adminSendActionEmail"), {
            action: "admin-user-action-email-toggle",
            id: user.id,
            variant: "secondary",
            disabled: state.offline || Boolean(state.busy),
          })
        : "";
      const unlockControl = user.locked
        ? button(text("adminUnlockUser"), {
            action: "admin-user-unlock",
            id: user.id,
            icon: "reset",
            variant: "secondary",
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
        variant: "secondary",
        disabled: state.offline || Boolean(state.busy),
      });
      const passwordResetForm = passwordResetOpen
        ? `<form class="card" data-form="admin-user-password-reset" data-user-id="${escapeHtml(user.id)}" novalidate><div class="field"><label for="user-password-${escapeHtml(user.id)}">${escapeHtml(text("newPassword"))}</label><input id="user-password-${escapeHtml(user.id)}" name="password" type="password" aria-invalid="${Boolean(passwordResetErrors.password)}" minlength="12" maxlength="128" autocomplete="new-password" required/><div class="field-error">${escapeHtml(passwordResetErrors.password ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="temporary"/>${escapeHtml(text("adminUserTemporaryPassword"))}</label><div class="actions">${button(text("adminSetPassword"), { type: "submit", busy: passwordResetBusy, disabled: state.offline })}<button class="secondary-button" type="button" data-action="admin-user-password-reset-cancel" data-id="${escapeHtml(user.id)}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const passkeysOpen =
        Number(state.data.userPasskeysOpenId) === Number(user.id);
      const passkeysLoading = state.busy === `user-passkeys-load:${user.id}`;
      const passkeysControl = button(text("adminManagePasskeys"), {
        action: "admin-user-passkeys-toggle",
        id: user.id,
        variant: "secondary",
        busy: passkeysLoading,
        disabled: state.offline || Boolean(state.busy),
      });
      const profileAttributesLoading =
        state.busy === `user-profile-attributes-load:${user.id}`;
      const profileAttributesControl = button(text("adminProfileAttributes"), {
        action: "admin-user-profile-attributes-toggle",
        id: user.id,
        variant: "secondary",
        busy: profileAttributesLoading,
        disabled: state.offline || Boolean(state.busy),
      });
      const avatarOpen =
        Number(state.data.userAvatarOpenId) === Number(user.id);
      const avatarControl = button(text("adminUserAvatar"), {
        action: "admin-user-avatar-toggle",
        id: user.id,
        variant: "secondary",
        disabled: state.offline || Boolean(state.busy),
      });
      const editing = Number(state.data.userEditOpenId) === Number(user.id);
      const selectedRoles = Array.isArray(editDraft.roles)
        ? editDraft.roles
        : (user.assignedRoles ?? user.authorities ?? []);
      const updateBusy = state.busy === `user-update:${user.id}`;
      const editForm = editing
        ? `<form class="card" data-form="admin-user-edit" data-user-id="${escapeHtml(user.id)}" novalidate><div class="form-grid">${field("username", text("username"), editDraft.username ?? user.username ?? "", editErrors.username, "text", 'maxlength="100" autocomplete="username" required')}${field("firstName", text("firstName"), editDraft.firstName ?? user.firstName ?? "", editErrors.firstName, "text", 'maxlength="100" autocomplete="given-name"')}${field("lastName", text("lastName"), editDraft.lastName ?? user.lastName ?? "", editErrors.lastName, "text", 'maxlength="100" autocomplete="family-name"')}${field("email", text("email"), editDraft.email ?? user.email ?? "", editErrors.email, "email", 'maxlength="200" autocomplete="email"')}</div><label class="settings-row"><input type="checkbox" name="emailVerified" ${chooseLazy(
            editDraft.emailVerified ?? user.emailVerified,
            () => "checked",
            () => "",
          )}/>${escapeHtml(text("adminUserEmailVerified"))}</label><label class="settings-row"><input type="checkbox" name="enabled" ${chooseLazy(
            editDraft.enabled ?? user.enabled,
            () => "checked",
            () => "",
          )}/>${escapeHtml(text("adminEnabled"))}</label><fieldset class="field"><legend>${escapeHtml(text("adminRoles"))}</legend>${chooseLazy(
            editRoles.length,
            () =>
              editRoles
                .map(
                  (role) =>
                    '<label class="settings-row"><input type="checkbox" name="roles" value="' +
                    escapeHtml(role.name) +
                    '" ' +
                    chooseLazy(
                      selectedRoles.includes(role.name),
                      () => "checked",
                      () => "",
                    ) +
                    "/>" +
                    escapeHtml(role.name) +
                    "</label>",
                )
                .join(""),
            () =>
              '<div class="empty" role="status">' +
              escapeHtml(text("adminNoRoles")) +
              "</div>",
          )}<div class="field-error">${escapeHtml(
            editErrors.roles ??
              chooseLazy(
                state.data.userEditErrorId === Number(user.id),
                () => state.data.userEditLocalError ?? "",
                () => "",
              ),
          )}</div></fieldset><div class="actions">${button(text("save"), { type: "submit", busy: updateBusy, disabled: state.offline || Boolean(state.busy) || editRoles.length === 0 })}<button class="secondary-button" type="button" data-action="admin-user-edit-cancel" data-id="${escapeHtml(user.id)}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const roles = user.effectiveRoles ?? user.authorities ?? [];
      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ");
      const avatar = userAvatarSource(user);
      const displayName = fullName || user.username;
      const actionMenu = `<details class="admin-user-menu"><summary aria-label="${escapeHtml(state.locale === "tr" ? "Kullanıcı işlemleri" : "User actions")}" ${state.busy ? 'aria-disabled="true"' : ""}>⋮</summary><div class="admin-user-menu-panel">${button(text("adminEditUser"), { action: "admin-user-edit-toggle", id: user.id, busy: state.busy === `user-edit-roles:${user.id}`, disabled: state.offline || Boolean(state.busy) })}${actionEmailControl}${profileAttributesControl}${avatarControl}${passwordResetControl}${unlockControl}${totpControls}${passkeysControl}${enabledControls}${deleteControls}</div></details>`;
      const detailContent = `${editForm}${passwordResetForm}${actionEmailOpen ? adminUserActionEmailContent(user.id) : ""}${passkeysOpen ? adminUserPasskeysContent(user.id) : ""}${Number(state.data.userProfileAttributesOpenId) === Number(user.id) ? adminUserProfileAttributesContent(user.id) : ""}${avatarOpen ? adminUserAvatarContent(user) : ""}`;
      return `<tr class="admin-user-row" data-user-id="${escapeHtml(user.id)}"><td class="admin-user-select"><input type="checkbox" data-action="admin-user-bulk-select" data-id="${escapeHtml(user.id)}" aria-label="${escapeHtml(text("adminSelectUser"))} ${escapeHtml(user.username)}" ${userSelected ? "checked" : ""} ${state.busy || state.offline ? "disabled" : ""}/></td><td class="admin-user-identity-cell"><div class="admin-user-identity"><span class="admin-user-avatar-small">${avatar ? `<img src="${escapeHtml(avatar)}" alt=""/>` : escapeHtml(displayName.slice(0, 1).toLocaleUpperCase())}</span><span class="admin-user-name"><button class="admin-user-detail-link" type="button" data-action="admin-user-detail-open" data-id="${escapeHtml(user.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(displayName)}</button><span>${escapeHtml(user.username)}</span></span></div></td><td class="admin-user-roles-cell"><div class="admin-user-roles">${roles.map((role) => `<span class="admin-user-role">${escapeHtml(role)}</span>`).join("") || '<span class="muted">—</span>'}</div></td><td class="admin-user-status-cell"><span class="admin-user-status ${user.enabled ? "is-enabled" : "is-disabled"}">${escapeHtml(user.enabled ? text("adminUserEnabled") : text("adminUserDisabled"))}</span>${user.locked ? `<span class="admin-user-locked">${escapeHtml(text("adminUserLocked"))}</span>` : ""}</td><td class="admin-user-row-actions">${actionMenu}</td></tr>${detailContent ? `<tr class="admin-user-detail-row"><td colspan="5">${detailContent}</td></tr>` : ""}`;
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
    ? `<section class="card" aria-label="${escapeHtml(text("adminSelectedUsers"))}"><span>${escapeHtml(text("adminSelectedUsers"))}: ${selectedUserIds.size}</span><div class="actions">${bulkButton("ENABLE", "adminBulkEnableUsers")}${bulkButton("DISABLE", "adminBulkDisableUsers")}${bulkButton("DELETE", "adminBulkDeleteUsers", true)}</div>${chooseLazy(
        bulkAction,
        () =>
          '<div class="actions"><span role="status">' +
          escapeHtml(text("adminBulkUserPrompt")) +
          "</span>" +
          button(
            text(
              chooseLazy(
                bulkAction === "ENABLE",
                () => "adminBulkEnableUsers",
                () =>
                  chooseLazy(
                    bulkAction === "DISABLE",
                    () => "adminBulkDisableUsers",
                    () => "adminBulkDeleteUsers",
                  ),
              ),
            ),
            {
              action: "admin-user-bulk-confirm",
              danger: bulkAction === "DELETE",
              busy: state.busy === "user-bulk-action",
              disabled: state.offline || Boolean(state.busy),
            },
          ) +
          '<button class="secondary-button" type="button" data-action="admin-user-bulk-cancel" ' +
          chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          ) +
          ">" +
          escapeHtml(text("cancel")) +
          "</button></div>",
        () => "",
      )}</section>`
    : "";
  const localeTr = state.locale === "tr";
  const sort = state.data.userSort ?? "username,asc";
  const status = state.data.userStatus ?? "";
  const selectedOnPage = users.filter((user) =>
    selectedUserIds.has(Number(user.id)),
  ).length;
  const allSelected = users.length > 0 && selectedOnPage === users.length;
  const totalElements = Number(page.totalElements ?? 0);
  return `<section class="admin-users-panel" aria-label="${escapeHtml(text("adminUsers"))}"><div class="admin-users-toolbar"><form id="admin-user-search" class="admin-users-search" role="search" aria-busy="${state.busy === "users-search"}">${state.busy === "users-search" ? spin(true) : '<span aria-hidden="true">⌕</span>'}<input id="admin-user-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchUsers"))}" value="${escapeHtml(state.data.userSearchDraft ?? state.data.userQuery ?? "")}" placeholder="${escapeHtml(localeTr ? "Ara" : "Search")}" maxlength="200"/></form><label class="admin-users-filter"><span class="sr-only">${escapeHtml(localeTr ? "Sıralama" : "Sort")}</span><select id="admin-user-sort" aria-label="${escapeHtml(localeTr ? "Sıralama" : "Sort")}"><option value="username,asc" ${sort === "username,asc" ? "selected" : ""}>${escapeHtml(localeTr ? "Kullanıcı adı · A–Z" : "Username · A–Z")}</option><option value="username,desc" ${sort === "username,desc" ? "selected" : ""}>${escapeHtml(localeTr ? "Kullanıcı adı · Z–A" : "Username · Z–A")}</option></select></label><label class="admin-users-filter"><span class="sr-only">${escapeHtml(localeTr ? "Durum" : "Status")}</span><select id="admin-user-status" aria-label="${escapeHtml(localeTr ? "Durum" : "Status")}"><option value="" ${status === "" ? "selected" : ""}>${escapeHtml(localeTr ? "Tümü" : "All statuses")}</option><option value="true" ${status === "true" ? "selected" : ""}>${escapeHtml(text("adminUserEnabled"))}</option><option value="false" ${status === "false" ? "selected" : ""}>${escapeHtml(text("adminUserDisabled"))}</option></select></label></div>${bulkControls}<div class="admin-users-count">${escapeHtml(localeTr ? `${totalElements} kayıt` : `${totalElements} records`)}</div>${users.length ? `<div class="admin-users-table-wrap"><table class="admin-users-table"><thead><tr><th class="admin-user-select"><input type="checkbox" data-action="admin-user-select-all" aria-label="${escapeHtml(localeTr ? "Sayfadaki tüm kullanıcıları seç" : "Select all users on this page")}" ${allSelected ? "checked" : ""} ${state.busy || state.offline ? "disabled" : ""}/></th><th>${escapeHtml(text("adminUsername"))}</th><th>${escapeHtml(text("adminRoles"))}</th><th>${escapeHtml(localeTr ? "Durum" : "Status")}</th><th><span class="sr-only">${escapeHtml(localeTr ? "İşlemler" : "Actions")}</span></th></tr></thead><tbody>${userRows}</tbody></table></div>` : '<div class="empty admin-users-empty" role="status">' + escapeHtml(text("adminNoUsers")) + "</div>"}${adminUsersPagination(page)}</section>`;
}

function adminUsersPagination(page) {
  const size = state.data.userPageSize ?? 20;
  const number = Number(page.number ?? 0);
  const totalPages = Number(page.totalPages ?? 0);
  const total = Number(page.totalElements ?? 0);
  const first = total ? number * size + 1 : 0;
  const last = Math.min((number + 1) * size, total);
  const localeTr = state.locale === "tr";
  const control = (label, target, symbol, disabled) =>
    `<button type="button" class="secondary-button admin-pagination-control" data-page="${target}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || state.busy || state.offline ? "disabled" : ""}>${spin(Boolean(state.busy?.startsWith("users-page") && state.data.userPage === target))}${symbol}</button>`;
  return `<div class="admin-users-pagination" aria-label="${escapeHtml(text("adminUsers"))} pagination"><div class="admin-pagination-summary" aria-live="polite"><strong>${first}–${last}</strong><span> / ${total}</span></div><div class="admin-pagination-controls"><label>${escapeHtml(localeTr ? "Sayfa başına" : "Rows per page")} <select id="admin-user-page-size" aria-label="${escapeHtml(localeTr ? "Sayfa başına" : "Rows per page")}" ${state.busy || state.offline ? "disabled" : ""}>${[10, 20, 50, 100].map((value) => `<option value="${value}" ${size === value ? "selected" : ""}>${value}</option>`).join("")}</select>${spin(state.busy === "users-page-size")}</label>${control(localeTr ? "İlk sayfa" : "First page", 0, "«", number <= 0)}${control(text("adminPrevious"), number - 1, "‹", number <= 0)}<span>${escapeHtml(text("adminPage"))} <strong>${totalPages ? number + 1 : 0}</strong> / ${Math.max(totalPages, 1)}</span>${control(text("adminNext"), number + 1, "›", number + 1 >= totalPages)}${control(localeTr ? "Son sayfa" : "Last page", Math.max(0, totalPages - 1), "»", number + 1 >= totalPages)}</div></div>`;
}

function adminUserActionEmailContent(userId, { closable = true } = {}) {
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
  const canManage = state.data.adminAccess?.manageUsers === true;
  const closeButton = closable
    ? `<button class="secondary-button" type="button" data-action="admin-user-action-email-close" data-id="${escapeHtml(userId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button>`
    : "";
  const title = closable
    ? text("adminSendActionEmail")
    : state.locale === "tr"
      ? "Kimlik bilgisi sıfırlama"
      : "Credential reset";
  const sendLabel = closable
    ? text("adminSendActionEmail")
    : state.locale === "tr"
      ? "E-posta gönder"
      : "Send email";
  return `<section class="card" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(state.locale === "tr" ? "Kullanıcının e-postasına süreli bir işlem bağlantısı gönderin." : "Send a time-limited action link to the user's email address.")}</p><form data-form="admin-user-action-email" data-user-id="${escapeHtml(userId)}" novalidate><div class="field"><label for="admin-user-action-${escapeHtml(userId)}">${escapeHtml(text("adminActionEmailAction"))}</label><select id="admin-user-action-${escapeHtml(userId)}" name="action" required ${canManage ? "" : "disabled"}><option value="UPDATE_PASSWORD" ${action === "UPDATE_PASSWORD" ? "selected" : ""}>${escapeHtml(text("adminUpdatePasswordAction"))}</option><option value="VERIFY_EMAIL" ${action === "VERIFY_EMAIL" ? "selected" : ""}>${escapeHtml(text("adminVerifyEmailAction"))}</option></select></div><div class="field"><label for="admin-user-action-lifespan-${escapeHtml(userId)}">${escapeHtml(text("adminActionEmailLifespan"))}</label><select id="admin-user-action-lifespan-${escapeHtml(userId)}" name="lifespan" required ${canManage ? "" : "disabled"}><option value="1800" ${lifespan === "1800" ? "selected" : ""}>${escapeHtml(text("adminLifespan30Minutes"))}</option><option value="3600" ${lifespan === "3600" ? "selected" : ""}>${escapeHtml(text("adminLifespan1Hour"))}</option><option value="43200" ${lifespan === "43200" ? "selected" : ""}>${escapeHtml(text("adminLifespan12Hours"))}</option><option value="86400" ${lifespan === "86400" ? "selected" : ""}>${escapeHtml(text("adminLifespan24Hours"))}</option></select></div><div class="actions">${button(sendLabel, { type: "submit", icon: "send", busy, disabled: state.offline || !canManage || !adminUserById(userId)?.email })}${closeButton}</div></form></section>`;
}

function adminUserDetailsPanel({
  user,
  id,
  profile,
  profileFields,
  avatar,
  avatarRemove,
  security,
  detailSwitch,
  canManage,
  localeTr,
}) {
  const builtInField = (name, label, value, type, extra = "") => {
    const definition = (profile.definitions ?? []).find(
      (item) => item.name === name,
    );
    const description = definition?.description
      ? `<small class="muted">${escapeHtml(definition.description)}</small>`
      : "";
    return `<div class="field"><label for="admin-user-profile-${name}">${escapeHtml(label)}${name === "username" ? " *" : ""}</label><input id="admin-user-profile-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra} ${canManage ? "" : "disabled"}/>${description}<div class="field-error"></div></div>`;
  };
  const builtInFields = [
    builtInField(
      "username",
      text("adminUsername"),
      user.username,
      "text",
      'maxlength="100" required autocomplete="username"',
    ),
    builtInField(
      "email",
      text("email"),
      user.email ?? "",
      "email",
      'maxlength="200" autocomplete="email"',
    ),
    builtInField(
      "firstName",
      text("firstName"),
      user.firstName ?? "",
      "text",
      'maxlength="100" autocomplete="given-name"',
    ),
    builtInField(
      "lastName",
      text("lastName"),
      user.lastName ?? "",
      "text",
      'maxlength="100" autocomplete="family-name"',
    ),
  ].join("");
  const avatarMarkup = avatar
    ? `<img src="${escapeHtml(avatar)}" alt=""/>`
    : `<span>${escapeHtml(user.username.slice(0, 1).toUpperCase())}</span>`;
  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleString(localeTr ? "tr-TR" : "en-US")
    : "—";
  const updatedAt = user.updatedAt
    ? new Date(user.updatedAt).toLocaleString(localeTr ? "tr-TR" : "en-US")
    : "—";
  return `<form class="admin-user-details-layout" data-form="admin-user-detail-save" data-user-id="${id}" novalidate>
    <section class="card admin-user-detail-overview">
      <div class="admin-user-avatar-row">
        <div class="admin-user-avatar-preview">${avatarMarkup}<div><strong>${escapeHtml(user.username)}</strong><p class="muted">${escapeHtml(localeTr ? "En fazla 2 MiB ve 4 megapiksel JPEG veya PNG. Kitezh veritabanında saklanır." : "JPEG or PNG up to 2 MiB and 4 megapixels. Stored in the Kitezh database.")}</p></div></div>
        <div class="admin-user-avatar-actions"><input class="sr-only" type="file" accept="image/jpeg,image/png" data-admin-avatar-file="${id}" data-admin-avatar-auto="true" aria-label="${escapeHtml(localeTr ? "Avatar yükle" : "Upload avatar")}" ${canManage && !state.busy ? "" : "disabled"}/>${button(localeTr ? "Avatar yükle" : "Upload avatar", { action: "admin-user-avatar-upload", id, icon: "upload", busy: state.busy === `admin-avatar-upload:${id}`, disabled: state.offline || !canManage || Boolean(state.busy) })}${avatarRemove}</div>
      </div>
      ${state.data.adminAvatarErrors?.[id] ? `<p class="field-error" role="alert">${escapeHtml(state.data.adminAvatarErrors[id])}</p>` : ""}
      <div class="admin-user-security-panel"><strong>${escapeHtml(localeTr ? "Hesap güvenliği" : "Account security")}</strong>${security}</div>
      <div class="admin-user-detail-switches">${detailSwitch("emailVerified", text("adminUserEmailVerified"), user.emailVerified)}${detailSwitch("enabled", text("adminEnabled"), user.enabled)}</div>
      <dl class="admin-user-metadata"><div><dt>${escapeHtml(localeTr ? "Oluşturulma zamanı" : "Created")}</dt><dd>${escapeHtml(createdAt)}</dd></div><div><dt>${escapeHtml(localeTr ? "Güncellenme zamanı" : "Updated")}</dt><dd>${escapeHtml(updatedAt)}</dd></div></dl>
    </section>
    <section class="card admin-user-profile-card"><h2>${escapeHtml(localeTr ? "Kullanıcı profil alanları" : "User profile fields")}</h2><p class="muted">${escapeHtml(localeTr ? "Kullanıcı ve hesap formlarında görünecek doğrulamalı profil alanlarını tanımlayın." : "Define validated profile fields shown in user and account forms.")}</p><div class="admin-user-profile-fields">${builtInFields}${profileFields}</div></section>
    <div class="actions admin-user-detail-form-actions"><button type="button" class="secondary-button" data-action="admin-user-detail-back" ${state.busy ? "disabled" : ""}><span class="button-icon" aria-hidden="true">×</span>${escapeHtml(text("cancel"))}</button>${button(text("save"), { type: "submit", icon: "save", busy: state.busy === `user-detail-save:${id}`, disabled: state.offline || !canManage || Boolean(state.busy) })}</div>
  </form>`;
}

function adminUserDetailContent() {
  const user = state.data.adminUserDetail;
  if (!user)
    return (
      '<section class="card" role="status">' +
      escapeHtml(text("adminUsersLoadError")) +
      "</section>"
    );
  const id = Number(user.id);
  const localeTr = state.locale === "tr";
  const access = state.data.adminAccess ?? {};
  const canManage = access.manageUsers === true;
  const activeTab = state.data.adminUserDetailTab ?? "details";
  const tabs = [
    ["details", localeTr ? "Ayrıntılar" : "Details"],
    ["credentials", localeTr ? "Kimlik bilgileri" : "Credentials"],
    ...(access.viewRoles
      ? [["roles", localeTr ? "Rol eşlemeleri" : "Role mappings"]]
      : []),
    ...(access.viewGroups ? [["groups", text("adminGroups")]] : []),
    ...(access.viewSessions ? [["sessions", text("adminSessions")]] : []),
    ...(access.viewConsents
      ? [["consents", localeTr ? "İzinler" : "Consents"]]
      : []),
    ...(access.viewEvents ? [["events", text("adminEvents")]] : []),
  ];
  const profile = state.data.adminUserDetailProfile ?? {
    definitions: [],
    attributes: {},
  };
  const profileFields = (profile.definitions ?? [])
    .filter((definition) => definition.enabled && !definition.builtIn)
    .map((definition) => {
      const name = escapeHtml(definition.name);
      const label = escapeHtml(definition.displayName || definition.name);
      const values = profile.attributes?.[definition.name] ?? [];
      const value = definition.multivalued
        ? values.join("\n")
        : (values[0] ?? "");
      const attrs = `data-profile-attribute="${name}" data-multivalued="${definition.multivalued ? "true" : "false"}" ${canManage ? "" : "disabled"} ${definition.required ? "required" : ""} ${definition.minLength ? `minlength="${Number(definition.minLength)}"` : ""} ${definition.maxLength ? `maxlength="${Number(definition.maxLength)}"` : ""} ${definition.pattern ? `pattern="${escapeHtml(definition.pattern)}"` : ""} ${definition.type === "INTEGER" ? 'step="1"' : ""}`;
      const control =
        definition.type === "BOOLEAN"
          ? `<select name="${name}" ${attrs}><option value="">—</option><option value="true" ${value === "true" ? "selected" : ""}>${escapeHtml(localeTr ? "Evet" : "Yes")}</option><option value="false" ${value === "false" ? "selected" : ""}>${escapeHtml(localeTr ? "Hayır" : "No")}</option></select>`
          : definition.multivalued
            ? `<textarea name="${name}" rows="3" ${attrs}>${escapeHtml(value)}</textarea>`
            : `<input name="${name}" type="${definition.type === "EMAIL" ? "email" : definition.type === "INTEGER" ? "number" : "text"}" value="${escapeHtml(value)}" ${attrs}/>`;
      return `<div class="field"><label>${label}${definition.required ? " *" : ""}</label>${control}${definition.description ? `<small class="muted">${escapeHtml(definition.description)}</small>` : ""}<div class="field-error"></div></div>`;
    })
    .join("");
  const tabsMarkup = tabs
    .map(
      ([key, label]) =>
        `<button type="button" class="admin-user-detail-tab ${activeTab === key ? "is-active" : ""}" data-action="admin-user-detail-tab" data-tab="${escapeHtml(key)}" ${state.busy ? "disabled" : ""}>${spin(state.busy === `user-detail-tab:${key}`)}${escapeHtml(label)}</button>`,
    )
    .join("");
  const avatar = userAvatarSource(user);
  const actions = `<div class="admin-user-detail-actions">${access.manageUsers ? button(localeTr ? "Bu kullanıcı olarak giriş yap" : "Log in as user", { action: "admin-user-detail-impersonate", id, icon: "user", variant: "info", busy: state.busy === `user-detail-impersonate:${id}`, disabled: state.offline || Boolean(state.busy) }) : ""}${canManage ? button(user.enabled ? text("adminDisableUser") : text("adminEnableUser"), { action: "admin-user-detail-toggle-enabled", id, icon: user.enabled ? "disable" : "enable", variant: user.enabled ? "warning" : "success", busy: state.busy === `user-detail-enabled:${id}`, disabled: state.offline || Boolean(state.busy) }) : ""}${canManage ? button(text("adminDeleteUser"), { action: "admin-user-detail-delete", id, icon: "trash", danger: true, busy: state.busy === `user-detail-delete:${id}`, disabled: state.offline || Boolean(state.busy) }) : ""}</div>`;
  const breadcrumb = `<div class="admin-user-detail-breadcrumb"><button type="button" class="text-button" data-action="admin-user-detail-back">${escapeHtml(text("adminUsers"))}</button><span aria-hidden="true">/</span><span>${escapeHtml(user.username)}</span></div>`;
  let panel = "";
  if (activeTab === "details") {
    const security = `${user.locked ? `<p class="notice warning">${escapeHtml(text("adminUserLocked"))}${user.lockedUntil ? ` · ${escapeHtml(new Date(user.lockedUntil).toLocaleString(localeTr ? "tr-TR" : "en-US"))}` : ""} · ${escapeHtml(localeTr ? "Başarısız girişler" : "Failed logins")}: ${Number(user.failedLoginCount ?? 0)}</p>` : `<p class="muted">${escapeHtml(localeTr ? "Kilitli değil" : "Not locked")} · ${escapeHtml(localeTr ? "Başarısız girişler" : "Failed logins")}: ${Number(user.failedLoginCount ?? 0)}</p>`}${user.mustChangePassword || user.temporaryPassword ? `<p class="notice warning">${escapeHtml(localeTr ? "Parola değişikliği gerekiyor" : "Password change required")}</p>` : ""}${user.locked && canManage ? button(text("adminUnlockUser"), { action: "admin-user-detail-unlock", id, icon: "reset", busy: state.busy === `user-detail-unlock:${id}`, disabled: state.offline || Boolean(state.busy) }) : ""}`;
    const avatarRemove =
      state.data.adminAvatarDeleteConfirmId === id
        ? `<div class="notice warning">${escapeHtml(text("adminUserAvatarRemovePrompt"))}<div class="actions">${button(localeTr ? "Avatarı kaldır" : "Remove avatar", { action: "admin-user-avatar-delete-confirm", id, icon: "trash", danger: true, busy: state.busy === `admin-avatar-delete:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-avatar-delete-cancel" data-id="${id}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></div>`
        : avatar
          ? button(localeTr ? "Avatarı kaldır" : "Remove avatar", {
              action: "admin-user-avatar-delete-request",
              id,
              icon: "trash",
              danger: true,
              disabled: state.offline || !canManage || Boolean(state.busy),
            })
          : "";
    const detailSwitch = (name, label, checked) =>
      `<label class="settings-row admin-user-detail-switch"><input type="checkbox" name="${name}" ${checked ? "checked" : ""} ${canManage ? "" : "disabled"}/><span class="admin-user-detail-switch-control" aria-hidden="true"></span><span>${escapeHtml(label)}</span></label>`;
    panel = adminUserDetailsPanel({
      user,
      id,
      profile,
      profileFields,
      avatar,
      avatarRemove,
      security,
      detailSwitch,
      canManage,
      localeTr,
    });
  } else if (activeTab === "credentials") {
    const requiredActions = state.data.adminUserRequiredActions ?? [];
    const requiredActionError = state.data.adminUserDetailRequiredActionsError;
    const requiredMarkup = requiredActions
      .map(
        (action) =>
          `<label class="settings-row admin-user-detail-switch" aria-busy="${state.busy === `user-detail-required-action:${action.key}`}"><input type="checkbox" data-action="admin-user-detail-required-action" data-key="${escapeHtml(action.key)}" ${action.assigned ? "checked" : ""} ${canManage && action.enabled && !action.globalPolicy && !state.busy && !state.offline ? "" : "disabled"}/><span class="admin-user-detail-switch-control" aria-hidden="true"></span><span>${spin(state.busy === `user-detail-required-action:${action.key}`)}${escapeHtml(action.displayName)}</span></label>`,
      )
      .join("");
    const pwDraft = state.data.adminUserDetailPassword ?? { temporary: true };
    const passwordErrors = state.data.adminUserDetailPasswordError
      ? { password: state.data.adminUserDetailPasswordError }
      : violations(state.error?.body);
    const passkeys = adminUserPasskeysContent(id, { detail: true });
    const actionEmail = adminUserActionEmailContent(id, { closable: false });
    const totpConfirm = state.data.adminUserDetailTotpConfirm
      ? `<div class="notice warning"><p>${escapeHtml(text("adminResetAuthenticatorPrompt"))}</p>${button(text("adminResetAuthenticator"), { action: "admin-user-detail-totp-confirm", id, danger: true, busy: state.busy === `user-detail-totp:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-detail-totp-cancel">${escapeHtml(text("cancel"))}</button></div>`
      : "";
    panel = `<div class="admin-user-credentials-grid">
      <form class="card" id="admin-user-detail-password-form" data-form="admin-user-detail-password" data-user-id="${id}" novalidate>
        <h2>${escapeHtml(text("adminResetPassword"))}</h2>
        <p class="muted">${escapeHtml(localeTr ? "Kullanıcı için yeni bir parola belirleyin." : "Set a new password for this user.")}</p>
        ${field("password", text("newPassword"), pwDraft.password ?? "", passwordErrors.password, "password", 'minlength="12" maxlength="128" autocomplete="new-password" ' + (canManage && !state.busy ? "" : "disabled"))}
        <label class="settings-row admin-user-detail-switch"><input type="checkbox" name="temporary" ${pwDraft.temporary !== false ? "checked" : ""} ${canManage ? "" : "disabled"}/><span class="admin-user-detail-switch-control" aria-hidden="true"></span><span>${escapeHtml(localeTr ? "Geçici parola" : "Temporary password")}</span></label>
        <p class="muted">${escapeHtml(text("adminUserTemporaryPasswordHelp"))}</p>
      </form>
      ${passkeys}
      <section class="card admin-user-required-actions-card">
        <h2>${escapeHtml(text("adminRequiredActionsTitle"))}</h2>
        <p class="muted">${escapeHtml(localeTr ? "Kullanıcının girişte tamamlaması gereken işlemleri seçin." : "Select the actions the user must complete at sign-in.")}</p>
        ${requiredActionError ? `<div class="notice error" role="alert"><p>${escapeHtml(text("adminRequiredActionsLoadError"))}</p>${button(text("adminRequiredActionsRetry"), { action: "admin-user-detail-required-actions-retry", busy: state.busy === "user-detail-required-actions-retry", disabled: state.offline || Boolean(state.busy) })}</div>` : requiredMarkup || `<div class="empty">${escapeHtml(localeTr ? "Zorunlu işlem tanımlanmamış." : "No required actions are configured.")}</div>`}
        ${state.data.adminUserDetailRequiredActionMutationError ? `<p class="notice error" role="alert">${escapeHtml(text("adminRequiredActionUpdateError"))}</p>` : ""}
      </section>
      ${actionEmail}
      <section class="card">
        <h2>${escapeHtml(localeTr ? "Doğrulayıcıyı sıfırla" : "Reset authenticator")}</h2>
        <p class="muted">${escapeHtml(localeTr ? "Kullanıcının mevcut OTP kurulumunu kaldırır. Yeni bir doğrulayıcı kurması gerekir." : "Removes the user's current OTP setup. They will need to set it up again.")}</p>
        ${button(localeTr ? "Doğrulayıcıyı sıfırla" : "Reset authenticator", { action: "admin-user-detail-totp-request", id, icon: "trash", danger: true, disabled: state.offline || !canManage || !user.totpEnabled || Boolean(state.busy) || Boolean(state.data.adminUserDetailTotpConfirm) })}
        ${totpConfirm}
      </section>
      <div class="actions admin-user-detail-form-actions"><button class="secondary-button" type="button" data-action="admin-user-detail-back" ${state.busy ? "disabled" : ""}><span class="button-icon" aria-hidden="true">×</span>${escapeHtml(text("cancel"))}</button>${button(text("save"), { type: "submit", form: "admin-user-detail-password-form", icon: "save", busy: state.busy === `user-detail-password:${id}`, disabled: state.offline || !canManage || Boolean(state.busy) })}</div>
    </div>`;
  } else if (activeTab === "roles") {
    const catalog = state.data.adminUserDetailRoles ?? [];
    const assigned = new Set(user.assignedRoles ?? user.authorities ?? []);
    const roles = catalog
      .map(
        (role) =>
          `<label class="admin-role-option ${assigned.has(role.name) ? "selected" : ""}"><input type="checkbox" name="roles" value="${escapeHtml(role.name)}" ${assigned.has(role.name) ? "checked" : ""} ${canManage && !state.busy ? "" : "disabled"}/><span>${escapeHtml(role.name)}</span></label>`,
      )
      .join("");
    const mappings = (user.groupMappings ?? [])
      .map(
        (group) =>
          `<article class="admin-user-role-source"><strong>${escapeHtml(group.groupPath)}</strong><div class="admin-user-roles">${(group.roles ?? []).map((role) => `<span class="admin-user-role">${escapeHtml(role)}</span>`).join("")}</div></article>`,
      )
      .join("");
    const pills = (items, variant = "") =>
      (items ?? [])
        .map(
          (role) =>
            `<span class="admin-user-role ${variant}">${escapeHtml(role)}</span>`,
        )
        .join("");
    const inheritedRoles = user.inheritedRoles ?? [];
    const effectiveRoles = user.effectiveRoles ?? user.authorities ?? [];
    panel = `<form class="card" data-form="admin-user-detail-roles" data-user-id="${id}" novalidate><h2>${escapeHtml(text("adminRoles"))}</h2><p class="muted">${escapeHtml(localeTr ? "Bu kullanıcıya doğrudan atanmış roller." : "Roles assigned directly to this user.")}</p><div class="admin-role-grid">${roles}</div><p class="admin-role-help">${escapeHtml(localeTr ? "Bir veya daha fazla rol seçin." : "Select one or more roles.")}</p><div class="field-error admin-user-role-error">${escapeHtml(state.data.adminUserDetailRoleError ?? "")}</div><section class="admin-user-role-summary"><h3>${escapeHtml(localeTr ? "Gruplardan miras alınan roller" : "Roles inherited from groups")}</h3>${mappings || `<p class="muted">${escapeHtml(localeTr ? "Gruplardan miras alınan rol yok." : "No roles are inherited from groups.")}</p>`}<h3>${escapeHtml(localeTr ? "Miras alınan roller" : "Inherited roles")}</h3>${inheritedRoles.length ? `<div class="admin-user-roles">${pills(inheritedRoles)}</div>` : `<p class="muted">${escapeHtml(localeTr ? "Doğrudan atanmadan miras alınan rol yok." : "No roles are inherited without a direct assignment.")}</p>`}<h3>${escapeHtml(localeTr ? "Etkin roller" : "Effective roles")}</h3><div class="admin-user-roles">${pills(effectiveRoles, "is-primary")}</div></section><div class="actions admin-user-role-actions"><button class="secondary-button" type="button" data-action="admin-user-detail-back" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button>${button(text("save"), { type: "submit", busy: state.busy === `user-detail-roles:${id}`, disabled: state.offline || !canManage || Boolean(state.busy) })}</div></form>`;
  } else if (activeTab === "groups") {
    const page = state.data.adminUserDetailGroups ?? { content: [] };
    const memberships = Array.isArray(page.content) ? page.content : [];
    const selectedGroup = state.data.adminUserDetailGroupSelection ?? "";
    const groupQuery = state.data.adminUserDetailGroupQuery ?? "";
    const options = (state.data.adminUserDetailGroupOptions ?? []).filter(
      (group) =>
        !memberships.some((item) => Number(item.id) === Number(group.id)),
    );
    const groupSearch = canManage
      ? `<div class="admin-user-group-search"><label class="field" for="admin-user-detail-group-search"><span class="sr-only">${escapeHtml(localeTr ? "Gruplarda ara" : "Search groups")}</span><input id="admin-user-detail-group-search" type="search" list="admin-user-detail-group-options" value="${escapeHtml(groupQuery)}" placeholder="${escapeHtml(localeTr ? "Gruplarda ara" : "Search groups")}" aria-label="${escapeHtml(localeTr ? "Gruplarda ara" : "Search groups")}" maxlength="200" autocomplete="off"/></label><datalist id="admin-user-detail-group-options">${options.map((group) => `<option value="${escapeHtml(group.path ?? group.name)}"></option>`).join("")}</datalist>${button(localeTr ? "Gruba ekle" : "Add to group", { action: "admin-user-detail-add-group", id, icon: "add", disabled: state.offline || Boolean(state.busy) || !selectedGroup })}</div>`
      : "";
    const groupRows = memberships
      .map(
        (group) =>
          `<tr><td><strong>${escapeHtml(group.name ?? group.path)}</strong></td><td><div class="admin-user-roles">${(group.roles ?? []).map((role) => `<span class="admin-user-role">${escapeHtml(role)}</span>`).join("") || "—"}</div></td>${canManage ? `<td class="admin-user-group-action-cell">${button(localeTr ? "Gruptan çıkar" : "Remove from group", { action: "admin-user-detail-remove-group", id: group.id, child: id, danger: true, disabled: state.offline || Boolean(state.busy) })}</td>` : ""}</tr>`,
      )
      .join("");
    panel = `<div class="admin-user-related-layout"><section class="card admin-user-group-editor"><h2>${escapeHtml(localeTr ? "Grup üyelikleri" : "Group memberships")}</h2><p class="muted">${escapeHtml(localeTr ? "Grup, eşlenmiş rollerini tüm üyelerine verir." : "Groups grant their mapped roles to every member.")}</p>${groupSearch}</section><section class="card admin-user-related-card">${memberships.length ? `<div class="admin-users-table-wrap admin-user-group-table-wrap"><table class="admin-users-table admin-user-detail-data-table admin-user-group-table ${canManage ? "is-manageable" : "is-readonly"}"><thead><tr><th>${escapeHtml(localeTr ? "Grup adı" : "Group name")}</th><th>${escapeHtml(localeTr ? "Rol eşlemeleri" : "Role mappings")}</th>${canManage ? '<th><span class="sr-only">' + escapeHtml(localeTr ? "İşlemler" : "Actions") + "</span></th>" : ""}</tr></thead><tbody>${groupRows}</tbody></table></div>` : `<div class="empty">${escapeHtml(localeTr ? "Kayıt bulunamadı." : "No records found.")}</div>`}</section></div>`;
  } else if (activeTab === "sessions") {
    const page = state.data.adminUserDetailSessions ?? {
      content: [],
      number: 0,
      totalPages: 0,
    };
    const sessions = page.content ?? [];
    const rows = sessions
      .map(
        (session) =>
          `<tr><td>${escapeHtml(session.username || user.username || "—")}</td><td>${escapeHtml(session.createdAt ? new Date(session.createdAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</td><td>${escapeHtml(session.lastAccessedAt ? new Date(session.lastAccessedAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</td><td>${escapeHtml(session.expiresAt ? new Date(session.expiresAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</td><td>${Number(session.authorizationCount ?? 0)}</td>${access.manageSessions ? `<td class="admin-user-session-action">${state.data.adminUserDetailPendingSession === session.id ? `<div class="actions">${button(localeTr ? "Oturumu kapat" : "Sign out session", { action: "admin-user-detail-revoke-session-confirm", danger: true, busy: state.busy === `user-detail-session:${session.id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-detail-revoke-session-cancel">${escapeHtml(text("cancel"))}</button></div>` : button(localeTr ? "Oturumu kapat" : "Sign out session", { action: "admin-user-detail-revoke-session", id: session.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</td>` : ""}</tr>`,
      )
      .join("");
    const revokeAll = access.manageSessions
      ? state.data.adminUserDetailPendingRevokeAll
        ? `<div class="actions">${button(localeTr ? "Tüm oturumları kapat" : "Sign out all sessions", { action: "admin-user-detail-revoke-all-sessions-confirm", id, icon: "logout", danger: true, busy: state.busy === `user-detail-all-sessions:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-detail-revoke-all-sessions-cancel">${escapeHtml(text("cancel"))}</button></div>`
        : button(localeTr ? "Tüm oturumları kapat" : "Sign out all sessions", {
            action: "admin-user-detail-revoke-all-sessions",
            id,
            icon: "logout",
            danger: true,
            disabled: state.offline || Boolean(state.busy),
          })
      : "";
    panel = `<div class="admin-user-related-layout">${revokeAll ? `<div class="admin-user-related-actions">${revokeAll}</div>` : ""}<section class="card admin-user-related-card">${sessions.length ? `<div class="admin-users-table-wrap admin-user-session-table-wrap"><table class="admin-users-table admin-user-detail-data-table admin-user-session-table ${access.manageSessions ? "is-manageable" : "is-readonly"}"><thead><tr><th>${escapeHtml(localeTr ? "Kullanıcı" : "User")}</th><th>${escapeHtml(localeTr ? "Oluşturulma" : "Created")}</th><th>${escapeHtml(localeTr ? "Son etkinlik" : "Last active")}</th><th>${escapeHtml(localeTr ? "Bitiş" : "Expires")}</th><th>${escapeHtml(localeTr ? "Yetkilendirmeler" : "Authorizations")}</th>${access.manageSessions ? '<th><span class="sr-only">' + escapeHtml(localeTr ? "İşlemler" : "Actions") + "</span></th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty" role="status">${escapeHtml(localeTr ? "Kayıt bulunamadı." : "No records found.")}</div>`}${detailPagination(page, "sessions")}</section></div>`;
  } else if (activeTab === "consents") {
    const page = state.data.adminUserDetailConsents ?? {
      content: [],
      number: 0,
      totalPages: 0,
    };
    const rows = (page.content ?? [])
      .map(
        (consent) =>
          `<tr><td>${escapeHtml(user.username)}</td><td><strong>${escapeHtml(consent.clientName || consent.clientId)}</strong><div class="muted">${escapeHtml(consent.clientId)}</div></td><td>${escapeHtml((consent.authorities ?? []).join(", ") || "—")}</td><td><div class="actions"><button class="secondary-button" type="button" data-action="admin-user-detail-consent-details" data-id="${escapeHtml(consent.clientId)}">${escapeHtml(localeTr ? "Ayrıntılar" : "Details")}</button>${access.manageConsents ? (state.data.adminUserDetailPendingConsent?.clientId === consent.clientId ? `${button(localeTr ? "İzni kaldır" : "Revoke consent", { action: "admin-user-detail-revoke-consent-confirm", danger: true, busy: state.busy === `user-detail-consent:${consent.clientId}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-detail-revoke-consent-cancel">${escapeHtml(text("cancel"))}</button>` : button(localeTr ? "İzni kaldır" : "Revoke consent", { action: "admin-user-detail-revoke-consent", id: consent.clientId, child: consent.principalName, danger: true, disabled: state.offline || Boolean(state.busy) })) : ""}</div></td></tr>${state.data.adminUserDetailConsentOpenId === consent.clientId ? `<tr class="admin-user-detail-expand-row"><td colspan="4"><dl><dt>${escapeHtml(localeTr ? "Kullanıcı" : "User")}</dt><dd>${escapeHtml(consent.principalName || user.username)}</dd><dt>${escapeHtml(localeTr ? "İzin oluşturulma" : "Granted")}</dt><dd>${escapeHtml(consent.createdAt ? new Date(consent.createdAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</dd><dt>${escapeHtml(localeTr ? "Son güncelleme" : "Last updated")}</dt><dd>${escapeHtml(consent.updatedAt ? new Date(consent.updatedAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</dd><dt>${escapeHtml(localeTr ? "İzinler" : "Scopes")}</dt><dd>${escapeHtml((consent.authorities ?? []).join(", ") || "—")}</dd></dl></td></tr>` : ""}`,
      )
      .join("");
    panel = `<section class="card admin-user-related-card">${rows ? `<div class="admin-users-table-wrap"><table class="admin-users-table admin-user-detail-data-table"><thead><tr><th>${escapeHtml(localeTr ? "Kullanıcı" : "User")}</th><th>${escapeHtml(localeTr ? "İstemci" : "Client")}</th><th>${escapeHtml(localeTr ? "İzin verilen kapsamlar" : "Granted scopes")}</th><th>${escapeHtml(localeTr ? "İşlemler" : "Actions")}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${escapeHtml(localeTr ? "Kayıt bulunamadı." : "No records found.")}</div>`}${detailPagination(page, "consents")}</section>`;
  } else if (activeTab === "events") {
    const page = state.data.adminUserDetailEvents ?? {
      content: [],
      number: 0,
      totalPages: 0,
    };
    const rows = (page.content ?? [])
      .map(
        (event) =>
          `<tr><td>${escapeHtml(event.occurredAt ? new Date(event.occurredAt).toLocaleString(localeTr ? "tr-TR" : "en-US") : "—")}</td><td><strong>${escapeHtml(event.action)}</strong>${event.details ? `<div class="muted">${escapeHtml(event.details)}</div>` : ""}</td><td>${escapeHtml(event.actor)}</td><td>${escapeHtml(`${event.targetType ?? ""} ${event.targetId ?? ""}`.trim())}</td></tr>`,
      )
      .join("");
    panel = `<section class="card admin-user-related-card">${rows ? `<div class="admin-users-table-wrap"><table class="admin-users-table admin-user-detail-data-table"><thead><tr><th>${escapeHtml(localeTr ? "Zaman" : "Time")}</th><th>${escapeHtml(localeTr ? "İşlem" : "Action")}</th><th>${escapeHtml(localeTr ? "Gerçekleştiren" : "Actor")}</th><th>${escapeHtml(localeTr ? "Hedef" : "Target")}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${escapeHtml(localeTr ? "Kayıt bulunamadı." : "No records found.")}</div>`}${detailPagination(page, "events")}</section>`;
  }
  return `<section class="admin-user-detail">${breadcrumb}<div class="admin-user-detail-heading"><div><h2>${escapeHtml(user.username)}</h2><span class="muted">${escapeHtml(localeTr ? "Kullanıcı" : "User")}</span></div><div class="admin-user-detail-status">${actions}</div></div>${deleteConfirmMarkup(user, id)}<nav class="admin-user-detail-tabs" aria-label="${escapeHtml(localeTr ? "Kullanıcı ayrıntı bölümleri" : "User detail sections")}">${tabsMarkup}</nav>${panel}</section>`;
}

function detailPagination(page, tab) {
  const number = Number(page.number ?? 0);
  const totalPages = Number(page.totalPages ?? 0);
  const size = state.data.adminUserDetailPageSizes?.[tab] ?? 10;
  if (totalPages <= 0) return "";
  const localeTr = state.locale === "tr";
  const totalElements = Number(page.totalElements ?? 0);
  const safePage = Math.max(0, Math.min(number, Math.max(totalPages - 1, 0)));
  const first = totalElements === 0 ? 0 : safePage * size + 1;
  const last = Math.min((safePage + 1) * size, totalElements);
  const firstLabel = localeTr ? "İlk sayfa" : "First page";
  const previousLabel = text("adminPrevious");
  const nextLabel = text("adminNext");
  const lastLabel = localeTr ? "Son sayfa" : "Last page";
  return `<div class="admin-users-pagination" aria-label="${escapeHtml(text("adminUsers"))} pagination"><div class="admin-pagination-summary" aria-live="polite"><strong>${first}–${last}</strong><span> / ${totalElements}</span></div><div class="admin-pagination-controls"><label>${escapeHtml(localeTr ? "Sayfa başına" : "Rows per page")} <select data-action="admin-user-detail-page-size" data-tab="${tab}" aria-label="${escapeHtml(localeTr ? "Sayfa başına" : "Rows per page")}" ${state.busy ? "disabled" : ""}>${[10, 20, 50, 100].map((value) => `<option value="${value}" ${size === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><button type="button" class="secondary-button admin-pagination-control" data-action="admin-user-detail-page" data-tab="${tab}" data-page="0" aria-label="${escapeHtml(firstLabel)}" title="${escapeHtml(firstLabel)}" ${safePage <= 0 || state.busy ? "disabled" : ""}>«</button><button type="button" class="secondary-button admin-pagination-control" data-action="admin-user-detail-page" data-tab="${tab}" data-page="${safePage - 1}" aria-label="${escapeHtml(previousLabel)}" title="${escapeHtml(previousLabel)}" ${safePage <= 0 || state.busy ? "disabled" : ""}>‹</button><span>${escapeHtml(text("adminPage"))} <strong>${Math.min(safePage + 1, totalPages)}</strong> / ${Math.max(totalPages, 1)}</span><button type="button" class="secondary-button admin-pagination-control" data-action="admin-user-detail-page" data-tab="${tab}" data-page="${safePage + 1}" aria-label="${escapeHtml(nextLabel)}" title="${escapeHtml(nextLabel)}" ${safePage + 1 >= totalPages || state.busy ? "disabled" : ""}>›</button><button type="button" class="secondary-button admin-pagination-control" data-action="admin-user-detail-page" data-tab="${tab}" data-page="${totalPages - 1}" aria-label="${escapeHtml(lastLabel)}" title="${escapeHtml(lastLabel)}" ${safePage + 1 >= totalPages || state.busy ? "disabled" : ""}>»</button></div></div>`;
}

function deleteConfirmMarkup(user, id) {
  if (!state.data.adminUserDetailDeleteConfirm) return "";
  return `<div class="notice warning"><p>${escapeHtml(text("adminDeleteUserPrompt"))} ${escapeHtml(user.username)}</p><div class="actions">${button(text("adminDeleteUser"), { action: "admin-user-detail-delete-confirm", id, danger: true, busy: state.busy === `user-detail-delete:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-detail-delete-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></div>`;
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
            : chooseLazy(
                definition.type === "INTEGER",
                () => "number",
                () => "text",
              );
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
  return `<section class="card" aria-label="${escapeHtml(text("adminProfileAttributes"))}"><form data-form="admin-user-profile-attributes" data-user-id="${escapeHtml(userId)}" novalidate><div class="form-grid">${fields || '<div class="empty" role="status">' + escapeHtml(text("adminNoProfileAttributes")) + "</div>"}</div><p class="muted">${escapeHtml(text("adminProfileAttributesHelp"))}</p><div class="actions">${button(text("save"), { type: "submit", busy: saveBusy, disabled: state.offline || definitions.length === 0 })}<button class="secondary-button" type="button" data-action="admin-user-profile-attributes-close" data-id="${escapeHtml(userId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function adminUserAvatarContent(user) {
  const userId = Number(user.id);
  const source = userAvatarSource(user);
  const error = state.data.adminAvatarErrors?.[userId];
  const confirming = Number(state.data.adminAvatarDeleteConfirmId) === userId;
  const uploadBusy = state.busy === `admin-avatar-upload:${userId}`;
  const deleteBusy = state.busy === `admin-avatar-delete:${userId}`;
  const deleteControl = source
    ? chooseLazy(
        confirming,
        () =>
          `<div class="actions"><span role="status">${escapeHtml(text("adminUserAvatarRemovePrompt"))}</span>${button(text("adminUserAvatarRemove"), { action: "admin-user-avatar-delete-confirm", id: userId, danger: true, busy: deleteBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-avatar-delete-cancel" data-id="${userId}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`,
        () =>
          button(text("adminUserAvatarRemove"), {
            action: "admin-user-avatar-delete-request",
            id: userId,
            disabled: state.offline || Boolean(state.busy),
          }),
      )
    : "";
  return `<section class="card" aria-label="${escapeHtml(text("adminUserAvatar"))}">${source ? '<img class="admin-user-avatar" src="' + escapeHtml(source) + '" alt="' + escapeHtml(text("adminUserAvatar")) + '"/>' : "<p>" + escapeHtml(text("adminUserAvatarEmpty")) + "</p>"}<label class="field" for="admin-user-avatar-file-${userId}">${escapeHtml(text("adminUserAvatar"))}<input id="admin-user-avatar-file-${userId}" type="file" accept="image/jpeg,image/png" data-admin-avatar-file="${userId}" ${state.offline || state.busy ? "disabled" : ""}/></label><p class="muted">${escapeHtml(text("adminUserAvatarHelp"))}</p>${error ? '<p class="field-error" role="alert">' + escapeHtml(error) + "</p>" : ""}<div class="actions">${button(text("adminUserAvatarUpload"), { action: "admin-user-avatar-upload", id: userId, busy: uploadBusy, disabled: state.offline })}${deleteControl}<button class="secondary-button" type="button" data-action="admin-user-avatar-close" data-id="${userId}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></section>`;
}

function adminUserPasskeysContent(userId, { detail = false } = {}) {
  const canManage = state.data.adminAccess?.manageUsers === true;
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
        ? `<form class="card" data-form="admin-user-passkey-rename" data-user-id="${escapeHtml(userId)}" data-passkey-index="${index}" novalidate><div class="field"><label for="${labelId}">${escapeHtml(text("adminPasskeyLabel"))}</label><input id="${labelId}" name="label" type="text" value="${escapeHtml(draft ?? passkey.label)}" maxlength="100" aria-invalid="${Boolean(errors.label)}" required/><div class="field-error">${escapeHtml(errors.label ?? "")}</div></div><div class="actions">${button(text("adminRenamePasskey"), { type: "submit", busy: renameBusy, disabled: state.offline })}<button class="secondary-button" type="button" data-action="admin-user-passkey-rename-cancel" data-id="${escapeHtml(userId)}" data-index="${index}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const deleteControls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeletePasskeyPrompt"))}</span>${button(text("adminDeletePasskey"), { action: "admin-user-passkey-delete-confirm", id: userId, index, danger: true, busy: deleteBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-user-passkey-delete-cancel" data-id="${escapeHtml(userId)}" data-index="${index}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : button(text("adminDeletePasskey"), {
            action: "admin-user-passkey-delete-request",
            id: userId,
            index,
            danger: true,
            disabled: state.offline || Boolean(state.busy),
          });
      const createdAt = passkey.createdAt
        ? new Date(passkey.createdAt).toLocaleString(
            state.locale === "tr" ? "tr-TR" : "en-US",
          )
        : "—";
      const lastUsedAt = passkey.lastUsedAt
        ? new Date(passkey.lastUsedAt).toLocaleString(
            state.locale === "tr" ? "tr-TR" : "en-US",
          )
        : "—";
      const technicalDetails =
        passkey.signatureCount !== undefined
          ? `<div class="muted">${escapeHtml(passkey.credentialType ?? "")}${passkey.credentialType ? " · " : ""}${escapeHtml(text("adminPasskeySignatureCount"))}: ${Number(passkey.signatureCount)} · ${escapeHtml(text("adminPasskeyUserVerification"))}: ${escapeHtml(passkey.uvInitialized ? text("adminYes") : text("adminNo"))}</div>`
          : "";
      return `<article class="list-item admin-user-passkey-item" data-passkey-index="${index}"><div><strong>${escapeHtml(passkey.label || text("adminUnnamedPasskey"))}</strong><div class="muted">${escapeHtml(text("adminPasskeyCreated"))}: ${escapeHtml(createdAt)}</div><div class="muted">${escapeHtml(text("adminPasskeyLastUsed"))}: ${escapeHtml(lastUsedAt)}</div>${technicalDetails}</div>${canManage ? `<div class="actions"><button class="secondary-button" type="button" data-action="admin-user-passkey-rename-toggle" data-id="${escapeHtml(userId)}" data-index="${index}" ${state.offline || state.busy ? "disabled" : ""}>${escapeHtml(text("adminRenamePasskey"))}</button>${deleteControls}</div>${renameForm}` : ""}</article>`;
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
  const loadError = state.data.adminUserPasskeyLoadErrors?.[userId];
  const title = detail
    ? state.locale === "tr"
      ? "Geçiş anahtarları"
      : "Passkeys"
    : text("adminManagePasskeys");
  return `<section class="card admin-user-passkeys-card" aria-label="${escapeHtml(title)}"><div><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(text("adminPasskeysHelp"))}</p></div>${loadError ? `<p class="notice error" role="alert">${escapeHtml(text("adminUserActionError"))}</p>` : ""}${rows ? '<div class="list">' + rows + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("adminNoPasskeys")) + "</div>"}${totalPages > 1 ? '<div class="actions" aria-label="' + escapeHtml(title) + ' pagination">' + previousPage + "<span>" + escapeHtml(text("adminPage")) + " " + (pageNumber + 1) + " / " + totalPages + "</span>" + nextPage + "</div>" : ""}</section>`;
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
              : chooseLazy(
                  definition.type === "INTEGER",
                  () => "number",
                  () => "text",
                );
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
    return `<section class="card" aria-label="${escapeHtml(text("adminProfileAttributes"))}"><p role="status">${escapeHtml(text("adminUserCreatedProfileSaveFailed"))}</p><form data-form="admin-user-create" data-created-user-id="${createdUserId}" novalidate><div class="form-grid">${fields || '<div class="empty" role="status">' + escapeHtml(text("adminNoProfileAttributes")) + "</div>"}</div><p class="muted">${escapeHtml(text("adminProfileAttributesHelp"))}</p><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "user-create-profile-save", disabled: state.offline || definitions.length === 0 })}</div></form></section>`;
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
          : chooseLazy(
              definition.type === "INTEGER",
              () => "number",
              () => "text",
            );
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
  return `<section class="card"><form data-form="admin-user-create" novalidate><div class="form-grid">${field("username", text("username"), draft.username ?? "", errors.username, "text", 'maxlength="100" autocomplete="username" required')}${field("firstName", text("firstName"), draft.firstName ?? "", errors.firstName, "text", 'maxlength="100" autocomplete="given-name"')}${field("lastName", text("lastName"), draft.lastName ?? "", errors.lastName, "text", 'maxlength="100" autocomplete="family-name"')}${field("email", text("email"), draft.email ?? "", errors.email, "email", 'maxlength="200" autocomplete="email"')}${field("password", text("newPassword"), "", errors.password, "password", 'minlength="12" maxlength="128" autocomplete="new-password" required')}${profileFields}</div><label class="settings-row"><input type="checkbox" name="temporary" ${draft.temporary ? "checked" : ""}/>${escapeHtml(text("adminUserTemporaryPassword"))}</label><label class="settings-row"><input type="checkbox" name="emailVerified" ${draft.emailVerified ? "checked" : ""}/>${escapeHtml(text("adminUserEmailVerified"))}</label><label class="settings-row"><input type="checkbox" name="enabled" ${draft.enabled !== false ? "checked" : ""}/>${escapeHtml(text("adminEnabled"))}</label><fieldset class="field"><legend>${escapeHtml(text("adminRoles"))}</legend>${
    roles.length
      ? roles
          .map(
            (role) =>
              '<label class="settings-row"><input type="checkbox" name="roles" value="' +
              escapeHtml(role.name) +
              '" ' +
              chooseLazy(
                selectedRoles.includes(role.name),
                () => "checked",
                () => "",
              ) +
              "/>" +
              escapeHtml(role.name) +
              "</label>",
          )
          .join("")
      : '<div class="empty" role="status">' +
        escapeHtml(text("adminNoRoles")) +
        "</div>"
  }<div class="field-error" id="roles-error">${escapeHtml(errors.roles ?? "")}</div></fieldset><div class="actions">${button(text("adminCreateUser"), { type: "submit", busy: state.busy === "user-create", disabled: state.offline || roles.length === 0 || !state.data.userCreateProfileDefinitionsLoaded })}</div></form></section>`;
}

const roleScreens = createRoleScreens({
  state,
  text,
  escapeHtml,
  button,
  spin,
  violations,
  render,
  request,
  loadRoute,
  action,
});
const groupScreens = createGroupScreens({
  state,
  text,
  escapeHtml,
  button,
  icon: actionIcon,
  spin,
  violations,
  render,
  request,
  loadRoute,
  action,
});
const organizationScreens = createOrganizationScreens({
  state,
  text,
  escapeHtml,
  button,
  icon: actionIcon,
  spin,
  violations,
  render,
  request,
  loadRoute,
});
const adminRolesContent = () => roleScreens.list();
const adminRoleCreateContent = () => roleScreens.create();
const adminRoleCompositionPanel = (name, composition) =>
  roleScreens.compositionPanel(name, composition);

function clientScopeRoleOptions(scopeId, kind) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  const candidatesKey =
    kind === "applicationRoles"
      ? "applicationRoleCandidates"
      : "clientRoleCandidates";
  const candidates = mapping?.[candidatesKey]?.content ?? [];
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

function clientScopeRoleMappingPanel(scopeId, readOnly = false) {
  const mapping = state.data.adminClientScopeRoleMappings?.[scopeId];
  if (!mapping) return "";
  const applicationRoleDraft = mapping.draft?.applicationRoles ?? [];
  const clientRoleDraft = (mapping.draft?.clientRoleIds ?? []).map(String);
  const applicationRoles = clientScopeRoleOptions(scopeId, "applicationRoles");
  const clientRoles = clientScopeRoleOptions(scopeId, "clientRoleIds");
  const applicationOptions = applicationRoles
    .map(
      (role) =>
        `<option value="${escapeHtml(role.name)}" ${applicationRoleDraft.includes(role.name) ? "selected" : ""}>${escapeHtml(role.name)}${role.description ? ` — ${escapeHtml(role.description)}` : ""}</option>`,
    )
    .join("");
  const clientOptions = clientRoles
    .map(
      (role) =>
        `<option value="${escapeHtml(role.id)}" ${clientRoleDraft.includes(String(role.id)) ? "selected" : ""}>${escapeHtml(role.clientId)} / ${escapeHtml(role.name)}</option>`,
    )
    .join("");
  return `<section class="card scope-section" data-client-scope-role-mappings-panel="true" data-scope-id="${escapeHtml(scopeId)}"><div class="admin-detail-heading"><h2>${escapeHtml(text("adminClientScopeRoleMappings"))}</h2></div><p class="muted">${escapeHtml(text("adminClientScopeRoleMappingsHelp"))}</p><div class="scope-role-mappings-form"><label class="scope-role-field" for="client-scope-application-roles-${escapeHtml(scopeId)}"><span>${escapeHtml(text("adminApplicationRoles"))}</span><select class="scope-role-select" id="client-scope-application-roles-${escapeHtml(scopeId)}" name="applicationRoles" aria-label="${escapeHtml(text("adminApplicationRoles"))}" multiple size="5" ${readOnly ? "disabled" : ""}>${applicationOptions}</select></label><label class="scope-role-field" for="client-scope-client-roles-${escapeHtml(scopeId)}"><span>${escapeHtml(text("adminClientRoles"))}</span><select class="scope-role-select" id="client-scope-client-roles-${escapeHtml(scopeId)}" name="clientRoleIds" aria-label="${escapeHtml(text("adminClientRoles"))}" multiple size="5" ${readOnly ? "disabled" : ""}>${clientOptions}</select></label><div class="scope-role-actions">${readOnly ? "" : `${button(text("save"), { action: "admin-client-scope-role-mappings-save", id: scopeId, icon: "save", busy: state.busy === `client-scope-role-mappings-save:${scopeId}`, disabled: state.offline || Boolean(state.busy) })}${button(text("cancel"), { action: "admin-client-scope-role-mappings-cancel", id: scopeId, variant: "secondary", disabled: Boolean(state.busy) })}`}</div></div></section>`;
}

function clientScopeMappersPanel(scopeId, readOnly = false) {
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
    !readOnly && editor?.scopeId === scopeId
      ? `<form class="card" data-form="admin-client-scope-mapper" data-scope-id="${escapeHtml(scopeId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(
          text(
            chooseLazy(
              mapperId,
              () => "adminEditClientScopeMapper",
              () => "adminCreateClientScopeMapper",
            ),
          ),
        )}</h3>${field("name", text("adminClientScopeMapperName"), draft.name ?? mapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("source", text("adminClientScopeMapperSource"), draft.source ?? mapper?.source ?? "", errors.source, "text", 'maxlength="200"')}<div class="field"><label for="client-scope-mapper-type">${escapeHtml(text("adminClientScopeMapperType"))}</label><select id="client-scope-mapper-type" name="mapperType">${options
          .map(
            (option) =>
              '<option value="' +
              option +
              '" ' +
              chooseLazy(
                (draft.mapperType ?? mapper?.mapperType ?? "email") === option,
                () => "selected",
                () => "",
              ) +
              ">" +
              option +
              "</option>",
          )
          .join(
            "",
          )}</select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div>${field("claimName", text("adminClientScopeMapperClaim"), draft.claimName ?? mapper?.claimName ?? "email", errors.claimName, "text", 'maxlength="200"')}${field("value", text("adminClientScopeMapperValue"), draft.value ?? mapper?.value ?? "", errors.value, "text", 'maxlength="1000"')}${field("priority", text("adminClientScopeMapperPriority"), draft.priority ?? mapper?.priority ?? 100, errors.priority, "number", 'min="0" max="10000" step="1"')}<label class="settings-row"><input type="checkbox" name="addToIdToken" ${chooseLazy(
          draft.addToIdToken ?? mapper?.addToIdToken ?? true,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${chooseLazy(
          draft.addToAccessToken ?? mapper?.addToAccessToken ?? true,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", icon: "save", busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-mapper-editor-cancel" data-id="${escapeHtml(scopeId)}" ${chooseLazy(
          state.busy,
          () => "disabled",
          () => "",
        )}>${escapeHtml(text("cancel"))}</button></div></form>`
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
          const controls = readOnly
            ? ""
            : chooseLazy(
                confirming,
                () =>
                  `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientScopeMapperPrompt"))}</span>${button(text("adminDeleteClientScopeMapper"), { action: "admin-client-scope-mapper-delete-confirm", id: scopeId, mapper: item.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-mapper-delete-cancel" data-id="${escapeHtml(scopeId)}" data-mapper="${escapeHtml(item.id)}" ${chooseLazy(
                    state.busy,
                    () => "disabled",
                    () => "",
                  )}>${escapeHtml(text("cancel"))}</button></div>`,
                () =>
                  `<div class="actions">${button(text("adminEditClientScopeMapper"), { action: "admin-client-scope-mapper-edit", id: scopeId, mapper: item.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteClientScopeMapper"), { action: "admin-client-scope-mapper-delete-request", id: scopeId, mapper: item.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`,
              );
          return `<article class="list-item" data-client-scope-mapper-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span class="muted">${escapeHtml("" + item.mapperType + " · " + item.claimName + "")}</span></div><span>${escapeHtml(
            text(
              [
                item.addToIdToken ? text("adminMapperAddToIdToken") : "",
                item.addToAccessToken
                  ? text("adminMapperAddToAccessToken")
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          )}</span>${controls}</article>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopeMappers"))}</div>`;
  return `<section class="card scope-section" aria-label="${escapeHtml(text("adminClientScopeMappers"))}"><div class="admin-detail-heading"><h2>${escapeHtml(text("adminClientScopeMappers"))}</h2>${readOnly ? "" : button(text("adminAddClientScopeMapper"), { action: "admin-client-scope-mapper-create", id: scopeId, icon: "add", disabled: state.offline || Boolean(state.busy) })}</div><p class="muted">${escapeHtml(text("adminClientScopeMappersDescription"))}</p><div class="list">${rows}</div>${editorForm}</section>`;
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
      ? `<form class="card" data-form="admin-client-mapper" data-client-id="${escapeHtml(clientId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(
          text(
            chooseLazy(
              mapperId,
              () => "adminEditClientMapper",
              () => "adminCreateClientMapper",
            ),
          ),
        )}</h3>${field("name", text("adminClientMapperName"), draft.name ?? mapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("source", text("adminClientMapperSource"), draft.source ?? mapper?.source ?? "", errors.source, "text", 'maxlength="200"')}<div class="field"><label for="client-mapper-type">${escapeHtml(text("adminClientMapperType"))}</label><select id="client-mapper-type" name="mapperType">${options
          .map(
            (option) =>
              '<option value="' +
              option +
              '" ' +
              chooseLazy(
                (draft.mapperType ?? mapper?.mapperType ?? "email") === option,
                () => "selected",
                () => "",
              ) +
              ">" +
              option +
              "</option>",
          )
          .join(
            "",
          )}</select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div>${field("claimName", text("adminClientMapperClaim"), draft.claimName ?? mapper?.claimName ?? "email", errors.claimName, "text", 'maxlength="200"')}${field("value", text("adminClientMapperValue"), draft.value ?? mapper?.value ?? "", errors.value, "text", 'maxlength="1000"')}${field("priority", text("adminClientMapperPriority"), draft.priority ?? mapper?.priority ?? 100, errors.priority, "number", 'min="0" max="10000" step="1"')}<label class="settings-row"><input type="checkbox" name="addToIdToken" ${chooseLazy(
          draft.addToIdToken ?? mapper?.addToIdToken ?? true,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${chooseLazy(
          draft.addToAccessToken ?? mapper?.addToAccessToken ?? true,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-mapper-editor-cancel" data-id="${escapeHtml(clientId)}" ${chooseLazy(
          state.busy,
          () => "disabled",
          () => "",
        )}>${escapeHtml(text("cancel"))}</button></div></form>`
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
          const controls = chooseLazy(
            confirming,
            () =>
              `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientMapperPrompt"))}</span>${button(text("adminDeleteClientMapper"), { action: "admin-client-mapper-delete-confirm", id: clientId, mapper: item.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-mapper-delete-cancel" data-id="${escapeHtml(clientId)}" data-mapper="${escapeHtml(item.id)}" ${chooseLazy(
                state.busy,
                () => "disabled",
                () => "",
              )}>${escapeHtml(text("cancel"))}</button></div>`,
            () =>
              `<div class="actions">${button(text("adminEditClientMapper"), { action: "admin-client-mapper-edit", id: clientId, mapper: item.id, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteClientMapper"), { action: "admin-client-mapper-delete-request", id: clientId, mapper: item.id, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`,
          );
          return `<article class="list-item" data-client-mapper-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span class="muted">${escapeHtml("" + item.mapperType + " · " + item.claimName + "")}</span></div><span>${escapeHtml(
            text(
              chooseLazy(
                item.addToIdToken,
                () => "adminMapperAddToIdToken",
                () => "adminMapperAddToAccessToken",
              ),
            ),
          )}</span>${controls}</article>`;
        })
        .join("")
    : `<div class="empty" role="status">${escapeHtml(text("adminNoClientMappers"))}</div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminClientMappers"))}"><div class="admin-detail-heading"><h2>${escapeHtml(text("adminClientMappers"))}</h2>${button(text("adminAddClientMapper"), { action: "admin-client-mapper-create", id: clientId, icon: "add", disabled: state.offline || Boolean(state.busy) })}</div><div class="list">${rows}</div>${editorForm}</section>`;
}

function isClientScopeScreen() {
  return [
    "client-scopes",
    "client-scope-detail",
    "client-scope-create",
  ].includes(state.route);
}

function clientScopeBreadcrumb() {
  if (!isClientScopeScreen() || state.route === "client-scopes") return "";
  return `<nav class="client-breadcrumb" aria-label="${escapeHtml(text("adminBreadcrumb"))}">${button(text("adminClientScopes"), { action: "client-scope-back", variant: "secondary", disabled: Boolean(state.busy) })}<span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(routeTitle())}</span></nav>`;
}

function clientScopeById(id) {
  return (
    (state.data.clientScopeDetail?.id === id
      ? state.data.clientScopeDetail
      : null) ??
    (state.data.clientScopes?.content ?? []).find((scope) => scope.id === id)
  );
}

function adminClientScopesContent() {
  const page = state.data.clientScopes ?? {};
  const scopes = Array.isArray(page.content) ? page.content : [];
  const current = Number(page.page?.number ?? page.number ?? 0);
  const pages = Number(page.page?.totalPages ?? page.totalPages ?? 0);
  const total = Number(
    page.page?.totalElements ?? page.totalElements ?? scopes.length,
  );
  const manage = state.data.adminAccess?.manageClients === true;
  const blocked = Boolean(state.busy);
  const rows = scopes
    .map((scope) => {
      const id = escapeHtml(scope.id);
      const actions = `${button(text("adminClientScopeDetails"), { action: "client-scope-open", id: scope.id, icon: "view", variant: "secondary", disabled: blocked })}${!scope.builtIn && manage ? button(text("actionEdit"), { action: "client-scope-edit", id: scope.id, icon: "edit", variant: "secondary", disabled: blocked }) + button(text("actionDelete"), { action: "admin-client-scope-delete-request", id: scope.id, icon: "delete", danger: true, disabled: state.offline || blocked }) : ""}`;
      return `<tr data-client-scope-id="${id}"><td><div class="scope-identity"><a class="admin-user-detail-link" href="#/admin/client-scopes/${id}/details" data-action="client-scope-open" data-id="${id}"><code>${escapeHtml(scope.name)}</code></a><span class="client-badge">${escapeHtml(text(scope.builtIn ? "adminBuiltIn" : "adminCustom"))}</span></div></td><td>${escapeHtml(scope.displayName || "—")}</td><td>${escapeHtml(scope.description || "—")}</td><td class="scope-row-actions"><details class="admin-user-menu scope-menu"><summary aria-label="${escapeHtml(scope.name + " · " + text("adminScopeActions"))}">${actionIcon("more")}</summary><div class="admin-user-menu-panel">${actions}</div></details></td></tr>${state.data.clientScopeDeleteConfirmId === scope.id ? `<tr><td colspan="4"><div class="actions scope-delete-confirm" role="alert"><span>${escapeHtml(scope.name)}: ${escapeHtml(text("adminDeleteClientScopePrompt"))}</span>${button(text("adminDeleteClientScope"), { action: "admin-client-scope-delete-confirm", id: scope.id, danger: true, busy: state.busy === `client-scope-delete:${scope.id}`, disabled: state.offline || blocked })}${button(text("cancel"), { action: "admin-client-scope-delete-cancel", variant: "secondary", disabled: blocked })}</div></td></tr>` : ""}`;
    })
    .join("");
  return `<section class="admin-users-panel scope-panel" aria-label="${escapeHtml(text("adminClientScopes"))}"><form id="admin-client-scope-search" class="scope-toolbar" role="search"><div class="admin-users-search"><span aria-hidden="true">${actionIcon("search")}</span><input id="admin-client-scope-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClientScopes"))}" value="${escapeHtml(state.data.clientScopeQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchClientScopes"))}" maxlength="200"/></div><label class="scope-sort" for="admin-client-scope-sort"><span>${escapeHtml(text("adminScopeSort"))}</span><select id="admin-client-scope-sort" name="sort">${[
    ["name,asc", "adminScopeSortNameAsc"],
    ["name,desc", "adminScopeSortNameDesc"],
    ["displayName,asc", "adminScopeSortDisplayName"],
  ]
    .map(
      ([value, key]) =>
        `<option value="${value}" ${(state.data.clientScopeSort ?? "name,asc") === value ? "selected" : ""}>${escapeHtml(text(key))}</option>`,
    )
    .join(
      "",
    )}</select></label>${button(text("adminScopeSearch"), { type: "submit", variant: "secondary", icon: "search", busy: state.busy === "client-scopes-search", disabled: state.offline || blocked })}</form><p class="scope-results" role="status">${total} ${escapeHtml(text("adminScopeResults"))}</p>${scopes.length ? `<div class="scope-table-wrap"><table class="scope-table"><thead><tr><th scope="col">${escapeHtml(text("adminScopeNameColumn"))}</th><th scope="col">${escapeHtml(text("adminClientScopeDisplayName"))}</th><th scope="col">${escapeHtml(text("adminScopeDescriptionColumn"))}</th><th scope="col">${escapeHtml(text("adminScopeActions"))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty" role="status">${escapeHtml(text("adminNoClientScopes"))}</div>`}<div class="admin-users-pagination"><button class="secondary-button" type="button" data-client-scope-page="${current - 1}" ${current <= 0 || blocked ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${pages ? current + 1 : 0} / ${pages}</span><button class="secondary-button" type="button" data-client-scope-page="${current + 1}" ${current + 1 >= pages || blocked ? "disabled" : ""}>${spin(state.busy === "client-scopes-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminClientScopeDetailContent() {
  const scope =
    state.data.clientScopeDetail ??
    clientScopeById(state.data.clientScopeDetailId);
  if (!scope)
    return `<section class="card scope-detail-unavailable" role="status"><p>${escapeHtml(text("adminScopeDetailUnavailable"))}</p><div class="actions">${button(text("adminRetry"), { action: "retry", icon: "reset", busy: state.busy === "retry", disabled: Boolean(state.busy) })}${button(text("adminClientScopes"), { action: "client-scope-back", variant: "secondary", disabled: Boolean(state.busy) })}</div></section>`;
  const scopes = [scope];
  const manage = state.data.adminAccess?.manageClients === true;
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
      const scopeNameId = `client-scope-name-${scope.id}`;
      const consentTextId = `client-scope-consent-text-${scope.id}`;
      const groupClaimId = `client-scope-group-claim-${scope.id}`;
      const readOnly = scope.builtIn || !manage;
      const editing = !scope.builtIn && manage;
      const metadata = editing
        ? `<form class="scope-edit-form" data-form="admin-client-scope-edit" data-scope-id="${escapeHtml(scope.id)}" data-scope-name="${escapeHtml(scope.name)}" novalidate><div class="field"><label for="${escapeHtml(scopeNameId)}">${escapeHtml(text("adminClientScopeName"))}</label><input id="${escapeHtml(scopeNameId)}" name="name" type="text" value="${escapeHtml(draft.name ?? scope.name)}" maxlength="100" required ${readOnly ? "disabled" : ""}/><div class="field-error">${escapeHtml(scopeErrors.name ?? "")}</div></div><div class="field"><label for="${escapeHtml(displayNameId)}">${escapeHtml(text("adminClientScopeDisplayName"))}</label><input id="${escapeHtml(displayNameId)}" name="displayName" type="text" value="${escapeHtml(draft.displayName ?? scope.displayName ?? "")}" maxlength="200" ${readOnly ? "disabled" : ""}/><div class="field-error">${escapeHtml(scopeErrors.displayName ?? "")}</div></div><div class="field"><label for="${escapeHtml(descriptionId)}">${escapeHtml(text("adminClientScopeDescription"))}</label><textarea id="${escapeHtml(descriptionId)}" name="description" rows="4" maxlength="500" ${readOnly ? "disabled" : ""}>${escapeHtml(draft.description ?? scope.description ?? "")}</textarea><div class="field-error">${escapeHtml(scopeErrors.description ?? "")}</div></div><div class="field"><label for="${escapeHtml(consentTextId)}">${escapeHtml(text("adminScopeConsentScreenText"))}</label><input id="${escapeHtml(consentTextId)}" name="consentScreenText" type="text" value="${escapeHtml(draft.consentScreenText ?? scope.consentScreenText ?? "")}" maxlength="200" ${readOnly ? "disabled" : ""}/><div class="field-error">${escapeHtml(scopeErrors.consentScreenText ?? "")}</div></div><div class="scope-detail-options"><label class="settings-row"><input type="checkbox" name="displayOnConsentScreen" ${(draft.displayOnConsentScreen ?? scope.displayOnConsentScreen) ? "checked" : ""} ${readOnly ? "disabled" : ""}/>${escapeHtml(text("adminScopeDisplayOnConsentScreen"))}</label><label class="settings-row"><input type="checkbox" name="includeInTokenScope" ${(draft.includeInTokenScope ?? scope.includeInTokenScope !== false) ? "checked" : ""} ${readOnly ? "disabled" : ""}/>${escapeHtml(text("adminScopeIncludeInTokenScope"))}</label></div><div class="field"><label for="${escapeHtml(groupClaimId)}">${escapeHtml(text("adminScopeGroupClaimName"))}</label><input id="${escapeHtml(groupClaimId)}" name="groupClaimName" type="text" value="${escapeHtml(draft.groupClaimName ?? scope.groupClaimName ?? "groups")}" maxlength="100" required ${readOnly ? "disabled" : ""}/><div class="field-error">${escapeHtml(scopeErrors.groupClaimName ?? "")}</div></div><div class="scope-detail-options"><label class="settings-row"><input type="checkbox" name="groupMapperEnabled" ${(draft.groupMapperEnabled ?? scope.groupMapperEnabled) ? "checked" : ""} ${readOnly ? "disabled" : ""}/>${escapeHtml(text("adminScopeGroupMapperEnabled"))}</label><label class="settings-row"><input type="checkbox" name="groupMapperFullPath" ${(draft.groupMapperFullPath ?? scope.groupMapperFullPath !== false) ? "checked" : ""} ${readOnly ? "disabled" : ""}/>${escapeHtml(text("adminScopeGroupMapperFullPath"))}</label></div><div class="actions">${button(text("save"), { type: "submit", icon: "save", busy, disabled: readOnly || state.offline || Boolean(state.busy) })}</div></form>`
        : `<dl class="client-facts"><dt>${escapeHtml(text("adminClientScopeName"))}</dt><dd><code>${escapeHtml(scope.name)}</code> <span class="client-badge">${escapeHtml(scope.builtIn ? text("adminBuiltIn") : text("adminCustom"))}</span></dd><dt>${escapeHtml(text("adminClientScopeDisplayName"))}</dt><dd>${escapeHtml(scope.displayName || "—")}</dd><dt>${escapeHtml(text("adminClientScopeDescription"))}</dt><dd>${escapeHtml(scope.description || "—")}</dd></dl>${!scope.builtIn && manage ? button(text("actionEdit"), { action: "client-scope-edit", id: scope.id, icon: "edit", variant: "secondary", disabled: Boolean(state.busy) }) : ""}`;
      const extendedMetadata = `<dl class="client-facts scope-extended-facts"><dt>${escapeHtml(text("adminScopeConsentScreenText"))}</dt><dd>${escapeHtml(scope.consentScreenText || "—")}</dd><dt>${escapeHtml(text("adminScopeDisplayOnConsentScreen"))}</dt><dd>${escapeHtml(text(scope.displayOnConsentScreen ? "adminScopeYes" : "adminScopeNo"))}</dd><dt>${escapeHtml(text("adminScopeIncludeInTokenScope"))}</dt><dd>${escapeHtml(text(scope.includeInTokenScope === false ? "adminScopeNo" : "adminScopeYes"))}</dd><dt>${escapeHtml(text("adminScopeGroupMapperEnabled"))}</dt><dd>${escapeHtml(text(scope.groupMapperEnabled ? "adminScopeYes" : "adminScopeNo"))}</dd><dt>${escapeHtml(text("adminScopeGroupClaimName"))}</dt><dd><code>${escapeHtml(scope.groupClaimName || "groups")}</code></dd><dt>${escapeHtml(text("adminScopeGroupMapperFullPath"))}</dt><dd>${escapeHtml(text(scope.groupMapperFullPath === false ? "adminScopeNo" : "adminScopeYes"))}</dd><dt>${escapeHtml(text("adminScopeCreated"))}</dt><dd>${escapeHtml(scope.createdAt ? new Date(scope.createdAt).toLocaleString(state.locale) : "—")}</dd><dt>${escapeHtml(text("adminScopeUpdated"))}</dt><dd>${escapeHtml(scope.updatedAt ? new Date(scope.updatedAt).toLocaleString(state.locale) : "—")}</dd></dl>`;
      const deleteControls =
        scope.builtIn || !manage
          ? ""
          : chooseLazy(
              confirming,
              () =>
                `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientScopePrompt"))}</span>${button(text("adminDeleteClientScope"), { action: "admin-client-scope-delete-confirm", id: scope.id, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-delete-cancel" ${chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                )}>${escapeHtml(text("cancel"))}</button></div>`,
              () => "",
            );
      const roleMappingsOpen =
        state.data.adminClientScopeRoleMappingsOpenId === scope.id;
      const roleMappingControls = button(text("adminClientScopeRoleMappings"), {
        action: "admin-client-scope-role-mappings-toggle",
        id: scope.id,
        icon: "edit",
        variant: "secondary",
        disabled: state.offline || Boolean(state.busy),
      });
      const roleMappingPanel = roleMappingsOpen
        ? clientScopeRoleMappingPanel(scope.id, scope.builtIn || !manage)
        : "";
      const mappersOpen = state.data.clientScopeMappersOpenId === scope.id;
      const mapperControls = button(text("adminClientScopeMappers"), {
        action: "admin-client-scope-mappers-toggle",
        id: scope.id,
        icon: "edit",
        variant: "secondary",
        disabled: state.offline || Boolean(state.busy),
      });
      const mapperPanel = mappersOpen
        ? clientScopeMappersPanel(scope.id, scope.builtIn || !manage)
        : "";
      return `<article class="scope-detail" data-client-scope-detail="${escapeHtml(scope.id)}">${metadata}${extendedMetadata}${deleteControls}${mapperControls}${mapperPanel}${roleMappingControls}${roleMappingPanel}</article>`;
    })
    .join("");
  return `<section class="card scope-detail-panel" aria-label="${escapeHtml(text("adminClientScopeDetails"))}">${scopeRows}</section>`;
}

function adminClientScopeCreateContent() {
  const draft = state.data.adminClientScopeCreateDraft ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><form data-form="admin-client-scope-create" novalidate>${field("name", text("adminClientScopeName"), draft.name ?? "", errors.name, "text", 'maxlength="100" autocomplete="off" required')}${field("displayName", text("adminClientScopeDisplayName"), draft.displayName ?? "", errors.displayName, "text", 'maxlength="200"')}${field("description", text("adminClientScopeDescription"), draft.description ?? "", errors.description, "text", 'maxlength="500"')}<div class="muted">${escapeHtml(text("adminClientScopeDefaults"))}</div>${button(text("adminCreateClientScope"), { type: "submit", busy: state.busy === "client-scope-create", disabled: state.offline || Boolean(state.busy), icon: "add" })}${button(text("cancel"), { action: "client-scope-back", variant: "secondary", disabled: Boolean(state.busy) })}</form></section>`;
}

function adminClientCreateContent() {
  const draft = state.data.adminClientCreateDraft ?? {};
  const errors = state.data.adminClientCreateError
    ? violations(state.error?.body)
    : {};
  const secret = state.data.clientCreateSecret;
  const secretPanel = secret
    ? `<section class="card notice warning" aria-label="${escapeHtml(text("adminClientSecretOneTime"))}"><h2>${escapeHtml(text("adminClientSecretOneTime"))}</h2><p>${escapeHtml(text("adminClientSecretOneTimeHelp"))}</p><code data-one-time-client-secret="true">${escapeHtml(secret)}</code>${button(text("adminClientSecretDone"), { action: "client-create-secret-dismiss" })}</section>`
    : "";
  if (secret) return secretPanel;
  return `${secretPanel}<section class="card"><form data-form="admin-client-create" novalidate>${field("clientId", text("adminClientId"), draft.clientId ?? "", errors.clientId, "text", 'maxlength="100" autocomplete="off" required')}${field("clientName", text("adminClientName"), draft.clientName ?? "", errors.clientName, "text", 'maxlength="200" required')}<div class="field"><label for="client-authentication-mode">${escapeHtml(text("adminClientAuthentication"))}</label><select id="client-authentication-mode" name="authenticationMode"><option value="confidential" ${(draft.authenticationMode ?? "confidential") === "confidential" ? "selected" : ""}>${escapeHtml(text("adminClientConfidential"))}</option><option value="public" ${draft.authenticationMode === "public" ? "selected" : ""}>${escapeHtml(text("adminClientPublic"))}</option></select><div class="field-error">${escapeHtml(errors.clientAuthenticationMethods ?? "")}</div></div><div class="field"><label for="client-redirect-uris">${escapeHtml(text("adminClientRedirectUris"))}</label><textarea id="client-redirect-uris" name="redirectUris" rows="3" maxlength="4000" required>${escapeHtml(draft.redirectUris ?? "")}</textarea><div class="field-error">${escapeHtml(errors.redirectUris ?? "")}</div></div><div class="field"><label for="client-post-logout-uris">${escapeHtml(text("adminClientPostLogoutUris"))}</label><textarea id="client-post-logout-uris" name="postLogoutRedirectUris" rows="3" maxlength="4000">${escapeHtml(draft.postLogoutRedirectUris ?? "")}</textarea><div class="field-error">${escapeHtml(errors.postLogoutRedirectUris ?? "")}</div></div>${field("scopes", text("adminClientScopesInput"), draft.scopes ?? "openid profile", errors.scopes, "text", 'maxlength="1000" required')}<label class="settings-row"><input type="checkbox" name="requireAuthorizationConsent" ${draft.requireAuthorizationConsent === false ? "" : "checked"}/>${escapeHtml(text("adminClientRequireConsent"))}</label><div class="muted">${escapeHtml(text("adminClientCreateSafeDefaults"))}</div><div class="actions">${button(text("adminCreateClient"), { type: "submit", busy: state.busy === "client-create", disabled: state.offline || Boolean(state.busy), icon: "add" })}<button class="secondary-button" type="button" data-action="client-create-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function clientConfigurationDraft(client) {
  const lines = (value) => (Array.isArray(value) ? value.join("\n") : "");
  return {
    clientId: client.clientId ?? "",
    clientName: client.clientName ?? "",
    clientAuthenticationMethods: lines(client.clientAuthenticationMethods),
    authorizationGrantTypes: lines(client.authorizationGrantTypes),
    redirectUris: lines(client.redirectUris),
    postLogoutRedirectUris: lines(client.postLogoutRedirectUris),
    scopes: lines(client.scopes),
    requireAuthorizationConsent: Boolean(client.requireAuthorizationConsent),
    requireProofKey: Boolean(client.requireProofKey),
    requireDpop: Boolean(client.requireDpop),
    requireDpopJkt: Boolean(client.requireDpopJkt),
    dpopRefreshTokenOnly: Boolean(client.dpopRefreshTokenOnly),
    dpopSigningAlgorithms: lines(client.dpopSigningAlgorithms),
    cibaDeliveryMode: client.cibaDeliveryMode ?? "poll",
    cibaNotificationEndpoint: client.cibaNotificationEndpoint ?? "",
    authorizationCodeTimeToLive: client.authorizationCodeTimeToLive ?? "",
    accessTokenTimeToLive: client.accessTokenTimeToLive ?? "",
    refreshTokenTimeToLive: client.refreshTokenTimeToLive ?? "",
    serviceAccountEnabled: Boolean(client.serviceAccountEnabled),
    clientSecretTimeToLive: "",
    enabled: Boolean(client.enabled),
    rootUrl: client.rootUrl ?? "",
    homeUrl: client.homeUrl ?? "",
    webOrigins: lines(client.webOrigins),
    adminUrl: client.adminUrl ?? "",
    frontChannelLogout: Boolean(client.frontChannelLogout),
    backchannelLogout: Boolean(client.backchannelLogout),
    jwkSetUrl: client.jwkSetUrl ?? "",
    tokenEndpointAuthenticationSigningAlgorithm:
      client.tokenEndpointAuthenticationSigningAlgorithm ?? "",
    x509CertificateSubjectDN: client.x509CertificateSubjectDN ?? "",
    offlineSessionIdle: client.offlineSessionIdle ?? "",
    offlineSessionMax: client.offlineSessionMax ?? "",
    tokenExchangeDownscopeOnly: Boolean(client.tokenExchangeDownscopeOnly),
    tokenExchangeAllowDelegation: Boolean(client.tokenExchangeAllowDelegation),
    tokenExchangeAllowedAudiences: lines(client.tokenExchangeAllowedAudiences),
  };
}

function adminClientConfigurationForm(id) {
  const client = state.data.clientConfiguration;
  if (!client || client.id !== id)
    return `<section class="card" role="status">${escapeHtml(text("loading"))}</section>`;
  const draft = state.data.clientConfigurationDrafts?.[id] ?? {};
  const errors =
    state.data.clientConfigurationErrorId === id
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `client-configuration-save:${id}`;
  const checkbox = (name, key, checked) =>
    `<div class="field"><label class="settings-row admin-user-detail-switch"><input type="checkbox" role="switch" name="${name}" ${checked ? "checked" : ""}/><span class="admin-user-detail-switch-control" aria-hidden="true"></span><span>${escapeHtml(text(key))}</span></label><div class="field-error">${escapeHtml(errors[name] ?? "")}</div></div>`;
  const checks = (name, key, options) =>
    `<fieldset class="field"><legend>${escapeHtml(text(key))}</legend>${options
      .map(
        (option) =>
          '<label class="settings-row"><span>' +
          escapeHtml(option) +
          '</span><input type="checkbox" name="' +
          name +
          '" value="' +
          escapeHtml(option) +
          '" ' +
          ((draft[name] ?? "").split("\n").includes(option) ? "checked" : "") +
          "/></label>",
      )
      .join(
        "",
      )}<div class="field-error">${escapeHtml(errors[name] ?? "")}</div></fieldset>`;
  const listField = (name, key, value, required = false) =>
    `<div class="field"><label for="client-config-${name}">${escapeHtml(text(key))}</label><textarea id="client-config-${name}" name="${name}" aria-invalid="${Boolean(errors[name])}" rows="3" maxlength="4000" ${required ? "required" : ""}>${escapeHtml(value ?? "")}</textarea><div class="field-error">${escapeHtml(errors[name] ?? "")}</div></div>`;
  const selectField = (name, key, value, options) =>
    `<div class="field"><label for="client-config-${name}">${escapeHtml(text(key))}</label><select id="client-config-${name}" name="${name}">${options
      .map(
        (option) =>
          '<option value="' +
          option +
          '" ' +
          (value === option ? "selected" : "") +
          ">" +
          option +
          "</option>",
      )
      .join(
        "",
      )}</select><div class="field-error">${escapeHtml(errors[name] ?? "")}</div></div>`;
  const authOptions = [
    "none",
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt",
    "tls_client_auth",
    "self_signed_tls_client_auth",
  ];
  const grantOptions = [
    "authorization_code",
    "refresh_token",
    "client_credentials",
    "urn:openid:params:grant-type:ciba",
    "urn:ietf:params:oauth:grant-type:token-exchange",
  ];
  const tokenExchangeAudiences = draft.tokenExchangeAllowedAudiences ?? "";
  const input = (name, key, extra = "") =>
    field(name, text(key), draft[name] ?? "", errors[name], "text", extra);
  const flag = (name, key) => checkbox(name, key, draft[name]);
  const section = (key, body) =>
    `<section class="card client-settings-section"><h2>${escapeHtml(text(key))}</h2>${body}</section>`;
  const general = `${input("clientId", "adminClientId", 'maxlength="100" required')}${input("clientName", "adminClientName", 'maxlength="200" required')}${flag("enabled", "adminClientEnabled")}<p class="muted">${escapeHtml(text("adminClientEnabledHelp"))}</p>`;
  const capabilities = `<div class="client-settings-grid">${checks("clientAuthenticationMethods", "adminClientAuthenticationMethods", authOptions)}${checks("authorizationGrantTypes", "adminClientGrantTypes", grantOptions)}${flag("serviceAccountEnabled", "adminClientServiceAccountEnabled")}${flag("requireProofKey", "adminClientRequireProofKey")}${flag("requireAuthorizationConsent", "adminClientRequireConsent")}${flag("requireDpop", "adminClientRequireDpop")}${flag("requireDpopJkt", "adminClientRequireDpopJkt")}${flag("dpopRefreshTokenOnly", "adminClientDpopRefreshOnly")}${checks("dpopSigningAlgorithms", "adminClientDpopAlgorithms", ["RS256", "ES256"])}${listField("scopes", "adminClientScopesInput", draft.scopes, true)}${selectField("cibaDeliveryMode", "adminClientCibaMode", draft.cibaDeliveryMode ?? "poll", ["poll", "ping", "push"])}${input("cibaNotificationEndpoint", "adminClientCibaEndpoint")}${input("authorizationCodeTimeToLive", "adminClientAuthorizationCodeTtl")}${input("accessTokenTimeToLive", "adminClientAccessTokenTtl")}${input("refreshTokenTimeToLive", "adminClientRefreshTokenTtl")}${input("clientSecretTimeToLive", "adminClientSecretTtl")}${input("clientSecretGracePeriod", "adminClientSecretGracePeriod", 'placeholder="PT24H"')}${input("offlineSessionIdle", "adminClientOfflineSessionIdle")}${input("offlineSessionMax", "adminClientOfflineSessionMax")}${input("jwkSetUrl", "adminClientJwksUrl")}${input("tokenEndpointAuthenticationSigningAlgorithm", "adminClientSigningAlgorithm")}${input("x509CertificateSubjectDN", "adminClientCertificateSubject")}${listField("tokenExchangeAllowedAudiences", "adminClientTokenExchangeAudiences", tokenExchangeAudiences)}${flag("tokenExchangeDownscopeOnly", "adminClientTokenExchangeDownscope")}${flag("tokenExchangeAllowDelegation", "adminClientTokenExchangeDelegation")}<div class="field"><label for="client-config-cibaClientNotificationToken">${escapeHtml(text("adminClientCibaToken"))}</label><input id="client-config-cibaClientNotificationToken" type="password" name="cibaClientNotificationToken" maxlength="512" autocomplete="new-password"/><div class="muted">${escapeHtml(text(client.cibaClientNotificationTokenConfigured ? "adminClientCibaTokenPreserved" : "adminClientCibaTokenOptional"))}</div><div class="field-error">${escapeHtml(errors.cibaClientNotificationToken ?? "")}</div></div></div>`;
  const login = `${listField("redirectUris", "adminClientRedirectUris", draft.redirectUris)}${listField("postLogoutRedirectUris", "adminClientPostLogoutUris", draft.postLogoutRedirectUris)}<div class="client-settings-grid">${input("rootUrl", "adminClientRootUrl")}${input("homeUrl", "adminClientHomeUrl")}${input(["admin", "Url"].join(""), "adminClientAdminUrl")}${listField("webOrigins", "adminClientWebOrigins", draft.webOrigins)}${flag("frontChannelLogout", "adminClientFrontChannelLogout")}${flag("backchannelLogout", "adminClientBackchannelLogout")}</div>`;
  return `<form class="client-settings-form" data-form="admin-client-configuration" data-client-id="${escapeHtml(id)}" novalidate>${section("adminClientGeneral", general)}${section("adminClientCapabilities", capabilities)}${section("adminClientLoginSettings", login)}${clientCanUpdate(client) ? `<div class="actions client-form-actions">${button(text("save"), { type: "submit", icon: "check", busy, disabled: state.offline || Boolean(state.busy) })}${button(text("cancel"), { action: "admin-client-configuration-cancel", id, variant: "secondary", disabled: Boolean(state.busy) })}</div>` : ""}</form>`;
}

function clientCreateLineValues(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAbsoluteFragmentFreeUri(value) {
  try {
    const uri = new URL(value);
    return (
      Boolean(uri.protocol) &&
      !uri.hash &&
      ![
        "about:",
        "blob:",
        "data:",
        "file:",
        "filesystem:",
        "javascript:",
        "vbscript:",
      ].includes(uri.protocol)
    );
  } catch {
    return false;
  }
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
      return `<article class="list-item"><div><strong>${escapeHtml(scope.displayName || name)}</strong><span class="muted">${escapeHtml(scope.description ?? name)}</span></div><label class="settings-row" for="${escapeHtml("" + inputId + "-default")}"><input id="${escapeHtml("" + inputId + "-default")}" type="checkbox" name="defaultScopes" value="${escapeHtml(name)}" ${defaults.includes(name) ? "checked" : ""}/>${escapeHtml(text("adminClientScopeDefault"))}</label><label class="settings-row" for="${escapeHtml("" + inputId + "-optional")}"><input id="${escapeHtml("" + inputId + "-optional")}" type="checkbox" name="optionalScopes" value="${escapeHtml(name)}" ${optional.includes(name) ? "checked" : ""}/>${escapeHtml(text("adminClientScopeOptional"))}</label></article>`;
    })
    .join("");
  return `<section class="card" data-client-scope-assignments-panel="true" data-client-id="${escapeHtml(clientId)}" aria-label="${escapeHtml(text("adminClientScopeAssignments"))}"><form data-form="admin-client-scope-assignments" data-client-id="${escapeHtml(clientId)}"><fieldset><legend>${escapeHtml(text("adminClientScopeAssignmentsHelp"))}</legend>${rows || '<div class="empty" role="status">' + escapeHtml(text("adminNoClientScopes")) + "</div>"}</fieldset><div class="field-error" role="alert">${escapeHtml(localError)}</div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "client-scope-assignments-save:" + clientId + "", disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-scope-assignments-cancel" data-id="${escapeHtml(clientId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></section>`;
}

function clientRoleAssignmentPanel(clientId, roleId, roleName) {
  const key = `${clientId}:${roleId}`;
  const assignment = state.data.clientRoleAssignments?.[key] ?? {};
  const users = Array.isArray(assignment.users) ? assignment.users : [];
  const groups = Array.isArray(assignment.groups) ? assignment.groups : [];
  const userCandidates = Array.isArray(assignment.userCandidates)
    ? assignment.userCandidates
    : [];
  const groupCandidates = Array.isArray(assignment.groupCandidates)
    ? assignment.groupCandidates
    : [];
  const memberRows = (members, kind) =>
    members
      .filter(
        (member) =>
          Number.isSafeInteger(Number(member?.id)) &&
          Number(member.id) > 0 &&
          typeof (kind === "user" ? member.username : member.name) === "string",
      )
      .map((member) => {
        const memberId = String(member.id);
        const confirming =
          assignment.removeConfirm?.kind === kind &&
          assignment.removeConfirm.id === memberId;
        const removeLabel = text(
          kind === "user"
            ? "adminClientRoleRemoveUser"
            : "adminClientRoleRemoveGroup",
        );
        const confirmLabel = text(
          kind === "user"
            ? "adminClientRoleRemoveUserConfirm"
            : "adminClientRoleRemoveGroupConfirm",
        );
        const busy =
          state.busy ===
          `client-role-assignment-remove:${clientId}:${roleId}:${kind}:${memberId}`;
        const actions = confirming
          ? `<div class="actions"><span role="status">${escapeHtml(confirmLabel)}</span>${button(removeLabel, { action: "admin-client-role-assignment-remove-confirm", id: clientId, clientRoleId: roleId, memberId, memberKind: kind, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-role-assignment-remove-cancel" data-id="${escapeHtml(clientId)}" data-client-role-id="${escapeHtml(roleId)}" data-member-id="${escapeHtml(memberId)}" data-member-kind="${kind}" ${chooseLazy(
              state.busy,
              () => "disabled",
              () => "",
            )}>${escapeHtml(text("cancel"))}</button></div>`
          : `<div class="actions">${button(removeLabel, { action: "admin-client-role-assignment-remove-request", id: clientId, clientRoleId: roleId, memberId, memberKind: kind, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
        return `<article class="list-item"><strong>${escapeHtml(kind === "user" ? member.username : member.path || member.name)}</strong>${actions}</article>`;
      })
      .join("");
  const candidateRows = (candidates, kind) =>
    candidates
      .filter(
        (candidate) =>
          !(kind === "user" ? users : groups).some(
            (assigned) => Number(assigned.id) === Number(candidate.id),
          ),
      )
      .filter(
        (candidate) =>
          Number.isSafeInteger(Number(candidate?.id)) &&
          Number(candidate.id) > 0 &&
          typeof (kind === "user" ? candidate.username : candidate.name) ===
            "string",
      )
      .map((candidate) => {
        const memberId = String(candidate.id);
        const label = text(
          kind === "user"
            ? "adminClientRoleAssignUser"
            : "adminClientRoleAssignGroup",
        );
        const busy =
          state.busy ===
          `client-role-assignment-add:${clientId}:${roleId}:${kind}:${memberId}`;
        return `<article class="list-item"><strong>${escapeHtml(kind === "user" ? candidate.username : candidate.path || candidate.name)}</strong>${button(label, { action: "admin-client-role-assignment-add", id: clientId, clientRoleId: roleId, memberId, memberKind: kind, busy, disabled: state.offline || Boolean(state.busy) })}</article>`;
      })
      .join("");
  const userSearching =
    state.busy === `client-role-assignment-search:${clientId}:${roleId}:user`;
  const groupSearching =
    state.busy === `client-role-assignment-search:${clientId}:${roleId}:group`;
  return `<section class="card" data-client-role-assignments="${escapeHtml(key)}" aria-label="${escapeHtml(text("adminManageClientRoleAssignments"))}"><h4>${escapeHtml(roleName)}</h4><fieldset><legend>${escapeHtml(text("adminClientRoleAssignedUsers"))}</legend>${memberRows(users, "user") || '<div class="empty" role="status">' + escapeHtml(text("adminNoUsers")) + "</div>"}<div class="actions"><input name="user-q" type="search" aria-label="${escapeHtml(text("adminClientRoleSearchUsers"))}" value="${escapeHtml(assignment.userQuery ?? "")}" maxlength="100" minlength="2"/>${button(text("adminSearchRoleCandidates"), { action: "admin-client-role-assignment-search", id: clientId, clientRoleId: roleId, memberKind: "user", busy: userSearching, disabled: state.offline || Boolean(state.busy) })}</div><div class="field-error" data-assignment-search-error="user" role="alert">${escapeHtml(assignment.userSearchError ? text(assignment.userSearchError) : "")}</div>${candidateRows(userCandidates, "user")}</fieldset><fieldset><legend>${escapeHtml(text("adminClientRoleAssignedGroups"))}</legend>${memberRows(groups, "group") || '<div class="empty" role="status">' + escapeHtml(text("adminNoGroups")) + "</div>"}<div class="actions"><input name="group-q" type="search" aria-label="${escapeHtml(text("adminClientRoleSearchGroups"))}" value="${escapeHtml(assignment.groupQuery ?? "")}" maxlength="100" minlength="2"/>${button(text("adminSearchRoleCandidates"), { action: "admin-client-role-assignment-search", id: clientId, clientRoleId: roleId, memberKind: "group", busy: groupSearching, disabled: state.offline || Boolean(state.busy) })}</div><div class="field-error" data-assignment-search-error="group" role="alert">${escapeHtml(assignment.groupSearchError ? text(assignment.groupSearchError) : "")}</div>${candidateRows(groupCandidates, "group")}</fieldset><button class="secondary-button" type="button" data-action="admin-client-role-assignments-close" data-id="${escapeHtml(clientId)}" data-client-role-id="${escapeHtml(roleId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></section>`;
}

function clientRoleCompositePanel(clientId, roleId, roleName) {
  const key = clientId + ":" + roleId;
  const composition = state.data.clientRoleCompositions?.[key] ?? {};
  const clientRoles = Array.isArray(composition.clientRoles)
    ? composition.clientRoles.filter(
        (role) =>
          Number.isSafeInteger(Number(role?.id)) &&
          Number(role.id) > 0 &&
          /^[A-Za-z0-9_-]{1,100}$/.test(role?.clientId ?? "") &&
          typeof role?.name === "string",
      )
    : [];
  const realmRoles = Array.isArray(composition.realmRoles)
    ? composition.realmRoles.filter((role) =>
        /^ROLE_[A-Z0-9_]{1,45}$/.test(role?.name ?? ""),
      )
    : [];
  const clientCandidates = Array.isArray(composition.clientCandidates)
    ? composition.clientCandidates.filter(
        (role) =>
          Number.isSafeInteger(Number(role?.id)) &&
          Number(role.id) > 0 &&
          /^[A-Za-z0-9_-]{1,100}$/.test(role?.clientId ?? "") &&
          typeof role?.name === "string",
      )
    : [];
  const realmCandidates = Array.isArray(composition.realmCandidates)
    ? composition.realmCandidates.filter((role) =>
        /^ROLE_[A-Z0-9_]{1,45}$/.test(role?.name ?? ""),
      )
    : [];
  const rows = (roles, kind) =>
    roles.length
      ? roles
          .map((role) => {
            const memberId = chooseLazy(
              kind === "realm",
              () => role.name,
              () => String(role.id),
            );
            const confirming =
              composition.confirm?.kind === kind &&
              composition.confirm.id === memberId;
            const removeMessageKey = chooseLazy(
              kind === "realm",
              () => "adminRoleCompositeRemove",
              () => "adminRoleCompositeClientRemove",
            );
            const label = chooseLazy(
              kind === "realm",
              () => role.name,
              () => role.clientId + " / " + role.name,
            );
            const controls = chooseLazy(
              confirming,
              () =>
                '<div class="actions"><span role="status">' +
                escapeHtml(text("adminClientRoleCompositeSessionImpact")) +
                "</span>" +
                button(text(removeMessageKey), {
                  action: "admin-client-role-composite-remove-confirm",
                  id: clientId,
                  clientRoleId: roleId,
                  memberId,
                  memberKind: kind,
                  danger: true,
                  busy:
                    state.busy ===
                    "client-role-composite-remove:" +
                      clientId +
                      ":" +
                      roleId +
                      ":" +
                      kind +
                      ":" +
                      memberId,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                '<button class="secondary-button" type="button" data-action="admin-client-role-composite-cancel" data-id="' +
                escapeHtml(clientId) +
                '" data-client-role-id="' +
                escapeHtml(roleId) +
                '" data-member-id="' +
                escapeHtml(memberId) +
                '" data-member-kind="' +
                kind +
                '" ' +
                chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("cancel")) +
                "</button></div>",
              () =>
                '<div class="actions">' +
                button(text(removeMessageKey), {
                  action: "admin-client-role-composite-remove-request",
                  id: clientId,
                  clientRoleId: roleId,
                  memberId,
                  memberKind: kind,
                  danger: true,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                "</div>",
            );
            return (
              '<article class="list-item"><strong>' +
              escapeHtml(label) +
              "</strong>" +
              controls +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty" role="status">' +
        escapeHtml(
          text(
            chooseLazy(
              kind === "realm",
              () => "adminClientRoleCompositeEmptyRealm",
              () => "adminClientRoleCompositeEmptyClient",
            ),
          ),
        ) +
        "</div>";
  const candidates = (available, assigned, kind) =>
    available
      .filter(
        (role) =>
          !assigned.some((current) =>
            kind === "realm"
              ? current.name === role.name
              : Number(current.id) === Number(role.id),
          ),
      )
      .map((role) => {
        const memberId = kind === "realm" ? role.name : String(role.id);
        const confirming =
          composition.confirm?.kind === kind &&
          composition.confirm.id === memberId &&
          composition.confirm.adding;
        const actionName = confirming
          ? "admin-client-role-composite-add-confirm"
          : "admin-client-role-composite-add-request";
        const label = text(
          kind === "realm"
            ? "adminRoleCompositeAdd"
            : "adminRoleCompositeClientAdd",
        );
        const control = confirming
          ? '<div class="actions"><span role="status">' +
            escapeHtml(text("adminClientRoleCompositeSessionImpact")) +
            "</span>" +
            button(label, {
              action: actionName,
              id: clientId,
              clientRoleId: roleId,
              memberId,
              memberKind: kind,
              busy:
                state.busy ===
                "client-role-composite-add:" +
                  clientId +
                  ":" +
                  roleId +
                  ":" +
                  kind +
                  ":" +
                  memberId,
              disabled: state.offline || Boolean(state.busy),
            }) +
            '<button class="secondary-button" type="button" data-action="admin-client-role-composite-cancel" data-id="' +
            escapeHtml(clientId) +
            '" data-client-role-id="' +
            escapeHtml(roleId) +
            '" data-member-id="' +
            escapeHtml(memberId) +
            '" data-member-kind="' +
            kind +
            '" ' +
            chooseLazy(
              state.busy,
              () => "disabled",
              () => "",
            ) +
            ">" +
            escapeHtml(text("cancel")) +
            "</button></div>"
          : button(label, {
              action: actionName,
              id: clientId,
              clientRoleId: roleId,
              memberId,
              memberKind: kind,
              disabled: state.offline || Boolean(state.busy),
            });
        return (
          '<article class="list-item"><strong>' +
          escapeHtml(
            kind === "realm" ? role.name : role.clientId + " / " + role.name,
          ) +
          "</strong>" +
          control +
          "</article>"
        );
      })
      .join("");
  const queryField = (kind, messageKey) => {
    const busy =
      state.busy ===
      "client-role-composite-search:" + clientId + ":" + roleId + ":" + kind;
    return (
      '<div class="actions"><input name="' +
      kind +
      '-composite-q" type="search" aria-label="' +
      escapeHtml(text(messageKey)) +
      '" value="' +
      escapeHtml(composition[kind + "Query"] ?? "") +
      '" minlength="2" maxlength="100"/>' +
      button(text(messageKey), {
        action: "admin-client-role-composite-search",
        id: clientId,
        clientRoleId: roleId,
        memberKind: kind,
        busy,
        disabled: state.offline || Boolean(state.busy),
      }) +
      '</div><div class="field-error" data-composite-search-error="' +
      kind +
      '" role="alert">' +
      escapeHtml(
        composition[kind + "SearchError"]
          ? text(composition[kind + "SearchError"])
          : "",
      ) +
      "</div>"
    );
  };
  return (
    '<section class="card" data-client-role-composites="' +
    escapeHtml(key) +
    '" aria-label="' +
    escapeHtml(text("adminClientRoleComposites")) +
    '"><h4>' +
    escapeHtml(roleName) +
    "</h4><fieldset><legend>" +
    escapeHtml(text("adminClientRoleCompositeRealmTitle")) +
    "</legend>" +
    rows(realmRoles, "realm") +
    queryField("realm", "adminClientRoleCompositeSearchRealm") +
    candidates(realmCandidates, realmRoles, "realm") +
    "</fieldset><fieldset><legend>" +
    escapeHtml(text("adminClientRoleCompositeClientTitle")) +
    "</legend>" +
    rows(clientRoles, "client") +
    queryField("client", "adminClientRoleCompositeSearchClient") +
    candidates(clientCandidates, clientRoles, "client") +
    '</fieldset><button class="secondary-button" type="button" data-action="admin-client-role-composites-close" data-id="' +
    escapeHtml(clientId) +
    '" data-client-role-id="' +
    escapeHtml(roleId) +
    '" ' +
    (state.busy ? "disabled" : "") +
    ">" +
    escapeHtml(text("cancel")) +
    "</button></section>"
  );
}

function clientRolesPanel(clientId) {
  const panel = state.data.clientRoles?.[clientId] ?? {};
  const page = panel.page ?? { content: [], number: 0, totalPages: 0 };
  const roles = Array.isArray(page.content) ? page.content : [];
  const editingId = panel.editingId;
  const rows = roles
    .map((role) => {
      const roleId = String(role.id ?? "");
      const draft = panel.drafts?.[roleId] ?? {};
      const errors =
        panel.errorRoleId === roleId ? violations(state.error?.body) : {};
      const editing = editingId === roleId;
      const confirming = panel.deleteConfirmId === roleId;
      const assignmentKey = `${clientId}:${roleId}`;
      const assignment = state.data.clientRoleAssignments?.[assignmentKey];
      const composition = state.data.clientRoleCompositions?.[assignmentKey];
      const deleting =
        state.busy === `client-role-delete:${clientId}:${roleId}`;
      const editForm = editing
        ? `<form class="card" data-form="admin-client-role-update" data-client-id="${escapeHtml(clientId)}" data-role-id="${escapeHtml(roleId)}" novalidate>${field("name", text("adminClientRoleName"), draft.name ?? role.name ?? "", errors.name, "text", 'maxlength="100" pattern="[A-Za-z0-9._:-]+" required')}${field("description", text("adminClientRoleDescription"), draft.description ?? role.description ?? "", errors.description, "text", 'maxlength="500"')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "client-role-update:" + clientId + ":" + roleId + "", disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-role-edit-cancel" data-id="${escapeHtml(clientId)}" data-client-role-id="${escapeHtml(roleId)}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div></form>`
        : "";
      const deleteControls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminDeleteClientRolePrompt"))}</span>${button(text("adminDeleteClientRole"), { action: "admin-client-role-delete-confirm", id: clientId, clientRoleId: roleId, danger: true, busy: deleting, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-client-role-delete-cancel" data-id="${escapeHtml(clientId)}" data-client-role-id="${escapeHtml(roleId)}" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminEditClientRole"), { action: "admin-client-role-edit", id: clientId, clientRoleId: roleId, disabled: state.offline || Boolean(state.busy) })}${button(text("adminDeleteClientRole"), { action: "admin-client-role-delete-request", id: clientId, clientRoleId: roleId, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const assignmentToggle = button(
        text("adminManageClientRoleAssignments"),
        {
          action: "admin-client-role-assignments-toggle",
          id: clientId,
          clientRoleId: roleId,
          busy:
            state.busy === `client-role-assignment-load:${clientId}:${roleId}`,
          disabled: state.offline || Boolean(state.busy),
        },
      );
      const assignmentPanel = assignment?.open
        ? clientRoleAssignmentPanel(clientId, roleId, role.name ?? "")
        : "";
      const compositionToggle = button(text("adminClientRoleComposites"), {
        action: "admin-client-role-composites-toggle",
        id: clientId,
        clientRoleId: roleId,
        busy:
          state.busy === `client-role-composites-load:${clientId}:${roleId}`,
        disabled: state.offline || Boolean(state.busy),
      });
      const compositionPanel = composition?.open
        ? clientRoleCompositePanel(clientId, roleId, role.name ?? "")
        : "";
      return `<article class="list-item" data-client-role-id="${escapeHtml(roleId)}"><div><strong>${escapeHtml(role.name ?? "")}</strong><span class="muted">${escapeHtml(role.description ?? "")}</span></div><div class="actions">${assignmentToggle}${compositionToggle}</div>${deleteControls}${editForm}${assignmentPanel}${compositionPanel}</article>`;
    })
    .join("");
  const draft = panel.createDraft ?? {};
  const errors =
    panel.errorRoleId === "new" ? violations(state.error?.body) : {};
  const createForm = `<form class="card" data-form="admin-client-role-create" data-client-id="${escapeHtml(clientId)}" novalidate><h3>${escapeHtml(text("adminCreateClientRole"))}</h3>${field("name", text("adminClientRoleName"), draft.name ?? "", errors.name, "text", 'maxlength="100" pattern="[A-Za-z0-9._:-]+" required')}${field("description", text("adminClientRoleDescription"), draft.description ?? "", errors.description, "text", 'maxlength="500"')}<div class="actions">${button(text("adminCreateClientRole"), { type: "submit", busy: state.busy === "client-role-create:" + clientId + "", disabled: state.offline || Boolean(state.busy) })}</div></form>`;
  return `<section class="card" data-client-roles-panel="${escapeHtml(clientId)}" aria-label="${escapeHtml(text("adminClientRolesTitle"))}"><h3>${escapeHtml(text("adminClientRolesTitle"))}</h3><form class="actions" data-form="admin-client-role-search" data-client-id="${escapeHtml(clientId)}" role="search"><input name="q" type="search" aria-label="${escapeHtml(text("adminClientRoleName"))}" value="${escapeHtml(panel.query ?? "")}" maxlength="100"/><button class="secondary-button" type="submit" ${state.busy === "client-role-search:" + clientId + "" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "client-role-search:" + clientId + "")}${escapeHtml(text("adminSearchRoleCandidates"))}</button></form>${roles.length ? '<div class="list">' + rows + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("adminClientRoleCrudEmpty")) + "</div>"}${clientPagination(page, "roles")}${createForm}</section>`;
}

async function loadClientRoles(clientId, page, query, busyKey) {
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 1_000_000 ||
    query.length > 100 ||
    state.busy ||
    state.offline ||
    !adminRouteAllowed("client-detail")
  )
    return;
  state.data.clientRoles ??= {};
  const panel = (state.data.clientRoles[clientId] ??= { open: true });
  panel.open = true;
  panel.query = query;
  state.data.clientRolePage = page;
  state.busy = busyKey;
  state.error = null;
  render();
  try {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      size: String(state.data.clientRoleSize ?? 20),
      sort: "name,asc",
    });
    const response = await request(
      `/api/admin/clients/${encodeURIComponent(clientId)}/roles?${params.toString()}`,
    );
    panel.page = { ...response, ...(response.page ?? {}) };
  } catch {
    /* request rendered localized authorization, validation or transport feedback */
  }
  state.busy = null;
  render();
}

async function loadClientRoleAssignmentDetail(
  clientId,
  roleId,
  busyKey,
  existing = {},
) {
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
    !/^[1-9]\d{0,18}$/.test(roleId) ||
    !Number.isSafeInteger(Number(roleId)) ||
    state.busy ||
    state.offline ||
    state.data.adminAccess?.manageClients !== true
  )
    return;
  const key = `${clientId}:${roleId}`;
  state.data.clientRoleAssignments ??= {};
  const assignment = (state.data.clientRoleAssignments[key] = {
    ...existing,
    open: true,
  });
  state.busy = busyKey;
  state.error = null;
  render();
  try {
    const detail = await request(
      `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}?page=0&size=20&sort=username,asc`,
    );
    assignment.users = Array.isArray(detail?.users?.content)
      ? detail.users.content
      : [];
    assignment.groups = Array.isArray(detail?.groups?.content)
      ? detail.groups.content
      : [];
  } catch {
    /* request rendered localized authorization or transport feedback */
  }
  state.busy = null;
  render();
}

// Spring Page serialization uses a nested `page` record; fixtures may use flat metadata.
function clientPageInfo(response, fallbackSize = 10) {
  const content = Array.isArray(response?.content) ? response.content : [];
  const meta = response?.page ?? response ?? {};
  const size =
    Number.isSafeInteger(meta.size) && meta.size > 0 ? meta.size : fallbackSize;
  const total = Number.isSafeInteger(meta.totalElements)
    ? meta.totalElements
    : content.length;
  const pages = Math.max(1, meta.totalPages ?? Math.ceil(total / size));
  const number = Math.max(0, Math.min(meta.number ?? 0, pages - 1));
  return { content, size, total, pages, number };
}

function clientBadge(label, active = false) {
  return `<span class="client-badge ${active ? "is-on" : ""}">${escapeHtml(label)}</span>`;
}

function clientSecurityBadges(client) {
  const flag = (label, active) =>
    clientBadge(
      `${label} ${text(active ? "adminClientOn" : "adminClientOff")}`,
      active,
    );
  return `<div class="client-badges">${flag("PKCE", client.requireProofKey)}${flag("DPoP", client.requireDpop)}${client.requireDpopJkt ? flag("dpop_jkt", true) : ""}${client.dpopRefreshTokenOnly ? clientBadge("DPoP refresh", true) : ""}${clientBadge(`DPoP ${(client.dpopSigningAlgorithms ?? ["RS256", "ES256"]).join("/")}`)}</div>`;
}

function clientPagination(response, kind = "list") {
  const fallbackSize =
    kind === "list"
      ? (state.data.clientSize ?? 10)
      : kind === "roles"
        ? (state.data.clientRoleSize ?? 20)
        : kind === "mappers"
          ? (state.data.clientMapperSize ?? 10)
          : (state.data.clientRelatedSizes?.[kind] ?? 10);
  const info = clientPageInfo(response, fallbackSize);
  const first = info.total ? info.number * info.size + 1 : 0;
  const last = Math.min((info.number + 1) * info.size, info.total);
  const disabled = Boolean(state.busy) || state.offline;
  const control = (label, page, symbol, boundary) =>
    `<button type="button" class="secondary-button admin-pagination-control" data-action="client-page" data-kind="${kind}" data-page="${page}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || boundary ? "disabled" : ""}>${spin(state.busy === `client-page:${kind}:${page}`)}${symbol}</button>`;
  return `<div class="admin-users-pagination" aria-label="${escapeHtml(text("adminPage"))}"><div class="admin-pagination-summary" aria-live="polite"><strong>${first}–${last}</strong><span> / ${info.total}</span></div><div class="admin-pagination-controls"><label>${escapeHtml(text("adminClientRowsPerPage"))} <select data-client-size="${kind}" aria-label="${escapeHtml(text("adminClientRowsPerPage"))}" ${disabled ? "disabled" : ""}>${[10, 20, 50, 100].map((size) => `<option value="${size}" ${size === info.size ? "selected" : ""}>${size}</option>`).join("")}</select>${spin(state.busy === `client-size:${kind}`)}</label>${control(text("adminClientFirstPage"), 0, "«", info.number === 0)}${control(text("adminPrevious"), info.number - 1, "‹", info.number === 0)}<span>${escapeHtml(text("adminPage"))} <strong>${info.number + 1}</strong> / ${info.pages}</span>${control(text("adminNext"), info.number + 1, "›", info.number + 1 >= info.pages)}${control(text("adminClientLastPage"), info.pages - 1, "»", info.number + 1 >= info.pages)}</div></div>`;
}

function clientDeleteControls(client) {
  if (
    !state.data.adminAccess?.manageClients ||
    PLATFORM_CONSOLE_CLIENT_IDS.has(client.clientId)
  )
    return "";
  const id = String(client.id);
  const confirming = state.data.clientDeleteConfirmId === id;
  if (!confirming)
    return button(text("adminDeleteClient"), {
      action: "admin-client-delete-request",
      id,
      danger: true,
      disabled: state.offline || Boolean(state.busy),
    });
  return `<div class="client-confirm" role="alert"><p>${escapeHtml(text("adminDeleteClientPrompt"))}</p><div class="actions">${button(text("adminDeleteClient"), { action: "admin-client-delete-confirm", id, danger: true, busy: state.busy === `client-delete:${id}`, disabled: state.offline || Boolean(state.busy) })}${button(text("cancel"), { action: "admin-client-delete-cancel", id, variant: "secondary", disabled: Boolean(state.busy) })}</div></div>`;
}

function adminClientsContent() {
  const page = clientPageInfo(state.data.clients, state.data.clientSize ?? 10);
  const query = state.data.clientQuery ?? "";
  const sort = state.data.clientSort ?? "clientId,asc";
  const busy = Boolean(state.busy) || state.offline;
  const rows = page.content
    .map((client) => {
      const id = String(client.id);
      const loading = state.busy === `client-open:${id}`;
      const open = (label) =>
        button(label, {
          action: "client-open",
          id,
          busy: loading,
          disabled: busy,
          variant: "primary",
        });
      const viewable = adminRouteAllowed("client-detail");
      const nameControl = viewable
        ? open(client.clientName || client.clientId)
        : `<strong>${escapeHtml(client.clientName || client.clientId)}</strong>`;
      const rowActions = viewable
        ? `<details class="client-menu" ${state.data.clientDeleteConfirmId === id ? "open" : ""}><summary aria-label="${escapeHtml(`${client.clientName} ${text("adminClientActions")}`)}" title="${escapeHtml(text("adminClientActions"))}">⋮</summary><div class="client-menu-items">${button(text("actionEdit"), { action: "client-open", id, icon: "edit", busy: loading, disabled: busy, variant: "secondary" })}${clientDeleteControls(client)}</div></details>`
        : "—";
      return `<tr data-client-id="${escapeHtml(id)}"><td><div class="client-name">${nameControl}</div><code class="client-id muted">${escapeHtml(client.clientId)}</code></td><td><div class="client-badges">${(client.authorizationGrantTypes ?? []).map((grant) => clientBadge(grant)).join("")}</div></td><td><div class="client-badges">${(
        client.scopes ?? []
      )
        .slice(0, 4)
        .map((scope) => clientBadge(scope))
        .join(
          "",
        )}${client.scopes?.length > 4 ? `<span class="muted">+${client.scopes.length - 4}</span>` : ""}</div></td><td>${clientSecurityBadges(client)}</td><td class="client-row-actions">${rowActions}</td></tr>`;
    })
    .join("");
  const sorts = [
    ["clientId,asc", "adminClientSortIdAsc"],
    ["clientId,desc", "adminClientSortIdDesc"],
    ["clientName,asc", "adminClientSortNameAsc"],
    ["clientName,desc", "adminClientSortNameDesc"],
  ];
  return `<section class="card client-list" aria-label="${escapeHtml(text("adminClients"))}"><div class="client-toolbar"><form id="admin-client-search" role="search"><div class="admin-users-search"><button type="submit" class="client-search-button" aria-label="${escapeHtml(text("adminSearchClients"))}" ${busy ? "disabled" : ""}>${state.busy === "clients-search" ? spin(true) : actionIcon("search")}</button><input id="admin-client-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchClients"))}" value="${escapeHtml(state.data.clientSearchDraft ?? query)}" placeholder="${escapeHtml(text("adminSearchClients"))}" maxlength="200"/></div></form><label class="client-sort"><span class="sr-only">${escapeHtml(text("adminClientSort"))}</span><select id="admin-client-sort" aria-label="${escapeHtml(text("adminClientSort"))}" ${busy ? "disabled" : ""}>${sorts.map(([value, key]) => `<option value="${value}" ${sort === value ? "selected" : ""}>${escapeHtml(text(key))}</option>`).join("")}</select>${spin(state.busy === "clients-sort")}</label></div><div class="client-results" role="status">${page.total} ${escapeHtml(text("adminClientResults"))}${query ? `<span class="client-active-search">${escapeHtml(query)} ${button(text("adminClientClearSearch"), { action: "client-clear-search", variant: "secondary", disabled: busy, busy: state.busy === "clients-clear" })}</span>` : ""}</div><div class="client-table-wrap"><table class="client-table"><thead><tr>${["adminClientColumn", "adminClientGrantsColumn", "adminClientScopesColumn", "adminClientSecurity", "adminClientActions"].map((key) => `<th scope="col">${escapeHtml(text(key))}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="5"><div class="empty" role="status">${escapeHtml(text("adminNoClients"))}</div></td></tr>`}</tbody></table></div>${clientPagination(state.data.clients)}</section>`;
}

const CLIENT_DETAIL_TABS = [
  ["settings", "adminClientSettingsTab"],
  ["credentials", "adminClientCredentialsTab"],
  ["scopes", "adminClientScopesTab"],
  ["roles", "adminClientRolesTitle"],
  ["mappers", "adminClientMappersTab"],
  ["evaluation", "adminClientEvaluationTab"],
  ["sessions", "adminSessions"],
  ["consents", "adminConsents"],
  ["events", "adminEvents"],
];

function nativeClientBreadcrumb() {
  if (!["client-detail", "client-create"].includes(state.route)) return "";
  return `<nav class="client-breadcrumb" aria-label="Breadcrumb">${button(text("adminClients"), { action: "client-back", variant: "secondary", disabled: Boolean(state.busy), busy: state.busy === "clients-back" })}<span aria-hidden="true">/</span><span>${escapeHtml(state.route === "client-create" ? text("adminCreateClient") : (state.data.clientConfiguration?.clientName ?? text("loading")))}</span></nav>`;
}

function nativeClientRows() {
  const rows = state.data.clients?.content ?? [];
  const detail = state.data.clientConfiguration;
  return detail && !rows.some((client) => client.id === detail.id)
    ? [...rows, detail]
    : rows;
}

function clientCanUpdate(client = state.data.clientConfiguration) {
  return (
    state.data.adminAccess?.manageClients === true &&
    client?.clientId !== "admin-console"
  );
}

function clientDetailPath() {
  return `/api/admin/clients/${encodeURIComponent(state.data.clientDetailId)}`;
}

function clientDetailHash() {
  return `#/admin/clients/${encodeURIComponent(state.data.clientDetailId)}/${state.data.clientDetailTab ?? "settings"}`;
}

async function loadNativeClientDetail() {
  const id = state.data.clientDetailId;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? ""))
    throw new Error("invalid_client_id");
  if (state.data.clientConfiguration?.id !== id) {
    const { serviceAccountUsername: _username, ...client } =
      await request(clientDetailPath());
    void _username;
    state.data.clientConfiguration = client;
    state.data.clientConfigurationDrafts ??= {};
    state.data.clientConfigurationDrafts[id] = clientConfigurationDraft(client);
  }
  const tab = state.data.clientDetailTab ?? "settings";
  if (tab === "events" && !state.data.adminAccess?.viewEvents) {
    state.data.clientDetailTab = "settings";
    return;
  }
  if (tab === "settings") {
    state.data.clientConfigurationEditId = id;
    state.data.clientConfigurationDrafts ??= {};
    state.data.clientConfigurationDrafts[id] ??= clientConfigurationDraft(
      state.data.clientConfiguration,
    );
  } else if (tab === "scopes") {
    const assignments = await request(
      `${clientDetailPath()}/scope-assignments`,
    );
    state.data.clientScopeAssignments ??= {};
    state.data.clientScopeAssignments[id] = assignments;
    state.data.clientScopeAssignmentDrafts ??= {};
    state.data.clientScopeAssignmentDrafts[id] ??= {
      defaultScopes: [...(assignments.defaultScopes ?? [])],
      optionalScopes: [...(assignments.optionalScopes ?? [])],
    };
    state.data.clientScopeAssignmentsOpenId = id;
  } else if (tab === "mappers") {
    const page = state.data.clientMapperPage ?? 0;
    const size = state.data.clientMapperSize ?? 10;
    const mappers = await request(
      `${clientDetailPath()}/mappers?page=${page}&size=${size}&sort=name,asc`,
    );
    state.data.clientMappers ??= {};
    state.data.clientMappers[id] = mappers.content ?? [];
    state.data.clientMapperResponse = mappers;
    state.data.clientMappersOpenId = id;
  } else if (tab === "roles") {
    const params = new URLSearchParams({
      q: state.data.clientRoles?.[id]?.query ?? "",
      page: String(state.data.clientRolePage ?? 0),
      size: String(state.data.clientRoleSize ?? 20),
      sort: "name,asc",
    });
    const page = await request(`${clientDetailPath()}/roles?${params}`);
    state.data.clientRoles ??= {};
    state.data.clientRoles[id] = {
      ...state.data.clientRoles[id],
      open: true,
      page: { ...page, ...(page.page ?? {}) },
    };
  } else if (["sessions", "consents", "events"].includes(tab)) {
    const page = state.data.clientRelatedPages?.[tab] ?? 0;
    const size = state.data.clientRelatedSizes?.[tab] ?? 10;
    state.data.clientRelated ??= {};
    state.data.clientRelated[tab] = await request(
      `${clientDetailPath()}/${tab}?page=${page}&size=${size}`,
    );
  }
}

function syncNativeClientMapperPage(clientId, delta) {
  if (state.route !== "client-detail" || state.data.clientDetailId !== clientId)
    return;
  const response = state.data.clientMapperResponse;
  const info = clientPageInfo(response, state.data.clientMapperSize ?? 10);
  const total = Math.max(0, info.total + delta);
  state.data.clientMapperResponse = {
    content: state.data.clientMappers[clientId] ?? [],
    page: {
      number: info.number,
      size: info.size,
      totalElements: total,
      totalPages: Math.ceil(total / info.size),
    },
  };
}

function nativeClientCredentials(client) {
  const publicClient = (client.clientAuthenticationMethods ?? []).includes(
    "none",
  );
  const methods = (client.clientAuthenticationMethods ?? [])
    .map((value) => clientBadge(value))
    .join("");
  return `<section class="card"><h2>${escapeHtml(text("adminClientAuthentication"))}</h2>${clientBadge(text(publicClient ? "adminClientPublic" : "adminClientConfidential"))}<dl class="client-facts"><dt>${escapeHtml(text("adminClientAuthenticationMethods"))}</dt><dd><div class="client-badges">${methods}</div></dd><dt>${escapeHtml(text("adminClientSecurity"))}</dt><dd>${clientSecurityBadges(client)}</dd><dt>${escapeHtml(text("adminClientCreatedAt"))}</dt><dd>${escapeHtml(client.clientIdIssuedAt ? new Date(client.clientIdIssuedAt).toLocaleString(state.locale) : "—")}</dd></dl></section>${!publicClient ? `<section class="card"><h2>${escapeHtml(text("adminClientSecretLabel"))}</h2><p>${escapeHtml(text("adminClientExistingSecretHelp"))}</p><p>${escapeHtml(text("adminClientSecretExpires"))}: ${escapeHtml(client.clientSecretExpiresAt ? new Date(client.clientSecretExpiresAt).toLocaleString(state.locale) : text("adminClientNoExpiry"))}</p>${clientCanUpdate(client) ? button(text("adminClientRegenerateSecret"), { action: "client-operation-request", id: "secret", icon: "reset", disabled: state.offline || Boolean(state.busy) }) : ""}</section>` : ""}`;
}

function nativeClientEvaluation() {
  const draft = state.data.clientEvaluationDraft ?? {};
  const result = state.data.clientEvaluation;
  return `<section class="card"><h2>${escapeHtml(text("adminClientEvaluationTab"))}</h2><p class="muted">${escapeHtml(text("adminClientEvaluationHelp"))}</p><form data-form="client-evaluation" novalidate>${field("scopes", text("adminClientRequestedScopes"), draft.scopes ?? "", "", "text", 'maxlength="2000" placeholder="openid profile"')}${field("subject", text("adminClientSubject"), draft.subject ?? "", "", "text", 'maxlength="100"')}<div class="actions">${button(text("adminClientEvaluate"), { type: "submit", busy: state.busy === "client-evaluate", disabled: state.offline || Boolean(state.busy), icon: "search" })}</div></form></section>${result ? `<section class="card"><dl class="client-facts"><dt>${escapeHtml(text("adminClientEffectiveScopes"))}</dt><dd>${escapeHtml((result.effectiveScopes ?? []).join(", ") || "—")}</dd><dt>${escapeHtml(text("adminClientRolesTitle"))}</dt><dd>${escapeHtml((result.roles ?? []).join(", ") || "—")}</dd><dt>${escapeHtml(text("adminClientMappersTab"))}</dt><dd>${escapeHtml((result.mappedClaims ?? []).join(", ") || "—")}</dd><dt>${escapeHtml(text("adminClientClaims"))}</dt><dd><pre>${escapeHtml(JSON.stringify(result.claims ?? {}, null, 2))}</pre></dd></dl></section>` : ""}`;
}

function nativeClientRelated(tab) {
  const response = state.data.clientRelated?.[tab];
  const info = clientPageInfo(
    response,
    state.data.clientRelatedSizes?.[tab] ?? 10,
  );
  const date = (value) =>
    escapeHtml(value ? new Date(value).toLocaleString(state.locale) : "—");
  const allowed =
    tab === "sessions"
      ? state.data.adminAccess?.manageClients
      : tab === "consents" && state.data.adminAccess?.manageConsents;
  let headers;
  const rows = info.content
    .map((item, index) => {
      let cells;
      if (tab === "sessions")
        cells = [
          escapeHtml(item.username ?? "—"),
          date(item.createdAt),
          date(item.lastAccessedAt),
          date(item.expiresAt),
          escapeHtml(item.authorizationCount ?? 0),
        ];
      else if (tab === "consents")
        cells = [
          escapeHtml(item.principalName),
          escapeHtml(item.clientName ?? item.clientId),
          `<div class="client-badges">${(item.authorities ?? []).map((value) => clientBadge(value)).join("")}</div>`,
        ];
      else
        cells = [
          date(item.occurredAt),
          escapeHtml(item.action),
          escapeHtml(item.actor),
          escapeHtml(item.targetId),
        ];
      if (allowed)
        cells.push(
          button(text(tab === "sessions" ? "signOut" : "revokeApplication"), {
            action: "client-operation-request",
            id: `${tab}:${index}`,
            danger: true,
            disabled: state.offline || Boolean(state.busy),
          }),
        );
      return `<tr>${cells.map((value) => `<td>${value}</td>`).join("")}</tr>`;
    })
    .join("");
  if (tab === "sessions")
    headers = [
      "username",
      "adminClientCreatedAt",
      "adminClientLastActive",
      "adminClientExpires",
      "adminClientAuthorizations",
    ];
  else if (tab === "consents")
    headers = ["username", "adminClientColumn", "adminClientGrantedScopes"];
  else
    headers = [
      "adminClientTime",
      "adminClientActions",
      "adminClientActor",
      "adminClientTarget",
    ];
  if (allowed) headers.push("adminClientActions");
  return `<section class="card client-related">${tab === "sessions" && allowed ? `<div class="admin-detail-heading"><h2>${escapeHtml(text("adminSessions"))}</h2>${button(text("adminClientTerminateAll"), { action: "client-operation-request", id: "sessions:all", danger: true, disabled: state.offline || Boolean(state.busy) })}</div>` : ""}<div class="client-table-wrap"><table class="client-related-table"><thead><tr>${headers.map((key) => `<th scope="col">${escapeHtml(text(key))}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}"><div class="empty" role="status">${escapeHtml(text("adminClientEmptyRelated"))}</div></td></tr>`}</tbody></table></div>${clientPagination(response, tab)}</section>`;
}

function adminNativeClientDetail() {
  const client = state.data.clientConfiguration;
  if (!client) return `<div role="status">${escapeHtml(text("loading"))}</div>`;
  const id = String(client.id);
  const tab = state.data.clientDetailTab ?? "settings";
  const canUpdate =
    tab === "settings"
      ? clientCanUpdate(client)
      : state.data.adminAccess?.manageClients === true;
  const tabs = CLIENT_DETAIL_TABS.filter(
    ([key]) => key !== "events" || state.data.adminAccess?.viewEvents,
  );
  let body;
  if (tab === "settings") body = adminClientConfigurationForm(id);
  else if (tab === "credentials") body = nativeClientCredentials(client);
  else if (tab === "scopes") body = clientScopeAssignmentsPanel(id);
  else if (tab === "roles") body = clientRolesPanel(id);
  else if (tab === "mappers")
    body = `${clientMappersPanel(id)}${clientPagination(state.data.clientMapperResponse, "mappers")}`;
  else if (tab === "evaluation") body = nativeClientEvaluation();
  else body = nativeClientRelated(tab);
  // Read-only fieldsets retain readable values while omitting mutation affordances.
  if (!canUpdate && ["settings", "scopes", "roles", "mappers"].includes(tab)) {
    const readOnlyBody = ["settings", "scopes"].includes(tab)
      ? `<fieldset class="client-readonly" disabled>${body}</fieldset>`
      : `<div class="client-viewonly">${body}</div>`;
    body = `<p class="muted" role="status">${escapeHtml(text(tab === "settings" && client.clientId === "admin-console" ? "adminClientReadOnly" : "adminClientViewer"))}</p>${readOnlyBody}`;
  }
  const confirm = state.data.clientOperation;
  const confirmation = confirm
    ? `<section class="card client-confirm" role="alert"><p>${escapeHtml(text(confirm === "secret" ? "adminClientRegenerateConfirm" : "adminClientConfirmAction"))}</p><div class="actions">${button(text(confirm === "secret" ? "adminClientRegenerateSecret" : "continue"), { action: "client-operation-confirm", danger: confirm !== "secret", busy: state.busy === "client-operation", disabled: state.offline || Boolean(state.busy) })}${button(text("cancel"), { action: "client-operation-cancel", variant: "secondary", disabled: Boolean(state.busy) })}</div></section>`
    : "";
  const secret = state.data.clientRegeneratedSecret;
  const secretPanel = secret
    ? `<section class="card notice warning"><h2>${escapeHtml(text("adminClientSecretOneTime"))}</h2><p>${escapeHtml(text("adminClientSecretOneTimeHelp"))}</p><code data-one-time-client-secret="true">${escapeHtml(secret)}</code>${button(text("adminClientSecretDone"), { action: "client-secret-dismiss", variant: "secondary" })}</section>`
    : "";
  return `<div class="client-detail" data-client-detail="${escapeHtml(id)}">${clientDeleteControls(client) ? `<div class="client-detail-meta">${clientDeleteControls(client)}</div>` : ""}<nav class="admin-user-detail-tabs" aria-label="${escapeHtml(text("adminClients"))}">${tabs.map(([key, label]) => `<button type="button" class="admin-user-detail-tab ${tab === key ? "is-active" : ""}" data-action="client-tab" data-id="${key}" aria-current="${tab === key ? "page" : "false"}" ${state.busy ? "disabled" : ""}>${spin(state.busy === `client-tab:${key}`)}${escapeHtml(text(label))}</button>`).join("")}</nav>${confirmation}${secretPanel}<div class="client-tab-content">${body}</div></div>`;
}

async function clientReload(busyKey, keepContent = true) {
  state.busy = busyKey;
  try {
    await loadRoute({ keepContent });
  } finally {
    state.busy = null;
    render();
  }
}

function focusNativeClientHeading(scrollTop = 0) {
  const heading = document.querySelector(".main h1");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = scrollTop;
    document.scrollingElement.scrollLeft = 0;
  }
}

async function openNativeClient(id) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !adminRouteAllowed("client-detail"))
    return;
  state.data.clientListScroll = document.scrollingElement?.scrollTop ?? 0;
  state.notice = null;
  state.data.clientDetailId = id;
  state.data.clientDetailTab = "settings";
  state.data.clientConfiguration = null;
  state.data.clientEvaluation = null;
  state.data.clientEvaluationDraft = {};
  state.data.clientRelatedPages = {};
  state.data.clientRelatedSizes = {};
  state.data.clientRelated = {};
  state.data.clientMapperPage = 0;
  state.data.clientMapperSize = 10;
  state.data.clientRolePage = 0;
  state.data.clientMapperEditor = null;
  state.data.clientMapperDeleteConfirm = null;
  state.data.clientDeleteConfirmId = null;
  state.data.clientRoleCompositions = {};
  state.data.clientRoleAssignments = {};
  delete state.data.clientScopeAssignmentDrafts?.[id];
  state.data.clientOperation = null;
  state.data.clientRegeneratedSecret = null;
  delete state.data.clientConfigurationDrafts?.[id];
  state.busy = `client-open:${id}`;
  state.error = null;
  render();
  try {
    await loadNativeClientDetail();
    state.route = "client-detail";
    window.history.pushState(null, "", clientDetailHash());
  } catch {
    /* Keep the list available with the shared request error and retry action. */
  } finally {
    state.busy = null;
    render();
    if (state.route === "client-detail") focusNativeClientHeading();
  }
}

async function confirmNativeClientOperation() {
  const operation = state.data.clientOperation;
  if (!operation) return;
  const [kind, index] = operation.split(":");
  let path;
  if (kind === "secret" && clientCanUpdate())
    path = `${clientDetailPath()}/secret`;
  else if (kind === "sessions" && state.data.adminAccess?.manageClients) {
    const session =
      state.data.clientRelated?.sessions?.content?.[Number(index)];
    if (index === "all") path = `${clientDetailPath()}/sessions`;
    else if (session)
      path = `${clientDetailPath()}/sessions/${encodeURIComponent(session.id)}`;
  } else if (kind === "consents" && state.data.adminAccess?.manageConsents) {
    const consent =
      state.data.clientRelated?.consents?.content?.[Number(index)];
    if (consent)
      path = `/api/admin/consents/${encodeURIComponent(consent.clientId)}/${encodeURIComponent(consent.principalName)}`;
  }
  if (!path) return;
  state.busy = "client-operation";
  state.error = null;
  render();
  try {
    const response = await request(path, {
      method: kind === "secret" ? "POST" : "DELETE",
    });
    state.data.clientOperation = null;
    if (kind === "secret")
      state.data.clientRegeneratedSecret = response.clientSecret;
    else {
      state.data.clientRelatedPages ??= {};
      state.data.clientRelatedPages[kind] = 0;
      await loadNativeClientDetail();
    }
    state.notice = text("adminClientOperationComplete");
  } catch {
    /* The shared request handler renders localized feedback. */
  } finally {
    state.busy = null;
    render();
  }
}

function requestNativeClientOperation(operation) {
  if (
    operation === "secret" &&
    (!clientCanUpdate() ||
      state.data.clientConfiguration.clientAuthenticationMethods.includes(
        "none",
      ))
  )
    return;
  if (
    operation.startsWith("sessions:") &&
    !state.data.adminAccess?.manageClients
  )
    return;
  if (
    operation.startsWith("consents:") &&
    !state.data.adminAccess?.manageConsents
  )
    return;
  if (!/^(secret|sessions:(all|[0-9]+)|consents:[0-9]+)$/.test(operation))
    return;
  state.data.clientOperation = operation;
  render();
}

async function selectNativeClientTab(tab) {
  if (
    !CLIENT_DETAIL_TABS.some(([key]) => key === tab) ||
    (tab === "events" && !state.data.adminAccess?.viewEvents)
  )
    return;
  preserveOfflineDrafts();
  state.notice = null;
  state.data.clientDetailTab = tab;
  state.data.clientOperation = null;
  state.data.clientRegeneratedSecret = null;
  window.history.pushState(null, "", clientDetailHash());
  await clientReload(`client-tab:${tab}`);
  document
    .querySelector(`[data-action="client-tab"][data-id="${tab}"]`)
    ?.focus({ preventScroll: true });
}

async function changeNativeClientPage(kind, page) {
  if (!Number.isSafeInteger(page) || page < 0 || page > 1_000_000) return;
  if (kind === "list") state.data.clientPage = page;
  else if (kind === "mappers") state.data.clientMapperPage = page;
  else if (kind === "roles") state.data.clientRolePage = page;
  else if (["sessions", "consents", "events"].includes(kind)) {
    state.data.clientRelatedPages ??= {};
    state.data.clientRelatedPages[kind] = page;
  } else return;
  await clientReload(`client-page:${kind}:${page}`);
}

async function clientAction(name, element) {
  if (state.busy || state.offline) return;
  switch (name) {
    case "client-open":
      return openNativeClient(element.dataset.id ?? "");
    case "client-back":
      state.data.clientRegeneratedSecret = null;
      state.route = "clients";
      window.history.pushState(null, "", "#/admin/clients");
      state.notice = null;
      await clientReload("clients-back", false);
      focusNativeClientHeading(state.data.clientListScroll ?? 0);
      return;
    case "client-tab":
      return selectNativeClientTab(element.dataset.id);
    case "client-clear-search":
      state.data.clientQuery = "";
      state.data.clientSearchDraft = "";
      state.data.clientPage = 0;
      return clientReload("clients-clear");
    case "client-page":
      return changeNativeClientPage(
        element.dataset.kind,
        Number(element.dataset.page),
      );
    case "client-operation-request":
      return requestNativeClientOperation(element.dataset.id ?? "");
    case "client-operation-cancel":
      state.data.clientOperation = null;
      render();
      return;
    case "client-secret-dismiss":
      state.data.clientRegeneratedSecret = null;
      render();
      return;
    case "client-operation-confirm":
      return confirmNativeClientOperation();
    default:
      return;
  }
}

function bindNativeClients() {
  document
    .getElementById("admin-client-query")
    ?.addEventListener("input", (event) => {
      state.data.clientSearchDraft = event.target.value;
      clearTimeout(adminClientSearchTimer);
      const search = () => {
        if (state.route !== "clients" || state.offline) return;
        if (state.busy) {
          adminClientSearchTimer = setTimeout(search, 100);
          return;
        }
        if (
          (state.data.clientSearchDraft ?? "").trim() !==
          (state.data.clientQuery ?? "")
        )
          document.getElementById("admin-client-search")?.requestSubmit();
      };
      adminClientSearchTimer = setTimeout(search, 300);
    });
  document
    .getElementById("admin-client-sort")
    ?.addEventListener("change", (event) => {
      if (state.busy || state.offline) return;
      state.data.clientSort = event.target.value;
      state.data.clientPage = 0;
      void clientReload("clients-sort");
    });
  document.querySelectorAll("[data-client-size]").forEach((control) =>
    control.addEventListener("change", (event) => {
      if (state.busy || state.offline) return;
      const size = Number(event.target.value);
      const kind = event.target.dataset.clientSize;
      if (![10, 20, 50, 100].includes(size)) return;
      if (kind === "list") {
        state.data.clientSize = size;
        state.data.clientPage = 0;
      } else if (kind === "mappers") {
        state.data.clientMapperSize = size;
        state.data.clientMapperPage = 0;
      } else if (kind === "roles") {
        state.data.clientRoleSize = size;
        state.data.clientRolePage = 0;
      } else {
        state.data.clientRelatedSizes ??= {};
        state.data.clientRelatedPages ??= {};
        state.data.clientRelatedSizes[kind] = size;
        state.data.clientRelatedPages[kind] = 0;
      }
      void clientReload(`client-size:${kind}`);
    }),
  );
  document.querySelectorAll(".client-menu").forEach((menu) => {
    const summary = menu.querySelector("summary");
    menu.addEventListener("toggle", () => {
      if (!menu.isConnected || !menu.open) return;
      document.querySelectorAll(".client-menu[open]").forEach((other) => {
        if (other !== menu) other.open = false;
      });
      const rect = summary.getBoundingClientRect();
      const popup = menu.querySelector(".client-menu-items");
      popup.style.left = `${Math.max(8, Math.min(rect.right - popup.offsetWidth, window.innerWidth - popup.offsetWidth - 8))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - popup.offsetHeight - 8))}px`;
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.open = false;
        summary.focus();
      }
    });
  });
  const form = document.querySelector(
    '[data-form="admin-client-configuration"]',
  );
  form?.addEventListener("input", (event) => {
    const control = event.target;
    const group = control.closest(".field");
    if (group) {
      const feedback = group.querySelector(".field-error");
      if (feedback) feedback.textContent = "";
    }
    control.setAttribute("aria-invalid", "false");
    if (state.error?.body?.violations)
      state.error.body.violations = state.error.body.violations.filter(
        (item) => item.field !== control.name,
      );
  });
  document
    .querySelectorAll('[data-form="client-evaluation"] input')
    .forEach((control) =>
      control.addEventListener("input", () => {
        state.data.clientEvaluationDraft = formValues(
          document.querySelector('[data-form="client-evaluation"]'),
        );
      }),
    );
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
      ? `<form class="card" data-form="admin-provider-mapper" data-provider-id="${escapeHtml(providerId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h3>${escapeHtml(
          text(
            chooseLazy(
              mapperId,
              () => "adminEditProviderMapper",
              () => "adminCreateProviderMapper",
            ),
          ),
        )}</h3>${field("name", text("adminProviderMapperName"), draft.name ?? selectedMapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("sourceClaim", text("adminProviderMapperSource"), draft.sourceClaim ?? selectedMapper?.sourceClaim ?? "", errors.sourceClaim, "text", 'maxlength="200" required')}${field("target", text("adminProviderMapperTarget"), draft.target ?? selectedMapper?.target ?? "", errors.target, "text", 'maxlength="200" required')}<div class="field"><label for="provider-mapper-type">${escapeHtml(text("adminProviderMapperType"))}</label><select id="provider-mapper-type" name="mapperType"><option value="user-attribute" ${chooseLazy(
          (draft.mapperType ??
            selectedMapper?.mapperType ??
            "user-attribute") === "user-attribute",
          () => "selected",
          () => "",
        )}>user-attribute</option><option value="claim" ${chooseLazy(
          (draft.mapperType ?? selectedMapper?.mapperType) === "claim",
          () => "selected",
          () => "",
        )}>claim</option><option value="role" ${chooseLazy(
          (draft.mapperType ?? selectedMapper?.mapperType) === "role",
          () => "selected",
          () => "",
        )}>role</option><option value="group" ${chooseLazy(
          (draft.mapperType ?? selectedMapper?.mapperType) === "group",
          () => "selected",
          () => "",
        )}>group</option></select><div class="field-error">${escapeHtml(errors.mapperType ?? "")}</div></div><div class="field"><label for="provider-mapper-sync-mode">${escapeHtml(text("adminProviderMapperSyncMode"))}</label><select id="provider-mapper-sync-mode" name="syncMode"><option value="inherit" ${chooseLazy(
          (draft.syncMode ?? selectedMapper?.syncMode ?? "inherit") ===
            "inherit",
          () => "selected",
          () => "",
        )}>inherit</option><option value="legacy" ${chooseLazy(
          (draft.syncMode ?? selectedMapper?.syncMode) === "legacy",
          () => "selected",
          () => "",
        )}>legacy</option><option value="import" ${chooseLazy(
          (draft.syncMode ?? selectedMapper?.syncMode) === "import",
          () => "selected",
          () => "",
        )}>import</option><option value="read_only" ${chooseLazy(
          (draft.syncMode ?? selectedMapper?.syncMode) === "read_only",
          () => "selected",
          () => "",
        )}>read_only</option><option value="force" ${chooseLazy(
          (draft.syncMode ?? selectedMapper?.syncMode) === "force",
          () => "selected",
          () => "",
        )}>force</option></select><div class="field-error">${escapeHtml(errors.syncMode ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="addToIdToken" ${chooseLazy(
          draft.addToIdToken ?? selectedMapper?.addToIdToken,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${chooseLazy(
          draft.addToAccessToken ?? selectedMapper?.addToAccessToken,
          () => "checked",
          () => "",
        )}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy: formBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-provider-mapper-editor-cancel" data-provider="${escapeHtml(providerId)}" ${chooseLazy(
          state.busy,
          () => "disabled",
          () => "",
        )}>${escapeHtml(text("cancel"))}</button></div></form>`
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
              "provider-mapper-delete:" + providerId + ":" + mapper.id + "";
            const controls = chooseLazy(
              confirming,
              () =>
                '<div class="actions"><span role="status">' +
                escapeHtml(text("adminDeleteProviderMapperPrompt")) +
                "</span>" +
                button(text("adminDeleteProviderMapper"), {
                  action: "admin-provider-mapper-delete-confirm",
                  provider: providerId,
                  id: mapper.id,
                  danger: true,
                  busy,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                '<button class="secondary-button" type="button" data-action="admin-provider-mapper-delete-cancel" data-provider="' +
                escapeHtml(providerId) +
                '" data-id="' +
                escapeHtml(mapper.id) +
                '" ' +
                chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("cancel")) +
                "</button></div>",
              () =>
                '<div class="actions">' +
                button(text("adminEditProviderMapper"), {
                  action: "admin-provider-mapper-edit",
                  provider: providerId,
                  id: mapper.id,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                "" +
                button(text("adminDeleteProviderMapper"), {
                  action: "admin-provider-mapper-delete-request",
                  provider: providerId,
                  id: mapper.id,
                  danger: true,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                "</div>",
            );
            return (
              '<article class="list-item" data-provider-mapper-id="' +
              escapeHtml(mapper.id) +
              '"><div><strong>' +
              escapeHtml(mapper.name) +
              '</strong><span class="muted">' +
              escapeHtml(
                "" +
                  mapper.sourceClaim +
                  " → " +
                  mapper.target +
                  " · " +
                  mapper.mapperType +
                  "",
              ) +
              "</span></div><span>" +
              escapeHtml(mapper.syncMode) +
              "</span>" +
              controls +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty" role="status">' +
        escapeHtml(text("adminNoProviderMappers")) +
        "</div>"
  }</div><div class="actions">${addMapperButton}</div>${mapperEditor}</section>`;
}

function adminIdentityProvidersContent() {
  const page = state.data.identityProviders ?? {
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  };
  const providers = Array.isArray(page.content) ? page.content : [];
  const query = state.data.identityProviderQuery ?? "";
  const currentPage = Number(page.number ?? 0);
  const totalPages = Number(page.totalPages ?? 0);
  const sort = state.data.identityProviderSort ?? "guiOrder,asc";
  const size = Number(state.data.identityProviderSize ?? 10);
  const rows = providers
    .map((provider) => {
      const id = String(provider.id ?? "");
      const displayName = String(provider.displayName || provider.alias || "");
      const alias = String(provider.alias ?? "");
      const showAlias =
        alias && alias.toLocaleLowerCase() !== displayName.toLocaleLowerCase();
      const confirming = state.data.identityProviderDeleteConfirmId === id;
      const actions = confirming
        ? `<dialog class="native-modal" open aria-labelledby="identity-provider-delete-title"><h2 id="identity-provider-delete-title">${escapeHtml(text("adminDeleteIdentityProvider"))}</h2><p role="status">${escapeHtml(text("adminDeleteIdentityProviderPrompt"))}</p><div class="actions">${button(text("adminDeleteIdentityProvider"), { action: "admin-identity-provider-delete-confirm", id, danger: true, busy: state.busy === `identity-provider-delete:${id}`, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-identity-provider-delete-cancel" data-id="${escapeHtml(id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></dialog>`
        : `<details class="admin-user-menu"><summary aria-label="${escapeHtml(provider.displayName)} · ${escapeHtml(text("adminScopeActions"))}">${actionIcon("more")}</summary><div class="admin-user-menu-panel"><button type="button" data-action="admin-provider-open" data-id="${escapeHtml(id)}">${actionIcon("edit")}${escapeHtml(text("adminEditProviderConnection"))}</button><button type="button" data-action="admin-identity-provider-delete-request" data-id="${escapeHtml(id)}">${actionIcon("delete")}${escapeHtml(text("adminDeleteIdentityProvider"))}</button></div></details>`;
      return `<tr><td><a class="provider-link" href="#/admin/identity-providers/${encodeURIComponent(id)}/details" data-action="admin-provider-open" data-id="${escapeHtml(id)}"><span class="provider-icon" aria-hidden="true">${providerIconMarkup(provider.iconKey)}</span><span class="provider-label"><strong>${escapeHtml(displayName)}</strong>${showAlias ? `<small class="provider-alias">${escapeHtml(alias)}</small>` : ""}</span></a></td><td>${escapeHtml(provider.providerType)}</td><td><span class="provider-status ${provider.enabled ? "is-enabled" : "is-disabled"}">${escapeHtml(text(provider.enabled ? "adminProviderEnabled" : "adminProviderDisabled"))}</span>${provider.configured ? ` <span class="provider-status is-configured">${escapeHtml(text("adminConfigured"))}</span>` : ""}</td><td>${Number(provider.mapperCount ?? 0)}</td><td class="text-end">${actions}</td></tr>`;
    })
    .join("");
  const busy = Boolean(state.busy);
  const totalElements = Number(page.totalElements ?? providers.length);
  const firstRecord = totalElements ? currentPage * size + 1 : 0;
  const lastRecord = Math.min((currentPage + 1) * size, totalElements);
  const pageButton = (pageIndex, iconName, label, isBusy, disabled) =>
    `<button class="provider-page-button" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" data-identity-provider-page="${pageIndex}" ${disabled || pageIndex < 0 || pageIndex >= totalPages || busy ? "disabled" : ""} ${isBusy ? 'aria-busy="true"' : ""}>${spin(isBusy) || actionIcon(iconName)}</button>`;
  return `<section class="identity-provider-page" aria-label="${escapeHtml(text("adminIdentityProviders"))}"><section class="card provider-table-card"><form id="admin-identity-provider-search" class="resource-filters" role="search"><div class="provider-filter-row"><div class="provider-search-input"><label class="visually-hidden" for="admin-identity-provider-query">${escapeHtml(text("adminSearchIdentityProviders"))}</label><span class="provider-search-icon" aria-hidden="true">${state.busy === "identity-providers-search" ? spin(true) : providerSearchIconMarkup}</span><input id="admin-identity-provider-query" name="q" type="search" value="${escapeHtml(query)}" placeholder="${escapeHtml(text("adminSearchIdentityProviders"))}" maxlength="200"/></div><label class="visually-hidden" for="admin-identity-provider-sort">${escapeHtml(text("adminSort"))}</label><select id="admin-identity-provider-sort" class="provider-sort-select" name="sort" aria-label="${escapeHtml(text("adminSort"))}"><option value="guiOrder,asc" ${sort === "guiOrder,asc" ? "selected" : ""}>${escapeHtml(text("adminProviderSortOrder"))} · A–Z</option><option value="displayName,asc" ${sort === "displayName,asc" ? "selected" : ""}>${escapeHtml(text("adminProviderDisplayName"))} · A–Z</option><option value="displayName,desc" ${sort === "displayName,desc" ? "selected" : ""}>${escapeHtml(text("adminProviderDisplayName"))} · Z–A</option></select></div><div class="provider-active-filters"><span class="provider-result-count">${totalElements} ${escapeHtml(text("adminRecords"))}</span>${query ? `<span class="provider-active-filter">${escapeHtml(text("adminSearch"))}: ${escapeHtml(query)}</span><button class="provider-clear-filter" type="button" data-action="admin-provider-clear-filters" ${busy ? "disabled" : ""}>${escapeHtml(text("adminClearFilters"))}</button>` : ""}</div></form><div class="table-scroll"><table class="admin-data-table"><thead><tr><th>${escapeHtml(text("adminProviderNameColumn"))}</th><th>${escapeHtml(text("adminProviderTypeColumn"))}</th><th>${escapeHtml(text("adminProviderStatus"))}</th><th>${escapeHtml(text("adminProviderMappersColumn"))}</th><th><span class="visually-hidden">${escapeHtml(text("adminScopeActions"))}</span></th></tr></thead><tbody>${rows || `<tr><td colspan="5"><div class="empty" role="status">${escapeHtml(text("adminNoIdentityProviders"))}</div></td></tr>`}</tbody></table></div>${totalElements ? `<div class="table-pagination"><div class="provider-pagination-summary"><strong>${firstRecord}–${lastRecord}</strong><span> / ${totalElements}</span></div><div class="provider-pagination-controls"><div class="provider-page-size"><label for="admin-identity-provider-size">${escapeHtml(text("adminRowsPerPage"))}</label><select id="admin-identity-provider-size"><option ${size === 10 ? "selected" : ""}>10</option><option ${size === 20 ? "selected" : ""}>20</option><option ${size === 50 ? "selected" : ""}>50</option><option ${size === 100 ? "selected" : ""}>100</option></select></div>${pageButton(0, "firstPage", text("adminProviderFirstPage"), state.busy === "identity-providers-page-first", currentPage === 0)}${pageButton(currentPage - 1, "previousPage", text("adminPrevious"), state.busy === "identity-providers-page-prev", currentPage === 0)}<span class="provider-page-indicator">${escapeHtml(text("adminPage"))} <strong>${currentPage + 1}</strong> / ${Math.max(totalPages, 1)}</span>${pageButton(currentPage + 1, "nextPage", text("adminNext"), state.busy === "identity-providers-page-next", currentPage + 1 >= totalPages)}${pageButton(Math.max(totalPages - 1, 0), "lastPage", text("adminProviderLastPage"), state.busy === "identity-providers-page-last", currentPage + 1 >= totalPages)}</div></div>` : ""}</section></section>`;
}

function reloadIdentityProviderList(query, sort, preserveSearchFocus = false) {
  if (state.busy) return;
  const searchInput = document.getElementById("admin-identity-provider-query");
  const selectionStart = preserveSearchFocus
    ? searchInput?.selectionStart
    : null;
  state.data.identityProviderQuery = String(query ?? "").trim();
  state.data.identityProviderSort = String(sort ?? "guiOrder,asc");
  state.data.identityProviderPage = 0;
  state.busy = "identity-providers-search";
  void loadRoute({ keepContent: true }).finally(() => {
    state.busy = null;
    render();
    if (!preserveSearchFocus) return;
    const nextInput = document.getElementById("admin-identity-provider-query");
    nextInput?.focus();
    if (nextInput && selectionStart !== null)
      nextInput.setSelectionRange(selectionStart, selectionStart);
  });
}

function identityProviderDetailContent(id, tab) {
  const creating = id === "new";
  const provider = creating
    ? null
    : (state.data.identityProviders?.content ?? []).find(
        (item) => String(item.id) === String(id),
      );
  const providerId = creating ? "" : String(id ?? "");
  const activeTab = tab === "mappers" ? "mappers" : "details";
  const detailHref = creating
    ? "#/admin/identity-providers/new"
    : `#/admin/identity-providers/${encodeURIComponent(providerId)}/details`;
  const mapperHref = `#/admin/identity-providers/${encodeURIComponent(providerId)}/mappers`;
  if (!creating && !provider)
    return `<section class="card"><div class="empty" role="status">${escapeHtml(text("adminIdentityProvidersLoadError"))}</div><a class="secondary-button" href="#/admin/identity-providers" data-action="admin-provider-list">${escapeHtml(text("adminIdentityProviders"))}</a></section>`;
  if (creating && activeTab === "mappers") return "";
  const isSaml = creating
    ? state.data.identityProviderCreateType === "saml"
    : provider.providerType === "saml";
  const form = isSaml
    ? samlIdentityProviderConfigurationForm(creating ? "new-saml" : providerId)
    : identityProviderConfigurationForm(creating ? "new" : providerId);
  const mapperPage = state.data.identityProviderMapperPages?.[providerId] ?? {
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  };
  const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
  const mapperEditor =
    state.data.providerMapperEditor?.providerId === providerId
      ? renderProviderMapperDialog(providerId)
      : "";
  const mapperRows = mappers
    .map((mapper) => {
      const confirming =
        state.data.providerMapperDeleteConfirm?.providerId === providerId &&
        state.data.providerMapperDeleteConfirm?.mapperId === mapper.id;
      return `<tr data-provider-mapper-id="${escapeHtml(mapper.id)}"><td>${escapeHtml(mapper.name)}</td><td>${escapeHtml(mapper.sourceClaim)}</td><td>${escapeHtml(mapper.target)}</td><td><span class="status-badge is-muted">${escapeHtml(mapper.mapperType)}</span></td><td class="text-end"><details class="admin-user-menu"><summary aria-label="${escapeHtml(mapper.name)} · ${escapeHtml(text("adminScopeActions"))}">${actionIcon("more")}</summary><div class="admin-user-menu-panel"><button type="button" data-action="admin-provider-mapper-edit" data-provider="${escapeHtml(providerId)}" data-id="${escapeHtml(mapper.id)}">${actionIcon("edit")}${escapeHtml(text("adminEditProviderMapper"))}</button><button type="button" data-action="admin-provider-mapper-delete-request" data-provider="${escapeHtml(providerId)}" data-id="${escapeHtml(mapper.id)}">${actionIcon("delete")}${escapeHtml(text("adminDeleteProviderMapper"))}</button></div></details>${confirming ? `<div class="confirm-panel" role="alert">${escapeHtml(text("adminDeleteProviderMapperPrompt"))}${button(text("adminDeleteProviderMapper"), { action: "admin-provider-mapper-delete-confirm", provider: providerId, id: mapper.id, danger: true, busy: state.busy === `provider-mapper-delete:${providerId}:${mapper.id}`, disabled: state.offline || Boolean(state.busy) })}<button type="button" class="secondary-button" data-action="admin-provider-mapper-delete-cancel" data-provider="${escapeHtml(providerId)}" data-id="${escapeHtml(mapper.id)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div>` : ""}</td></tr>`;
    })
    .join("");
  const mapperTotal = Number(mapperPage.totalElements ?? mappers.length);
  const mapperSize = Number(state.data.identityProviderMapperSize ?? 10);
  const mapperCurrentPage = Number(
    mapperPage.number ?? state.data.identityProviderMapperPage ?? 0,
  );
  const mapperTotalPages = Number(mapperPage.totalPages ?? 0);
  const mapperFirstRecord = mapperTotal
    ? mapperCurrentPage * mapperSize + 1
    : 0;
  const mapperLastRecord = Math.min(
    (mapperCurrentPage + 1) * mapperSize,
    mapperTotal,
  );
  const mapperPageButton = (page, icon, label, direction, busy, disabled) =>
    `<button class="provider-page-button" type="button" data-provider-mapper-page="${page}" data-provider-mapper-page-kind="${direction}" aria-label="${escapeHtml(text(label))}" title="${escapeHtml(text(label))}" ${disabled || state.busy ? "disabled" : ""} ${busy ? 'aria-busy="true"' : ""}>${spin(busy) || actionIcon(icon)}</button>`;
  const tabBody =
    activeTab === "details"
      ? `<div class="identity-provider-form-layout">${creating ? `<div class="field"><label for="identity-provider-create-type">${escapeHtml(text("adminProviderType"))}</label><select id="identity-provider-create-type" data-provider-create-type><option value="oidc" ${!isSaml ? "selected" : ""}>${escapeHtml(text("adminProviderType"))} · OIDC</option><option value="saml" ${isSaml ? "selected" : ""}>${escapeHtml(text("adminProviderType"))} · SAML</option></select></div>` : ""}${form}${creating || !isSaml ? "" : identityProviderPolicyForm(providerId)}</div>`
      : `<section class="card provider-mappers-card" aria-label="${escapeHtml(text("adminProviderMappers"))}"><div class="admin-detail-heading"><h2>${escapeHtml(text("adminProviderMappers"))}</h2>${button(text("adminAddProviderMapper"), { action: "admin-provider-mapper-create", provider: providerId, icon: "add", disabled: state.offline || Boolean(state.busy) })}</div><div class="provider-mappers-table-surface"><div id="admin-provider-mapper-search" class="provider-mapper-resource-filters" role="search"><div class="provider-mapper-filter-row"><label class="provider-mapper-search-input"><span class="visually-hidden">${escapeHtml(text("adminProviderMapperSearch"))}</span><span class="provider-search-icon" aria-hidden="true">${state.busy === "provider-mappers-search" ? spin(true) : providerSearchIconMarkup}</span><input name="q" type="search" aria-label="${escapeHtml(text("adminProviderMapperSearch"))}" placeholder="${escapeHtml(text("adminProviderMapperSearch"))}" value="${escapeHtml(state.data.identityProviderMapperQuery ?? "")}" maxlength="200" ${state.busy ? "disabled" : ""}/></label><select id="admin-provider-mapper-sort" class="provider-mapper-sort-select" name="sort" aria-label="${escapeHtml(text("adminSort"))}" ${state.busy ? "disabled" : ""}><option value="name,asc" ${(state.data.identityProviderMapperSort ?? "name,asc") === "name,asc" ? "selected" : ""}>${escapeHtml(text("adminProviderMapperName"))} · A–Z</option><option value="sourceClaim,asc" ${(state.data.identityProviderMapperSort ?? "name,asc") === "sourceClaim,asc" ? "selected" : ""}>${escapeHtml(text("adminProviderMapperSource"))} · A–Z</option></select></div><div class="provider-mapper-result-count">${mapperTotal} ${escapeHtml(text("adminRecords"))}${state.data.identityProviderMapperQuery ? `<span class="provider-mapper-active-filter">${escapeHtml(text("adminSearch"))}: ${escapeHtml(state.data.identityProviderMapperQuery)}</span><button class="provider-mapper-clear-filter" type="button" data-action="admin-provider-mapper-clear" ${state.busy ? "disabled" : ""}>${escapeHtml(text("adminClearFilters"))}</button>` : ""}</div></div><div class="table-scroll"><table class="admin-data-table"><thead><tr><th>${escapeHtml(text("adminProviderMapperName"))}</th><th>${escapeHtml(text("adminProviderMapperSource"))}</th><th>${escapeHtml(text("adminProviderMapperTarget"))}</th><th>${escapeHtml(text("adminProviderMapperType"))}</th><th><span class="visually-hidden">${escapeHtml(text("adminScopeActions"))}</span></th></tr></thead><tbody>${mapperRows}</tbody></table>${mapperRows ? "" : `<div class="empty provider-mapper-empty" role="status">${escapeHtml(text("adminNoProviderMappers"))}</div>`}</div>${mapperTotal ? `<div class="provider-mapper-pagination"><div class="provider-pagination-summary"><strong>${mapperFirstRecord}–${mapperLastRecord}</strong><span> / ${mapperTotal}</span></div><div class="provider-pagination-controls"><div class="provider-page-size"><label for="admin-provider-mapper-size">${escapeHtml(text("adminRowsPerPage"))}</label><select id="admin-provider-mapper-size" ${state.busy ? "disabled" : ""}><option ${mapperSize === 10 ? "selected" : ""}>10</option><option ${mapperSize === 20 ? "selected" : ""}>20</option><option ${mapperSize === 50 ? "selected" : ""}>50</option><option ${mapperSize === 100 ? "selected" : ""}>100</option></select></div>${mapperPageButton(0, "firstPage", "adminProviderFirstPage", "first", state.busy === "provider-mappers-page-first", mapperCurrentPage <= 0)}${mapperPageButton(mapperCurrentPage - 1, "previousPage", "adminPrevious", "prev", state.busy === "provider-mappers-page-prev", mapperCurrentPage <= 0)}<span class="provider-page-indicator">${escapeHtml(text("adminPage"))} <strong>${mapperCurrentPage + 1}</strong> / ${Math.max(mapperTotalPages, 1)}</span>${mapperPageButton(mapperCurrentPage + 1, "nextPage", "adminNext", "next", state.busy === "provider-mappers-page-next", mapperCurrentPage + 1 >= mapperTotalPages)}${mapperPageButton(Math.max(mapperTotalPages - 1, 0), "lastPage", "adminProviderLastPage", "last", state.busy === "provider-mappers-page-last", mapperCurrentPage + 1 >= mapperTotalPages)}</div></div>` : ""}</div>${mapperEditor}</section>`;
  return `<div class="identity-provider-screen"><nav class="admin-breadcrumb" aria-label="${escapeHtml(text("adminBreadcrumb"))}"><a href="#/admin/identity-providers" data-action="admin-provider-list">${escapeHtml(text("adminIdentityProviders"))}</a>${creating ? `<span aria-current="page">${escapeHtml(text("adminCreateProvider"))}</span>` : `<span aria-current="page">${escapeHtml(provider.displayName)}</span>`}</nav><nav class="detail-tabs" aria-label="${escapeHtml(text("adminIdentityProviders"))}"><a class="${activeTab === "details" ? "active" : ""}" href="${detailHref}" data-action="admin-provider-tab" data-tab="details">${escapeHtml(text("adminProviderDetailsTab"))}</a>${creating ? "" : `<a class="${activeTab === "mappers" ? "active" : ""}" href="${mapperHref}" data-action="admin-provider-tab" data-tab="mappers">${escapeHtml(text("adminProviderMappers"))}</a>`}</nav>${tabBody}</div>`;
}

function renderProviderMapperDialog(providerId) {
  const editor = state.data.providerMapperEditor;
  const mappers = state.data.identityProviderMappers?.[providerId] ?? [];
  const mapperId = editor?.mapperId ?? null;
  const mapper = mapperId ? mappers.find((item) => item.id === mapperId) : null;
  const draft =
    state.data.providerMapperDrafts?.[providerId]?.[mapperId ?? "new"] ?? {};
  const errorKey = `${providerId}:${mapperId ?? "new"}`;
  const errors =
    state.data.providerMapperErrorKey === errorKey
      ? violations(state.error?.body)
      : {};
  const mapperType = draft.mapperType ?? mapper?.mapperType ?? "user-attribute";
  const syncMode = draft.syncMode ?? mapper?.syncMode ?? "inherit";
  return `<dialog class="native-modal" open aria-labelledby="provider-mapper-dialog-title"><form data-form="admin-provider-mapper" data-provider-id="${escapeHtml(providerId)}" data-mapper-id="${escapeHtml(mapperId ?? "")}" novalidate><h2 id="provider-mapper-dialog-title">${escapeHtml(text(mapperId ? "adminEditProviderMapper" : "adminCreateProviderMapper"))}</h2>${field("name", text("adminProviderMapperName"), draft.name ?? mapper?.name ?? "", errors.name, "text", 'maxlength="100" required')}${field("sourceClaim", text("adminProviderMapperSource"), draft.sourceClaim ?? mapper?.sourceClaim ?? "", errors.sourceClaim, "text", 'maxlength="200" required')}${field("target", text("adminProviderMapperTarget"), draft.target ?? mapper?.target ?? "", errors.target, "text", 'maxlength="200" required')}<div class="field"><label for="provider-mapper-type">${escapeHtml(text("adminProviderMapperType"))}</label><select id="provider-mapper-type" name="mapperType"><option value="user-attribute" ${mapperType === "user-attribute" ? "selected" : ""}>user-attribute</option><option value="claim" ${mapperType === "claim" ? "selected" : ""}>claim</option><option value="role" ${mapperType === "role" ? "selected" : ""}>role</option><option value="group" ${mapperType === "group" ? "selected" : ""}>group</option></select></div><div class="field"><label for="provider-mapper-sync">${escapeHtml(text("adminProviderMapperSyncMode"))}</label><select id="provider-mapper-sync" name="syncMode"><option value="inherit" ${syncMode === "inherit" ? "selected" : ""}>inherit</option><option value="legacy" ${syncMode === "legacy" ? "selected" : ""}>legacy</option><option value="import" ${syncMode === "import" ? "selected" : ""}>import</option><option value="read_only" ${syncMode === "read_only" ? "selected" : ""}>read_only</option><option value="force" ${syncMode === "force" ? "selected" : ""}>force</option></select></div><label class="settings-row"><input type="checkbox" name="addToIdToken" ${(draft.addToIdToken ?? mapper?.addToIdToken) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToIdToken"))}</label><label class="settings-row"><input type="checkbox" name="addToAccessToken" ${(draft.addToAccessToken ?? mapper?.addToAccessToken) ? "checked" : ""}/>${escapeHtml(text("adminMapperAddToAccessToken"))}</label><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `provider-mapper-save:${errorKey}`, disabled: state.offline || Boolean(state.busy) })}<button type="button" class="secondary-button" data-action="admin-provider-mapper-editor-cancel" data-provider="${escapeHtml(providerId)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form></dialog>`;
}

function identityProviderPolicyForm(providerId) {
  const policy = state.data.identityProviderPolicies?.[providerId];
  if (!policy)
    return `<section class="card" role="status">${escapeHtml(text("adminIdentityProvidersLoadError"))}</section>`;
  const draft = state.data.identityProviderPolicyDrafts?.[providerId] ?? policy;
  const errors =
    state.data.identityProviderPolicyErrorId === providerId
      ? violations(state.error?.body)
      : {};
  const checked = (name) => (draft[name] ? "checked" : "");
  const option = (name, value) =>
    (draft[name] ?? "") === value ? "selected" : "";
  return `<form class="card identity-provider-policy-form" data-form="admin-identity-provider-policy" data-provider-id="${escapeHtml(providerId)}"><h2>${escapeHtml(text("adminIdentityProviderOptions"))}</h2><div class="field"><label for="policy-display-name">${escapeHtml(text("adminProviderDisplayName"))}</label><input id="policy-display-name" name="displayName" value="${escapeHtml(draft.displayName ?? "")}" maxlength="100" required/><div class="field-error">${escapeHtml(errors.displayName ?? "")}</div></div><label class="settings-row"><span>${escapeHtml(text("adminProviderEnabled"))}</span><input name="enabled" type="checkbox" ${checked("enabled")}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderHideOnLogin"))}</span><input name="hideOnLogin" type="checkbox" ${checked("hideOnLogin")}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderLinkingOnly"))}</span><input name="accountLinkingOnly" type="checkbox" ${checked("accountLinkingOnly")}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderTrustEmail"))}</span><input name="trustEmail" type="checkbox" ${checked("trustEmail")}/></label><label class="settings-row"><span>${escapeHtml(text("adminProviderRequireMfa"))}</span><input name="mfaRequired" type="checkbox" ${checked("mfaRequired")}/></label><div class="field"><label for="policy-order">${escapeHtml(text("adminProviderOrder"))}</label><input id="policy-order" name="guiOrder" type="number" min="0" max="2147483647" value="${escapeHtml(draft.guiOrder ?? 0)}" required/><div class="field-error">${escapeHtml(errors.guiOrder ?? "")}</div></div><div class="field"><label for="policy-visibility">${escapeHtml(text("adminProviderAccountVisibility"))}</label><select id="policy-visibility" name="showInAccountConsole"><option value="always" ${option("showInAccountConsole", "always")}>${escapeHtml(text("adminProviderAlways"))}</option><option value="when-linked" ${option("showInAccountConsole", "when-linked")}>${escapeHtml(text("adminProviderWhenLinked"))}</option><option value="never" ${option("showInAccountConsole", "never")}>${escapeHtml(text("adminProviderNever"))}</option></select><div class="field-error">${escapeHtml(errors.showInAccountConsole ?? "")}</div></div><div class="field"><label for="policy-sync">${escapeHtml(text("adminProviderSyncMode"))}</label><select id="policy-sync" name="syncMode"><option value="legacy" ${option("syncMode", "legacy")}>legacy</option><option value="import" ${option("syncMode", "import")}>import</option><option value="read_only" ${option("syncMode", "read_only")}>read_only</option><option value="force" ${option("syncMode", "force")}>force</option></select><div class="field-error">${escapeHtml(errors.syncMode ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === `identity-provider-policy-save:${providerId}`, disabled: state.offline || Boolean(state.busy) })}</div></form>`;
}

function legacyAdminIdentityProvidersContent() {
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
  const openConfigurationId = state.data.identityProviderConfigurationOpenId;
  const createForm =
    openConfigurationId === "new"
      ? identityProviderConfigurationForm("new")
      : chooseLazy(
          openConfigurationId === "new-saml",
          () => samlIdentityProviderConfigurationForm("new-saml"),
          () => "",
        );
  return `<section class="card" aria-label="${escapeHtml(text("adminIdentityProviders"))}"><div class="admin-detail-heading"><h2>${escapeHtml(text("adminIdentityProviders"))}</h2><div class="actions">${button(text("adminAddOidcProvider"), { action: "admin-oidc-provider-create", icon: "add", busy: state.busy === "identity-provider-create", disabled: state.offline || Boolean(state.busy) })}${button(text("adminAddSamlProvider"), { action: "admin-saml-provider-create", icon: "add", disabled: state.offline || Boolean(state.busy) })}</div></div>${createForm}<form id="admin-identity-provider-search" class="actions" role="search"><input id="admin-identity-provider-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchIdentityProviders"))}" value="${escapeHtml(state.data.identityProviderQuery ?? "")}" placeholder="${escapeHtml(text("adminSearchIdentityProviders"))}" maxlength="200"/><button class="primary-button" type="submit" ${state.busy === "identity-providers-search" ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "identity-providers-search")}${escapeHtml(text("adminSearchIdentityProviders"))}</button></form>${
    providers.length
      ? '<div class="list">' +
        providers
          .map((provider) => {
            const id = String(provider.id ?? "");
            const policy = state.data.identityProviderPolicies?.[id];
            const editingPolicy =
              state.data.identityProviderPolicyOpenId === id;
            const policyDraft =
              state.data.identityProviderPolicyDrafts?.[id] ?? policy ?? {};
            const policyErrors = chooseLazy(
              state.data.identityProviderPolicyErrorId === id,
              () => violations(state.error?.body),
              () => ({}),
            );
            const confirming =
              state.data.identityProviderDeleteConfirmId === id;
            const editingConnection =
              state.data.identityProviderConfigurationOpenId === id;
            const connectionForm = chooseLazy(
              editingConnection,
              () =>
                chooseLazy(
                  provider.providerType === "saml",
                  () => samlIdentityProviderConfigurationForm(id),
                  () => identityProviderConfigurationForm(id),
                ),
              () => "",
            );
            const controls = chooseLazy(
              confirming,
              () =>
                '<div class="actions"><span role="status">' +
                escapeHtml(text("adminDeleteIdentityProviderPrompt")) +
                "</span>" +
                button(text("adminDeleteIdentityProvider"), {
                  action: "admin-identity-provider-delete-confirm",
                  id,
                  danger: true,
                  busy: state.busy === "identity-provider-delete:" + id + "",
                  disabled: state.offline || Boolean(state.busy),
                }) +
                '<button class="secondary-button" type="button" data-action="admin-identity-provider-delete-cancel" data-id="' +
                escapeHtml(id) +
                '" ' +
                chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("cancel")) +
                "</button></div>",
              () =>
                '<div class="actions">' +
                button(text("adminDeleteIdentityProvider"), {
                  action: "admin-identity-provider-delete-request",
                  id,
                  danger: true,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                "</div>",
            );
            const policyForm = chooseLazy(
              editingPolicy && policy,
              () =>
                '<form class="card" data-form="admin-identity-provider-policy" data-provider-id="' +
                escapeHtml(id) +
                '"><div class="field"><label for="provider-policy-name-' +
                escapeHtml(id) +
                '">' +
                escapeHtml(text("adminProviderDisplayName")) +
                '</label><input id="provider-policy-name-' +
                escapeHtml(id) +
                '" name="displayName" type="text" value="' +
                escapeHtml(policyDraft.displayName ?? policy.displayName) +
                '" maxlength="100" required/><div class="field-error">' +
                escapeHtml(policyErrors.displayName ?? "") +
                '</div></div><label class="settings-row"><span>' +
                escapeHtml(text("adminProviderEnabled")) +
                '</span><input name="enabled" type="checkbox" ' +
                chooseLazy(
                  policyDraft.enabled ?? policy.enabled,
                  () => "checked",
                  () => "",
                ) +
                '/></label><label class="settings-row"><span>' +
                escapeHtml(text("adminProviderHideOnLogin")) +
                '</span><input name="hideOnLogin" type="checkbox" ' +
                chooseLazy(
                  policyDraft.hideOnLogin ?? policy.hideOnLogin,
                  () => "checked",
                  () => "",
                ) +
                '/></label><label class="settings-row"><span>' +
                escapeHtml(text("adminProviderLinkingOnly")) +
                '</span><input name="accountLinkingOnly" type="checkbox" ' +
                chooseLazy(
                  policyDraft.accountLinkingOnly ?? policy.accountLinkingOnly,
                  () => "checked",
                  () => "",
                ) +
                '/></label><label class="settings-row"><span>' +
                escapeHtml(text("adminProviderTrustEmail")) +
                '</span><input name="trustEmail" type="checkbox" ' +
                chooseLazy(
                  policyDraft.trustEmail ?? policy.trustEmail,
                  () => "checked",
                  () => "",
                ) +
                '/></label><label class="settings-row"><span>' +
                escapeHtml(text("adminProviderRequireMfa")) +
                '</span><input name="mfaRequired" type="checkbox" ' +
                chooseLazy(
                  policyDraft.mfaRequired ?? policy.mfaRequired,
                  () => "checked",
                  () => "",
                ) +
                '/></label><div class="field"><label for="provider-policy-order-' +
                escapeHtml(id) +
                '">' +
                escapeHtml(text("adminProviderOrder")) +
                '</label><input id="provider-policy-order-' +
                escapeHtml(id) +
                '" name="guiOrder" type="number" min="0" max="2147483647" value="' +
                escapeHtml(policyDraft.guiOrder ?? policy.guiOrder) +
                '" required/><div class="field-error">' +
                escapeHtml(policyErrors.guiOrder ?? "") +
                '</div></div><div class="field"><label for="provider-policy-visibility-' +
                escapeHtml(id) +
                '">' +
                escapeHtml(text("adminProviderAccountVisibility")) +
                '</label><select id="provider-policy-visibility-' +
                escapeHtml(id) +
                '" name="showInAccountConsole"><option value="always" ' +
                chooseLazy(
                  (policyDraft.showInAccountConsole ??
                    policy.showInAccountConsole) === "always",
                  () => "selected",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("adminProviderAlways")) +
                '</option><option value="when-linked" ' +
                chooseLazy(
                  (policyDraft.showInAccountConsole ??
                    policy.showInAccountConsole) === "when-linked",
                  () => "selected",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("adminProviderWhenLinked")) +
                '</option><option value="never" ' +
                chooseLazy(
                  (policyDraft.showInAccountConsole ??
                    policy.showInAccountConsole) === "never",
                  () => "selected",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("adminProviderNever")) +
                '</option></select><div class="field-error">' +
                escapeHtml(policyErrors.showInAccountConsole ?? "") +
                '</div></div><div class="field"><label for="provider-policy-sync-' +
                escapeHtml(id) +
                '">' +
                escapeHtml(text("adminProviderSyncMode")) +
                '</label><select id="provider-policy-sync-' +
                escapeHtml(id) +
                '" name="syncMode"><option value="legacy" ' +
                chooseLazy(
                  (policyDraft.syncMode ?? policy.syncMode) === "legacy",
                  () => "selected",
                  () => "",
                ) +
                '>legacy</option><option value="import" ' +
                chooseLazy(
                  (policyDraft.syncMode ?? policy.syncMode) === "import",
                  () => "selected",
                  () => "",
                ) +
                '>import</option><option value="read_only" ' +
                chooseLazy(
                  (policyDraft.syncMode ?? policy.syncMode) === "read_only",
                  () => "selected",
                  () => "",
                ) +
                '>read_only</option><option value="force" ' +
                chooseLazy(
                  (policyDraft.syncMode ?? policy.syncMode) === "force",
                  () => "selected",
                  () => "",
                ) +
                '>force</option></select><div class="field-error">' +
                escapeHtml(policyErrors.syncMode ?? "") +
                '</div></div><div class="actions">' +
                button(text("save"), {
                  type: "submit",
                  busy:
                    state.busy === "identity-provider-policy-save:" + id + "",
                  disabled: state.offline || Boolean(state.busy),
                }) +
                '<button class="secondary-button" type="button" data-action="admin-identity-provider-policy-cancel" data-id="' +
                escapeHtml(id) +
                '" ' +
                chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("cancel")) +
                "</button></div></form>",
              () => "",
            );
            const mapperBusy = state.busy === "provider-mappers:" + id + "";
            const mapperButton = button(text("adminManageProviderMappers"), {
              action: "admin-provider-mappers-toggle",
              id,
              busy: mapperBusy,
              disabled: state.offline || Boolean(state.busy),
            });
            const mapperPanel = renderIdentityProviderMappers(id);
            const connectionButton = chooseLazy(
              !["oidc", "saml"].includes(provider.providerType),
              () => "",
              () =>
                button(
                  text(
                    chooseLazy(
                      provider.providerType === "saml",
                      () => "adminEditSamlConfiguration",
                      () => "adminEditProviderConnection",
                    ),
                  ),
                  {
                    action: chooseLazy(
                      provider.providerType === "saml",
                      () => "admin-saml-provider-config-edit",
                      () => "admin-identity-provider-config-edit",
                    ),
                    id,
                    busy:
                      state.busy === "identity-provider-config-load:" + id + "",
                    disabled: state.offline || Boolean(state.busy),
                  },
                ),
            );
            return (
              '<article class="list-item" data-identity-provider-id="' +
              escapeHtml(id) +
              '"><div><strong>' +
              escapeHtml(provider.displayName || provider.alias) +
              '</strong><span class="muted">' +
              escapeHtml(
                "" + provider.providerType + " · " + provider.alias + "",
              ) +
              '</span><span class="muted">' +
              escapeHtml(
                "" +
                  provider.mapperCount +
                  " " +
                  text("adminProviderMappers") +
                  "",
              ) +
              "</span></div><span>" +
              escapeHtml(
                chooseLazy(
                  provider.enabled,
                  () => text("adminProviderEnabled"),
                  () => text("adminProviderDisabled"),
                ),
              ) +
              " · " +
              escapeHtml(
                chooseLazy(
                  provider.configured,
                  () => text("adminConfigured"),
                  () => text("adminUnconfigured"),
                ),
              ) +
              '</span><div class="actions">' +
              button(text("adminEditProviderPolicy"), {
                action: "admin-identity-provider-policy-toggle",
                id,
                busy: state.busy === "identity-provider-policy-load:" + id + "",
                disabled: state.offline || Boolean(state.busy),
              }) +
              "" +
              connectionButton +
              "" +
              mapperButton +
              "" +
              controls +
              "</div>" +
              connectionForm +
              "" +
              policyForm +
              "" +
              mapperPanel +
              "</article>"
            );
          })
          .join("") +
        "</div>"
      : '<div class="empty" role="status">' +
        escapeHtml(text("adminNoIdentityProviders")) +
        "</div>"
  }<div class="actions" aria-label="${escapeHtml(text("adminIdentityProviders"))} pagination"><button class="secondary-button" type="button" data-identity-provider-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-identity-provider-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "identity-providers-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

const PROVIDER_CONNECTION_FIELDS = [
  "providerType",
  "registrationId",
  "displayName",
  "alias",
  "iconKey",
  "clientId",
  "authorizationUri",
  "tokenUri",
  "userInfoUri",
  "jwkSetUri",
  "issuerUri",
  "clientAuthenticationMethod",
  "scopes",
  "userNameAttribute",
];

const SAML_CONNECTION_FIELDS = [
  "registrationId",
  "displayName",
  "alias",
  "iconKey",
  "samlMetadataUri",
  "samlAssertingPartyEntityId",
  "samlSingleSignOnServiceUrl",
  "samlSingleLogoutServiceUrl",
  "samlIdpCertificate",
  "samlSigningCertificate",
  "samlServiceProviderEntityId",
  "samlSignAuthnRequests",
  "samlWantAssertionsSigned",
  "samlNameIdFormat",
  "samlPrincipalAttribute",
  "samlEmailAttribute",
  "samlFirstNameAttribute",
  "samlLastNameAttribute",
  "samlGroupsAttribute",
  "samlDecryptionCertificate",
  "samlSignatureAlgorithm",
  "samlAuthnRequestBinding",
  "samlResponseBinding",
  "samlLogoutBinding",
  "samlForceAuthentication",
  "samlPassSubject",
];

function defaultIdentityProviderConfiguration() {
  return {
    providerType: "oidc",
    registrationId: "",
    displayName: "",
    alias: "",
    iconKey: "generic",
    clientId: "",
    authorizationUri: "",
    tokenUri: "",
    userInfoUri: "",
    jwkSetUri: "",
    issuerUri: "",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid profile email",
    userNameAttribute: "sub",
    samlMetadataUri: "",
    samlAssertingPartyEntityId: "",
    samlSingleSignOnServiceUrl: "",
    samlSingleLogoutServiceUrl: "",
    samlIdpCertificate: "",
    samlSigningPrivateKeyConfigured: false,
    samlSigningCertificate: "",
    samlServiceProviderEntityId: "",
    samlSignAuthnRequests: false,
    samlWantAssertionsSigned: true,
    samlNameIdFormat: "",
    samlPrincipalAttribute: "NameID",
    samlEmailAttribute: "email",
    samlFirstNameAttribute: "givenName",
    samlLastNameAttribute: "sn",
    samlGroupsAttribute: "groups",
    samlDecryptionPrivateKeyConfigured: false,
    samlDecryptionCertificate: "",
    samlSignatureAlgorithm: "",
    samlAuthnRequestBinding: "REDIRECT",
    samlResponseBinding: "POST",
    samlLogoutBinding: "REDIRECT",
    samlForceAuthentication: false,
    samlPassSubject: false,
    enabled: true,
    shortStateParameter: false,
    caseSensitiveUsername: false,
    hideOnLogin: false,
    accountLinkingOnly: false,
    trustEmail: false,
    mfaRequired: false,
    requiredClaims: "sub",
    storeTokens: false,
    storedTokensReadable: false,
    guiOrder: 0,
    showInAccountConsole: "always",
    syncMode: "import",
  };
}

function identityProviderConfigurationDraft(provider) {
  const defaults = defaultIdentityProviderConfiguration();
  const fields =
    provider?.providerType === "saml"
      ? SAML_CONNECTION_FIELDS
      : [...PROVIDER_CONNECTION_FIELDS, ...PROVIDER_POLICY_FIELDS];
  return Object.fromEntries(
    fields.map((key) => [key, provider?.[key] ?? defaults[key] ?? ""]),
  );
}

const PROVIDER_POLICY_FIELDS = [
  "enabled",
  "shortStateParameter",
  "caseSensitiveUsername",
  "hideOnLogin",
  "accountLinkingOnly",
  "trustEmail",
  "mfaRequired",
  "requiredClaims",
  "storeTokens",
  "storedTokensReadable",
  "guiOrder",
  "syncMode",
];

function safeIdentityProviderConfiguration(provider) {
  const safe = {
    id: provider?.id,
    providerType: provider?.providerType,
    clientSecretConfigured: Boolean(provider?.clientSecretConfigured),
  };
  const defaults = defaultIdentityProviderConfiguration();
  for (const key of Object.keys(defaults))
    safe[key] = provider?.[key] ?? defaults[key];
  return safe;
}

function identityProviderConfigurationFormDraft(form) {
  const draft = formValues(form);
  delete draft.clientSecret;
  for (const name of [
    "enabled",
    "shortStateParameter",
    "caseSensitiveUsername",
    "hideOnLogin",
    "accountLinkingOnly",
    "trustEmail",
    "mfaRequired",
    "storeTokens",
    "storedTokensReadable",
  ])
    draft[name] = Boolean(form.elements.namedItem(name)?.checked);
  return Object.fromEntries(
    [...PROVIDER_CONNECTION_FIELDS, ...PROVIDER_POLICY_FIELDS].map((key) => [
      key,
      draft[key] ?? "",
    ]),
  );
}

function samlIdentityProviderConfigurationFormDraft(form) {
  const draft = formValues(form);
  for (const name of ["samlSigningPrivateKey", "samlDecryptionPrivateKey"])
    delete draft[name];
  for (const name of [
    "samlSignAuthnRequests",
    "samlWantAssertionsSigned",
    "samlForceAuthentication",
    "samlPassSubject",
  ])
    draft[name] = form.elements.namedItem(name).checked;
  return Object.fromEntries(
    SAML_CONNECTION_FIELDS.map((key) => [key, draft[key] ?? ""]),
  );
}

function isSafeProviderEndpointUri(value) {
  try {
    const uri = new URL(value);
    return (
      !uri.hash &&
      !uri.username &&
      !uri.password &&
      (uri.protocol === "https:" ||
        (uri.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname)))
    );
  } catch {
    return false;
  }
}

function identityProviderConfigurationForm(id) {
  const creating = id === "new";
  const key = creating ? "new" : id;
  const draft = state.data.identityProviderConfigurationDrafts?.[key] ?? {};
  const baseline = state.data.identityProviderConfigurationBaselines?.[key];
  const errors =
    state.data.identityProviderConfigurationErrorId === key
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `identity-provider-config-save:${key}`;
  const value = (name) => draft[name] ?? "";
  const required = (name) =>
    `<div class="field-error">${escapeHtml(errors[name] ?? "")}</div>`;
  const textField = (name, label, type = "text", attributes = "") =>
    `<div class="field"><label for="provider-config-${key}-${name}">${escapeHtml(text(label))}</label><input id="provider-config-${key}-${name}" name="${name}" type="${type}" value="${type === "password" ? "" : escapeHtml(value(name))}" ${attributes}/>${required(name)}</div>`;
  const secretHint = creating
    ? text("adminProviderSecretRequired")
    : chooseLazy(
        baseline?.clientSecretConfigured,
        () => text("adminProviderSecretConfigured"),
        () => text("adminProviderSecretRequired"),
      );
  const authenticationMethod = value("clientAuthenticationMethod");
  const authenticationMethods = ["client_secret_basic", "client_secret_post"];
  const selectedLegacyMethod = authenticationMethods.includes(
    authenticationMethod,
  )
    ? ""
    : `<option value="${escapeHtml(authenticationMethod)}" selected>${escapeHtml(authenticationMethod)}</option>`;
  const authenticationMethodField = `<div class="field"><label for="provider-config-${key}-clientAuthenticationMethod">${escapeHtml(text("adminProviderClientAuthenticationMethod"))}</label><select id="provider-config-${key}-clientAuthenticationMethod" name="clientAuthenticationMethod" required>${selectedLegacyMethod}${authenticationMethods
    .map(
      (method) =>
        `<option value="${method}" ${authenticationMethod === method ? "selected" : ""}>${method}</option>`,
    )
    .join("")}</select>${required("clientAuthenticationMethod")}</div>`;
  const selectField = (name, label, options) =>
    `<div class="field"><label for="provider-config-${key}-${name}">${escapeHtml(text(label))}</label><select id="provider-config-${key}-${name}" name="${name}" required>${options
      .map(
        ([optionValue, optionLabel]) =>
          `<option value="${escapeHtml(optionValue)}" ${value(name) === optionValue ? "selected" : ""}>${escapeHtml(text(optionLabel))}</option>`,
      )
      .join("")}</select>${required(name)}</div>`;
  const checkbox = (name, label) =>
    `<label class="identity-provider-checkbox"><input name="${name}" type="checkbox" ${draft[name] ? "checked" : ""}/><span>${escapeHtml(text(label))}</span></label>`;
  return `<form class="card identity-provider-connection-form" data-form="admin-identity-provider-connection" data-provider-id="${creating ? "" : escapeHtml(id)}" novalidate><div class="identity-provider-fields"><div class="identity-provider-fields-column">${textField("displayName", "adminProviderDisplayName", "text", 'maxlength="100" required')}${textField("registrationId", "adminProviderRegistrationId", "text", 'maxlength="50" pattern="[a-z0-9][a-z0-9_-]{0,49}" required')}${textField("alias", "adminProviderAlias", "text", 'maxlength="50" pattern="[a-z0-9][a-z0-9_-]{0,49}" required')}${selectField(
    "providerType",
    "adminProviderType",
    [
      ["google", "adminProviderGoogle"],
      ["github", "adminProviderGitHub"],
      ["linkedin", "adminProviderLinkedIn"],
      ["microsoft", "adminProviderMicrosoft"],
      ["oidc", "adminProviderOidc"],
      ["saml", "adminProviderSaml"],
    ],
  )}${selectField("iconKey", "adminProviderIconKey", [
    ["generic", "adminProviderIconGeneric"],
    ["google", "adminProviderGoogle"],
    ["github", "adminProviderGitHub"],
    ["linkedin", "adminProviderLinkedIn"],
    ["microsoft", "adminProviderMicrosoft"],
    ["building", "adminProviderIconBuilding"],
    ["key", "adminProviderIconKeyOption"],
    ["shield", "adminProviderIconShield"],
  ])}${textField("clientId", "adminProviderClientId", "text", 'maxlength="500" required')}${textField("clientSecret", "adminProviderClientSecret", "password", 'maxlength="1000" autocomplete="new-password" ' + (creating || !baseline?.clientSecretConfigured ? "required" : ""))}<div class="muted">${escapeHtml(secretHint)} ${escapeHtml(text("adminProviderConnectionSecretHint"))}</div>${textField("guiOrder", "adminProviderOrder", "number", 'min="0" max="2147483647" required')}${selectField(
    "syncMode",
    "adminProviderSyncMode",
    [
      ["legacy", "adminProviderSyncModeLegacy"],
      ["import", "adminProviderSyncModeImport"],
      ["read_only", "adminProviderSyncModeReadOnly"],
      ["force", "adminProviderSyncModeForce"],
    ],
  )}</div><div class="identity-provider-fields-column">${textField("authorizationUri", "adminProviderAuthorizationUri", "url", 'maxlength="1000" required')}${textField("tokenUri", "adminProviderTokenUri", "url", 'maxlength="1000" required')}${textField("userInfoUri", "adminProviderUserInfoUri", "url", 'maxlength="1000"')}${textField("jwkSetUri", "adminProviderJwkSetUri", "url", 'maxlength="1000"')}${textField("issuerUri", "adminProviderIssuerUri", "url", 'maxlength="1000"')}${textField("scopes", "adminProviderScopes", "text", 'maxlength="1000" required')}${textField("userNameAttribute", "adminProviderUserNameAttribute", "text", 'maxlength="100" required')}</div></div><div class="identity-provider-checkboxes">${checkbox("enabled", "adminProviderEnabled")}${checkbox("shortStateParameter", "adminProviderShortStateParameter")}${checkbox("caseSensitiveUsername", "adminProviderCaseSensitiveUsername")}${checkbox("hideOnLogin", "adminProviderHideOnLogin")}${checkbox("accountLinkingOnly", "adminProviderLinkingOnly")}${checkbox("trustEmail", "adminProviderTrustEmail")}${checkbox("mfaRequired", "adminProviderRequireMfa")}${checkbox("storeTokens", "adminProviderStoreTokens")}${checkbox("storedTokensReadable", "adminProviderStoredTokensReadable")}</div><div class="identity-provider-final-fields">${textField("requiredClaims", "adminProviderRequiredClaims", "text", 'maxlength="500"')}${authenticationMethodField}</div><div class="actions identity-provider-form-actions"><button class="secondary-button" type="button" data-action="admin-identity-provider-config-cancel" data-provider-id="${escapeHtml(key)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button>${button(text(creating ? "adminAddOidcProvider" : "save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy), icon: creating ? "add" : "check" })}</div></form>`;
}
function samlIdentityProviderConfigurationForm(id) {
  const creating = id === "new-saml";
  const key = creating ? "new-saml" : id;
  const draft = state.data.identityProviderConfigurationDrafts?.[key] ?? {};
  const baseline = state.data.identityProviderConfigurationBaselines?.[key];
  const errors =
    state.data.identityProviderConfigurationErrorId === key
      ? violations(state.error?.body)
      : {};
  const busy = state.busy === `identity-provider-config-save:${key}`;
  const value = (name) => draft[name] ?? "";
  const field = (name, label, type = "text", attributes = "") =>
    `<div class="field"><label for="saml-config-${key}-${name}">${escapeHtml(text(label))}</label>${
      type === "textarea"
        ? '<textarea id="saml-config-' +
          key +
          "-" +
          name +
          '" name="' +
          name +
          '" ' +
          attributes +
          ">" +
          escapeHtml(value(name)) +
          "</textarea>"
        : '<input id="saml-config-' +
          key +
          "-" +
          name +
          '" name="' +
          name +
          '" type="' +
          type +
          '" value="' +
          chooseLazy(
            type === "password",
            () => "",
            () => escapeHtml(value(name)),
          ) +
          '" ' +
          attributes +
          "/>"
    }<div class="field-error">${escapeHtml(errors[name] ?? "")}</div></div>`;
  const checkbox = (name, label, defaultValue = false) =>
    `<label class="settings-row"><span>${escapeHtml(text(label))}</span><input name="${name}" type="checkbox" ${(draft[name] ?? defaultValue) ? "checked" : ""}/></label>`;
  const select = (name, label, options, defaultValue) =>
    `<div class="field"><label for="saml-config-${key}-${name}">${escapeHtml(text(label))}</label><select id="saml-config-${key}-${name}" name="${name}">${options.map((option) => '<option value="' + option + '" ' + ((value(name) || defaultValue) === option ? "selected" : "") + ">" + option + "</option>").join("")}</select><div class="field-error">${escapeHtml(errors[name] ?? "")}</div></div>`;
  const signingKeyHint = baseline?.samlSigningPrivateKeyConfigured
    ? text("adminSamlSigningKeyConfigured")
    : "";
  const decryptionKeyHint = baseline?.samlDecryptionPrivateKeyConfigured
    ? text("adminSamlDecryptionKeyConfigured")
    : "";
  return `<form class="card" data-form="admin-saml-identity-provider-connection" data-provider-id="${creating ? "" : escapeHtml(id)}" novalidate><h3>${escapeHtml(text("adminSamlConfigurationTitle"))}</h3>${field("registrationId", "adminProviderRegistrationId", "text", 'maxlength="50" pattern="[a-z0-9][a-z0-9_-]{0,49}" required')}${field("displayName", "adminProviderDisplayName", "text", 'maxlength="100" required')}${field("alias", "adminProviderAlias", "text", 'maxlength="50" pattern="[a-z0-9][a-z0-9_-]{0,49}" required')}${field("iconKey", "adminProviderIconKey", "text", 'maxlength="40" pattern="[a-z][a-z0-9_-]{0,39}" required')}${field("samlMetadataUri", "adminSamlMetadataUri", "url", 'maxlength="2000"')}${field("samlAssertingPartyEntityId", "adminSamlPartyId", "url", 'maxlength="1000"')}${field("samlSingleSignOnServiceUrl", "adminSamlSsoUri", "url", 'maxlength="2000"')}${field("samlSingleLogoutServiceUrl", "adminSamlSloUri", "url", 'maxlength="2000"')}${field("samlIdpCertificate", "adminSamlIdpCertificate", "textarea", 'maxlength="12000" rows="4" spellcheck="false"')}${field("samlServiceProviderEntityId", "adminSamlServiceProviderId", "url", 'maxlength="1000"')}${field("samlSigningCertificate", "adminSamlSigningCertificate", "textarea", 'maxlength="12000" rows="4" spellcheck="false"')}${field("samlSigningPrivateKey", "adminSamlSigningKey", "textarea", 'maxlength="16000" rows="4" autocomplete="off" spellcheck="false" class="secret-pem"')}<div class="muted">${escapeHtml([signingKeyHint, text("adminSamlPrivateKeyHint")].filter(Boolean).join(" "))}</div>${checkbox("samlSignAuthnRequests", "adminSamlSignAuthnRequests")}${checkbox("samlWantAssertionsSigned", "adminSamlSignedAssertions", true)}${field("samlDecryptionCertificate", "adminSamlDecryptionCertificate", "textarea", 'maxlength="12000" rows="4" spellcheck="false"')}${field("samlDecryptionPrivateKey", "adminSamlDecryptionKey", "textarea", 'maxlength="16000" rows="4" autocomplete="off" spellcheck="false" class="secret-pem"')}<div class="muted">${escapeHtml([decryptionKeyHint, text("adminSamlPrivateKeyHint")].filter(Boolean).join(" "))}</div>${field("samlNameIdFormat", "adminSamlNameIdFormat", "text", 'maxlength="200"')}${field("samlPrincipalAttribute", "adminSamlPrincipalAttribute", "text", 'maxlength="200"')}${field("samlEmailAttribute", "adminSamlEmailAttribute", "text", 'maxlength="200"')}${field("samlFirstNameAttribute", "adminSamlFirstNameAttribute", "text", 'maxlength="200"')}${field("samlLastNameAttribute", "adminSamlLastNameAttribute", "text", 'maxlength="200"')}${field("samlGroupsAttribute", "adminSamlGroupsAttribute", "text", 'maxlength="200"')}${field("samlSignatureAlgorithm", "adminSamlSignatureAlgorithm", "url", 'maxlength="500"')}${select("samlAuthnRequestBinding", "adminSamlAuthnBinding", ["POST", "REDIRECT"], "REDIRECT")}${select("samlResponseBinding", "adminSamlResponseBinding", ["POST", "REDIRECT"], "POST")}${select("samlLogoutBinding", "adminSamlLogoutBinding", ["POST", "REDIRECT"], "REDIRECT")}${checkbox("samlForceAuthentication", "adminSamlForceAuthentication")}${checkbox("samlPassSubject", "adminSamlPassSubject")}<div class="actions">${button(text(creating ? "adminAddSamlProvider" : "save"), { type: "submit", busy, disabled: state.offline || Boolean(state.busy), icon: creating ? "add" : "check" })}<button class="secondary-button" type="button" data-action="admin-identity-provider-config-cancel" data-provider-id="${escapeHtml(key)}" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button></div></form>`;
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
  const totalElements = Number.isSafeInteger(page.totalElements)
    ? page.totalElements
    : sessions.length;
  const size = Number.isSafeInteger(state.data.adminSessionSize)
    ? state.data.adminSessionSize
    : 10;
  const firstRecord = totalElements === 0 ? 0 : currentPage * size + 1;
  const lastRecord = Math.min((currentPage + 1) * size, totalElements);
  const filterBusy = Boolean(state.busy);
  const rows = sessions
    .map((session, index) => {
      const confirming = state.data.adminSessionDeleteConfirmId === session.id;
      const busy = state.busy === `admin-session-delete:${index}`;
      const detailBusy = state.busy === `admin-session-detail:${session.id}`;
      const controls = confirming
        ? `<div class="admin-session-row-confirm"><span role="status">${escapeHtml(text("adminSessionDeleteConfirm"))}</span>${button(text("adminSessionDelete"), { action: "admin-session-delete-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-session-delete-cancel" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : session.active && state.data.adminAccess?.manageSessions === true
          ? `<button class="admin-session-more" type="button" data-action="admin-session-delete-request" data-index="${index}" aria-label="${escapeHtml(text("adminSessionDelete"))}" ${state.offline || filterBusy ? "disabled" : ""}>${actionIcon("more")}</button>`
          : "";
      const date = (value) =>
        value && !Number.isNaN(Date.parse(value))
          ? new Date(value).toLocaleString(
              state.locale === "tr" ? "tr-TR" : "en-US",
            )
          : "—";
      return `<tr><td><button class="admin-session-id" type="button" data-action="admin-session-detail" data-id="${escapeHtml(session.id)}" aria-label="${escapeHtml(text("adminSessionDetails"))}: ${escapeHtml(session.id)}" ${filterBusy ? "disabled" : ""}><span class="admin-session-eye" aria-hidden="true">${detailBusy ? spin(true) : actionIcon("view")}</span><span title="${escapeHtml(session.id)}">${escapeHtml(session.id.slice(0, 12))}…</span></button></td><td><strong class="admin-session-username">${escapeHtml(session.username ?? "—")}</strong><span class="admin-session-status ${session.active ? "is-active" : "is-expired"}">${escapeHtml(text(session.active ? "adminActive" : "adminExpired"))}</span></td><td>${escapeHtml(date(session.createdAt))}</td><td>${escapeHtml(date(session.lastAccessedAt))}</td><td>${escapeHtml(date(session.expiresAt))}</td><td>${Number.isSafeInteger(session.authorizationCount) ? session.authorizationCount : 0}</td><td class="admin-session-actions">${controls}</td></tr>`;
    })
    .join("");
  const pageButton = (target, label, icon, disabled, busy = false) =>
    `<button class="admin-session-page-button" type="button" data-admin-session-page="${target}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || filterBusy ? "disabled" : ""}>${spin(busy)}${busy ? "" : actionIcon(icon)}</button>`;
  const status = state.data.adminSessionStatus ?? "active";
  const sort = state.data.adminSessionSort ?? "lastAccessTime,desc";
  const detail = state.data.adminSessionDetail;
  const detailDate = (value) =>
    value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleString(
          state.locale === "tr" ? "tr-TR" : "en-US",
        )
      : "—";
  const detailDialog = detail
    ? `<dialog class="native-modal" open aria-labelledby="admin-session-detail-title"><h2 id="admin-session-detail-title">${escapeHtml(text("adminSessionDetails"))}</h2><dl><dt>${escapeHtml(text("adminSessionId"))}</dt><dd><code>${escapeHtml(detail.session?.id ?? "")}</code></dd><dt>${escapeHtml(text("adminSessionUser"))}</dt><dd>${escapeHtml(detail.session?.username ?? "—")}</dd><dt>${escapeHtml(text("adminSessionCreatedAt"))}</dt><dd>${escapeHtml(detailDate(detail.session?.createdAt))}</dd><dt>${escapeHtml(text("adminSessionLastActive"))}</dt><dd>${escapeHtml(detailDate(detail.session?.lastAccessedAt))}</dd><dt>${escapeHtml(text("adminSessionExpiresAt"))}</dt><dd>${escapeHtml(detailDate(detail.session?.expiresAt))}</dd></dl><h3>${escapeHtml(text("adminAuthorizations"))}</h3>${(detail.authorizations ?? []).map((authorization) => `<article class="list-item"><div><strong>${escapeHtml(authorization.clientName || authorization.clientId)}</strong><span class="muted">${escapeHtml(text("adminSessionGrantType"))}: ${escapeHtml(authorization.grantType)}</span></div><span>${escapeHtml(text("adminSessionScopes"))}: ${escapeHtml((authorization.scopes ?? []).join(", ") || "—")}</span></article>`).join("") || `<p class="muted">—</p>`}<div class="actions"><button class="secondary-button" type="button" data-action="admin-session-detail-close">${escapeHtml(text("cancel"))}</button></div></dialog>`
    : "";
  return `<section class="admin-sessions-page" aria-label="${escapeHtml(text("adminSessions"))}"><div class="admin-sessions-card"><form id="admin-session-search" class="admin-session-filters" role="search"><label class="admin-session-search"><span class="admin-session-search-icon" aria-hidden="true">${state.busy === "admin-sessions-search" ? spin(true) : actionIcon("search")}</span><span class="sr-only">${escapeHtml(text("adminSearchSessions"))}</span><input id="admin-session-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchSessions"))}" value="${escapeHtml(state.data.adminSessionQuery ?? "")}" placeholder="${escapeHtml(text("adminSessionSearchPlaceholder"))}" maxlength="200" ${filterBusy ? "disabled" : ""}/></label><label class="sr-only" for="admin-session-sort">${escapeHtml(text("adminSessionSortLabel"))}</label><select id="admin-session-sort" name="sort" aria-label="${escapeHtml(text("adminSessionSortLabel"))}" ${filterBusy ? "disabled" : ""}><option value="lastAccessTime,desc" ${sort === "lastAccessTime,desc" ? "selected" : ""}>${escapeHtml(text("adminSessionsSortNewest"))}</option><option value="lastAccessTime,asc" ${sort === "lastAccessTime,asc" ? "selected" : ""}>${escapeHtml(text("adminSessionsSortOldest"))}</option></select><label class="sr-only" for="admin-session-client">${escapeHtml(text("adminClientId"))}</label><input id="admin-session-client" name="clientId" type="search" aria-label="${escapeHtml(text("adminClientId"))}" placeholder="${escapeHtml(text("adminSessionClientId"))}" value="${escapeHtml(state.data.adminSessionClientId ?? "")}" maxlength="100" ${filterBusy ? "disabled" : ""}/><label class="sr-only" for="admin-session-status">${escapeHtml(text("adminSessionStatusLabel"))}</label><select id="admin-session-status" name="status" aria-label="${escapeHtml(text("adminSessionStatusLabel"))}" ${filterBusy ? "disabled" : ""}><option value="active" ${status === "active" ? "selected" : ""}>${escapeHtml(text("adminActive"))}</option><option value="expired" ${status === "expired" ? "selected" : ""}>${escapeHtml(text("adminExpired"))}</option><option value="all" ${status === "all" ? "selected" : ""}>${escapeHtml(text("adminSessionAllStatuses"))}</option></select></form><div class="admin-session-count" role="status">${totalElements} ${escapeHtml(text("adminSessionRecords"))}</div><div class="admin-session-table-scroll"><table class="admin-session-table"><thead><tr><th>${escapeHtml(text("adminSessionId"))}</th><th>${escapeHtml(text("adminSessionUser"))}</th><th>${escapeHtml(text("adminSessionCreatedAt"))}</th><th>${escapeHtml(text("adminSessionLastActive"))}</th><th>${escapeHtml(text("adminSessionExpiresAt"))}</th><th>${escapeHtml(text("adminSessionAuthorizations"))}</th><th><span class="sr-only">${escapeHtml(text("adminSessionActions"))}</span></th></tr></thead><tbody>${rows || `<tr><td class="admin-session-empty" colspan="7"><div class="empty" role="status">${escapeHtml(text("adminNoSessions"))}</div></td></tr>`}</tbody></table></div><div class="admin-session-pagination"><div class="admin-session-summary"><strong>${firstRecord}–${lastRecord}</strong><span> / ${totalElements}</span></div><div class="admin-session-pagination-controls"><label class="admin-session-page-size"><span>${escapeHtml(text("adminSessionRowsPerPage"))}</span><select id="admin-session-size" aria-label="${escapeHtml(text("adminSessionRowsPerPage"))}" ${filterBusy ? "disabled" : ""}><option ${size === 10 ? "selected" : ""}>10</option><option ${size === 20 ? "selected" : ""}>20</option><option ${size === 50 ? "selected" : ""}>50</option><option ${size === 100 ? "selected" : ""}>100</option></select></label>${pageButton(0, text("adminSessionFirstPage"), "firstPage", currentPage <= 0, state.busy === "admin-sessions-page-first")}${pageButton(currentPage - 1, text("adminPrevious"), "previousPage", currentPage <= 0, state.busy === "admin-sessions-page-prev")}<span class="admin-session-page-indicator">${escapeHtml(text("adminPage"))} <strong>${totalPages === 0 ? 0 : currentPage + 1}</strong> / ${totalPages}</span>${pageButton(currentPage + 1, text("adminNext"), "nextPage", currentPage + 1 >= totalPages, state.busy === "admin-sessions-page-next")}${pageButton(Math.max(totalPages - 1, 0), text("adminSessionLastPage"), "lastPage", currentPage + 1 >= totalPages, state.busy === "admin-sessions-page-last")}</div></div></div>${detailDialog}</section>`;
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
  const size = Number.isSafeInteger(page.size)
    ? page.size
    : (state.data.adminConsentSize ?? 10);
  const totalElements = Number.isSafeInteger(page.totalElements)
    ? page.totalElements
    : consents.length;
  const query = state.data.adminConsentQuery ?? "";
  const clientId = state.data.adminConsentClientId ?? "";
  const username = state.data.adminConsentUsername ?? "";
  const scope = state.data.adminConsentScope ?? "";
  const sort = state.data.adminConsentSort ?? "id.principalName,asc";
  const filterBusy = String(state.busy ?? "").startsWith("admin-consents");
  const hasFilters = Boolean(query || clientId || username || scope);
  const firstRecord = totalElements === 0 ? 0 : currentPage * size + 1;
  const lastRecord = Math.min((currentPage + 1) * size, totalElements);
  const date = (value) =>
    value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleString(
          state.locale === "tr" ? "tr-TR" : "en-US",
        )
      : "—";
  const rows = consents
    .map((consent, index) => {
      const consentKey = JSON.stringify([
        consent.clientId,
        consent.principalName,
      ]);
      const confirming = state.data.consentRevokeConfirmKey === consentKey;
      const busy = state.busy === `admin-consent-revoke:${index}`;
      const controls = confirming
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminConsentRevokeConfirm"))}</span>${button(text("adminConsentRevoke"), { action: "admin-consent-revoke-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-consent-revoke-cancel" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminConsentRevoke"), { action: "admin-consent-revoke-request", index, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      const authorities = (consent.authorities ?? [])
        .map(
          (authority) =>
            `<span class="admin-consent-scope">${escapeHtml(authority.replace(/^SCOPE_/, ""))}</span>`,
        )
        .join("");
      return `<tr><td>${escapeHtml(consent.principalName || "—")}</td><td><strong>${escapeHtml(consent.clientName || consent.clientId)}</strong><span class="admin-consent-client-id">${escapeHtml(consent.clientId)}</span></td><td><div class="admin-consent-scopes">${authorities || "—"}</div></td><td>${escapeHtml(date(consent.createdAt))}</td><td class="admin-session-actions">${controls}</td></tr>`;
    })
    .join("");
  const pageButton = (target, label, icon, disabled, busy = false) =>
    `<button class="admin-session-page-button" type="button" data-admin-consent-page="${target}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || filterBusy ? "disabled" : ""}>${spin(busy)}${busy ? "" : actionIcon(icon)}</button>`;
  return `<section class="admin-consents-page" aria-label="${escapeHtml(text("adminNavConsents"))}"><div class="admin-sessions-card"><form id="admin-consent-search" class="admin-consent-filters" role="search"><label class="admin-session-search"><span class="admin-session-search-icon" aria-hidden="true">${state.busy === "admin-consents-search" ? spin(true) : actionIcon("search")}</span><span class="sr-only">${escapeHtml(text("adminSearchConsents"))}</span><input id="admin-consent-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchConsents"))}" value="${escapeHtml(query)}" placeholder="${escapeHtml(state.locale === "tr" ? "Ara" : "Search")}" maxlength="200" ${filterBusy ? "disabled" : ""}/></label><label class="sr-only" for="admin-consent-sort">${escapeHtml(text("adminConsentSortLabel"))}</label><select id="admin-consent-sort" name="sort" aria-label="${escapeHtml(text("adminConsentSortLabel"))}" ${filterBusy ? "disabled" : ""}><option value="id.principalName,asc" ${sort === "id.principalName,asc" ? "selected" : ""}>${escapeHtml(text("adminConsentSortUserAsc"))}</option><option value="id.principalName,desc" ${sort === "id.principalName,desc" ? "selected" : ""}>${escapeHtml(text("adminConsentSortUserDesc"))}</option></select><div class="admin-consent-secondary-filters"><label class="sr-only" for="admin-consent-client">${escapeHtml(text("adminClientId"))}</label><input id="admin-consent-client" name="clientId" type="search" aria-label="${escapeHtml(text("adminClientId"))}" placeholder="${escapeHtml(text("adminClientId"))}" value="${escapeHtml(clientId)}" maxlength="100" ${filterBusy ? "disabled" : ""}/><label class="sr-only" for="admin-consent-user">${escapeHtml(text("adminSessionUser"))}</label><input id="admin-consent-user" name="username" type="search" aria-label="${escapeHtml(text("adminSessionUser"))}" placeholder="${escapeHtml(text("adminSessionUser"))}" value="${escapeHtml(username)}" maxlength="100" ${filterBusy ? "disabled" : ""}/><label class="sr-only" for="admin-consent-scope">${escapeHtml(text("adminConsentGrantedScopes"))}</label><input id="admin-consent-scope" name="scope" type="search" aria-label="${escapeHtml(text("adminConsentGrantedScopes"))}" placeholder="${escapeHtml(text("adminConsentGrantedScopes"))}" value="${escapeHtml(scope)}" maxlength="100" ${filterBusy ? "disabled" : ""}/>${hasFilters ? `<button class="secondary-button admin-consent-clear" type="button" data-action="admin-consent-clear-filters" ${filterBusy ? 'disabled aria-busy="true"' : ""}>${spin(state.busy === "admin-consents-clear")}${escapeHtml(text("adminClearFilters"))}</button>` : ""}</div></form><div class="admin-session-count" role="status">${totalElements} ${escapeHtml(text("adminConsentRecords"))}</div><div class="admin-session-table-scroll"><table class="admin-session-table admin-consent-table"><thead><tr><th>${escapeHtml(text("adminSessionUser"))}</th><th>${escapeHtml(text("adminConsentClient"))}</th><th>${escapeHtml(text("adminConsentGrantedScopes"))}</th><th>${escapeHtml(text("adminSessionCreatedAt"))}</th><th><span class="sr-only">${escapeHtml(text("adminSessionActions"))}</span></th></tr></thead><tbody>${rows || `<tr><td class="admin-session-empty" colspan="5"><div class="empty" role="status">${escapeHtml(text("adminConsentEmpty"))}</div></td></tr>`}</tbody></table></div><div class="admin-session-pagination ${totalElements === 0 ? "admin-consent-no-pagination" : ""}"><div class="admin-session-summary"><strong>${firstRecord}–${lastRecord}</strong><span> / ${totalElements}</span></div><div class="admin-session-pagination-controls"><label class="admin-session-page-size"><span>${escapeHtml(text("adminSessionRowsPerPage"))}</span><select id="admin-consent-size" aria-label="${escapeHtml(text("adminSessionRowsPerPage"))}" ${filterBusy ? "disabled" : ""}><option ${size === 10 ? "selected" : ""}>10</option><option ${size === 20 ? "selected" : ""}>20</option><option ${size === 50 ? "selected" : ""}>50</option><option ${size === 100 ? "selected" : ""}>100</option></select></label>${pageButton(0, text("adminSessionFirstPage"), "firstPage", currentPage <= 0, state.busy === "admin-consents-page-first")}${pageButton(currentPage - 1, text("adminPrevious"), "previousPage", currentPage <= 0, state.busy === "admin-consents-page-prev")}<span class="admin-session-page-indicator">${escapeHtml(text("adminPage"))} <strong>${totalPages === 0 ? 0 : currentPage + 1}</strong> / ${totalPages}</span>${pageButton(currentPage + 1, text("adminNext"), "nextPage", currentPage + 1 >= totalPages, state.busy === "admin-consents-page-next")}${pageButton(Math.max(totalPages - 1, 0), state.locale === "tr" ? "Son sayfa" : "Last page", "lastPage", currentPage + 1 >= totalPages, state.busy === "admin-consents-page-last")}</div></div></div></section>`;
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
        ? `<div class="actions"><span role="status">${escapeHtml(text("adminOfflineSessionRevokePrompt"))}</span>${button(text("adminRevokeOfflineSession"), { action: "admin-offline-session-revoke-confirm", index, danger: true, busy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-offline-session-revoke-cancel" ${chooseLazy(
            state.busy,
            () => "disabled",
            () => "",
          )}>${escapeHtml(text("cancel"))}</button></div>`
        : `<div class="actions">${button(text("adminRevokeOfflineSession"), { action: "admin-offline-session-revoke-request", index, danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
      return `<article class="list-item"><div><strong>${escapeHtml(session.clientName || session.clientId)}</strong><span class="muted">${escapeHtml(session.username)}</span></div>${controls}</article>`;
    })
    .join("");
  return `<section class="card" aria-label="${escapeHtml(text("adminOfflineSessions"))}">${sessions.length ? '<div class="list">' + rows + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("offlineSessionsEmpty")) + "</div>"}<div class="actions" aria-label="${escapeHtml(text("adminOfflineSessions"))} pagination"><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage - 1}" ${currentPage <= 0 || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-prev")}${escapeHtml(text("adminPrevious"))}</button><span>${escapeHtml(text("adminPage"))} ${totalPages === 0 ? 0 : currentPage + 1} / ${totalPages}</span><button class="secondary-button" type="button" data-admin-offline-session-page="${currentPage + 1}" ${currentPage + 1 >= totalPages || state.busy ? "disabled" : ""}>${spin(state.busy === "admin-offline-sessions-page-next")}${escapeHtml(text("adminNext"))}</button></div></section>`;
}

function adminAdminEventsContent() {
  const page = state.data.adminEvents ?? {
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  };
  const events = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const totalElements = Number.isSafeInteger(page.totalElements)
    ? page.totalElements
    : events.length;
  const query = state.data.adminEventQuery ?? "";
  const action = state.data.adminEventAction ?? "";
  const targetType = state.data.adminEventTargetType ?? "";
  const targetId = state.data.adminEventTargetId ?? "";
  const from = state.data.adminEventFrom ?? "";
  const to = state.data.adminEventTo ?? "";
  const sort = state.data.adminEventSort ?? "occurredAt,desc";
  const size = Number.isSafeInteger(state.data.adminEventSize)
    ? state.data.adminEventSize
    : 10;
  const filterBusy = Boolean(state.busy);
  const hasFilters = Boolean(
    query || action || targetType || targetId || from || to,
  );
  const types = [
    ...new Set(events.map((event) => event.action).filter(Boolean)),
  ].sort();
  const date = (value) =>
    value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleString(
          state.locale === "tr" ? "tr-TR" : "en-US",
        )
      : "—";
  const targetTypeLabel = (value) => {
    const keys = {
      client: "adminEventClient",
      user: "adminEventUser",
      session: "adminEventSession",
      consent: "adminEventConsent",
      key: "adminEventKey",
      role: "adminEventRole",
      "client-scope": "adminEventClientScope",
    };
    return keys[value] ? text(keys[value]) : value || "—";
  };
  const rows = events
    .map(
      (event, index) =>
        `<tr class="admin-clickable-row admin-event-row" data-admin-event-index="${index}" tabindex="0"><td>${escapeHtml(date(event.occurredAt))}</td><td><span class="admin-event-action">${escapeHtml(event.action ?? "—")}</span></td><td>${escapeHtml(event.actor || "—")}</td><td><div>${escapeHtml(targetTypeLabel(event.targetType))}</div><div class="admin-event-target-id">${escapeHtml(event.targetId || "—")}</div></td><td class="admin-event-open" aria-hidden="true">›</td></tr>`,
    )
    .join("");
  const filterLabels = [
    query && [text("adminSearch"), query],
    action && [text("adminEventAction"), action],
    targetType && [text("adminEventTargetType"), targetTypeLabel(targetType)],
    targetId && [text("adminEventTargetId"), targetId],
    from && [text("adminEventFrom"), from],
    to && [text("adminEventTo"), to],
  ].filter(Boolean);
  const pageButton = (target, label, icon, disabled, direction) =>
    `<button class="admin-session-page-button" type="button" data-admin-event-page="${target}" data-direction="${direction}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || filterBusy ? "disabled" : ""}>${spin(state.busy === `admin-events-page-${direction}`)}${state.busy === `admin-events-page-${direction}` ? "" : actionIcon(icon)}</button>`;
  const selected = state.data.adminEventSelected ?? null;
  const details = selected
    ? `<button class="admin-event-backdrop" type="button" data-action="admin-event-detail-close" aria-label="${escapeHtml(text("close"))}"></button><aside class="admin-event-drawer" aria-labelledby="admin-event-drawer-title"><header><h2 id="admin-event-drawer-title">${escapeHtml(text("adminEventDetails"))}</h2><button class="admin-event-drawer-close" type="button" data-action="admin-event-detail-close" aria-label="${escapeHtml(text("close"))}">×</button></header><dl><dt>ID</dt><dd class="admin-event-break">${escapeHtml(selected.id ?? "—")}</dd><dt>${escapeHtml(text("adminEventTime"))}</dt><dd>${escapeHtml(date(selected.occurredAt))}</dd><dt>${escapeHtml(text("adminEventAction"))}</dt><dd><code>${escapeHtml(selected.action ?? "—")}</code></dd><dt>${escapeHtml(text("adminEventActor"))}</dt><dd>${escapeHtml(selected.actor || "—")}</dd><dt>${escapeHtml(text("adminEventTargetType"))}</dt><dd>${escapeHtml(targetTypeLabel(selected.targetType))}</dd><dt>${escapeHtml(text("adminEventTarget"))}</dt><dd class="admin-event-break">${escapeHtml(selected.targetId || "—")}</dd>${selected.details ? `<dt>${escapeHtml(text("adminEventDetails"))}</dt><dd class="admin-event-break">${escapeHtml(selected.details)}</dd>` : ""}</dl></aside>`
    : "";
  const clearDialog = state.data.adminEventClearConfirm
    ? `<dialog class="native-modal" open aria-labelledby="admin-event-clear-title"><h2 id="admin-event-clear-title">${escapeHtml(text("adminEventClearAll"))}</h2><p>${escapeHtml(text("adminEventClearConfirm"))}</p><div class="actions"><button class="secondary-button" type="button" data-action="admin-event-clear-cancel" ${state.busy ? "disabled" : ""}>${escapeHtml(text("cancel"))}</button>${button(text("adminEventClearAll"), { action: "admin-event-clear-confirm", danger: true, busy: state.busy === "admin-events-clear", disabled: state.offline || Boolean(state.busy) })}</div></dialog>`
    : "";
  const clearError = state.data.adminEventClearError
    ? `<p class="notice error admin-event-clear-error" role="alert">${escapeHtml(text("adminEventClearError"))}</p>`
    : "";
  const clearSuccess = state.data.adminEventClearSuccess
    ? `<div class="notice success admin-event-clear-success" role="status">${escapeHtml(text("adminEventClearSuccess"))}</div>`
    : "";
  return `<section class="admin-events-page" aria-label="${escapeHtml(text("adminEvents"))}">${clearSuccess}${state.data.adminAccess?.manageEvents === true ? `<div class="admin-events-actions">${clearError}${button(text("adminEventClearAll"), { action: "admin-event-clear-request", danger: true, disabled: state.offline || Boolean(state.busy), icon: "delete" })}</div>` : ""}<div class="admin-sessions-card"><form id="admin-event-search" class="admin-session-filters admin-event-filters ${state.data.adminEventShowFilters ? "has-advanced" : ""}" role="search"><label class="admin-session-search"><span class="admin-session-search-icon" aria-hidden="true">${state.busy === "admin-events-search" ? spin(true) : actionIcon("search")}</span><span class="sr-only">${escapeHtml(text("adminSearchEvents"))}</span><input id="admin-event-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchEvents"))}" value="${escapeHtml(query)}" placeholder="${escapeHtml(text("adminEventFilter"))}" maxlength="200" ${filterBusy ? "disabled" : ""}/></label><button class="secondary-button admin-event-filter-toggle" type="button" data-action="admin-event-filter-toggle" aria-expanded="${state.data.adminEventShowFilters === true}" ${filterBusy ? "disabled" : ""}>${actionIcon("filter")}${escapeHtml(text(state.data.adminEventShowFilters ? "adminEventHideFilters" : "adminEventFilter"))}</button><label class="sr-only" for="admin-event-sort">${escapeHtml(text("adminSort"))}</label><select id="admin-event-sort" name="sort" aria-label="${escapeHtml(text("adminSort"))}" ${filterBusy ? "disabled" : ""}><option value="occurredAt,desc" ${sort === "occurredAt,desc" ? "selected" : ""}>${escapeHtml(text("adminNewest"))}</option><option value="occurredAt,asc" ${sort === "occurredAt,asc" ? "selected" : ""}>${escapeHtml(text("adminOldest"))}</option></select>${state.data.adminEventShowFilters ? `<label class="sr-only" for="admin-event-action">${escapeHtml(text("adminEventAction"))}</label><select id="admin-event-action" name="action" aria-label="${escapeHtml(text("adminEventAction"))}" ${filterBusy ? "disabled" : ""}><option value="">${escapeHtml(text("adminEventAllActions"))}</option>${types.map((eventType) => `<option value="${escapeHtml(eventType)}" ${action === eventType ? "selected" : ""}>${escapeHtml(eventType)}</option>`).join("")}</select><label class="sr-only" for="admin-event-target-type">${escapeHtml(text("adminEventTargetType"))}</label><select id="admin-event-target-type" name="targetType" aria-label="${escapeHtml(text("adminEventTargetType"))}" ${filterBusy ? "disabled" : ""}><option value="">${escapeHtml(text("adminEventAllTargetTypes"))}</option>${["client", "user", "session", "consent", "key", "role", "client-scope"].map((value) => `<option value="${value}" ${targetType === value ? "selected" : ""}>${escapeHtml(targetTypeLabel(value))}</option>`).join("")}</select><label class="sr-only" for="admin-event-target-id">${escapeHtml(text("adminEventTargetId"))}</label><input id="admin-event-target-id" name="targetId" type="search" aria-label="${escapeHtml(text("adminEventTargetId"))}" placeholder="${escapeHtml(text("adminEventTargetId"))}" value="${escapeHtml(targetId)}" maxlength="100" ${filterBusy ? "disabled" : ""}/><label class="admin-event-date"><span>${escapeHtml(text("adminEventFrom"))}</span><input id="admin-event-from" name="from" type="date" value="${escapeHtml(from)}" aria-label="${escapeHtml(text("adminEventFrom"))}" ${filterBusy ? "disabled" : ""}/></label><label class="admin-event-date"><span>${escapeHtml(text("adminEventTo"))}</span><input id="admin-event-to" name="to" type="date" value="${escapeHtml(to)}" aria-label="${escapeHtml(text("adminEventTo"))}" ${filterBusy ? "disabled" : ""}/></label>` : ""}</form><div class="admin-session-count admin-event-count" role="status"><span>${totalElements} ${escapeHtml(text("adminEventRecords"))}</span>${hasFilters ? `<div class="admin-event-active-filters">${filterLabels.map(([label, value]) => `<span class="admin-key-filter-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join("")}<button class="secondary-button admin-key-clear" type="button" data-action="admin-event-clear-filters" ${filterBusy ? "disabled" : ""}>${escapeHtml(text("adminEventClearFilters"))}</button></div>` : ""}</div><div class="admin-session-table-scroll"><table class="admin-session-table admin-event-table"><thead><tr><th>${escapeHtml(text("adminEventTime"))}</th><th>${escapeHtml(text("adminEventAction"))}</th><th>${escapeHtml(text("adminEventActor"))}</th><th>${escapeHtml(text("adminEventTarget"))}</th><th><span class="sr-only">${escapeHtml(text("adminEventDetails"))}</span></th></tr></thead><tbody>${rows || `<tr><td class="admin-session-empty" colspan="5"><div class="empty" role="status">${escapeHtml(text("adminEventEmpty"))}</div></td></tr>`}</tbody></table></div><div class="admin-session-pagination ${totalElements === 0 ? "admin-event-no-pagination" : ""}"><div class="admin-session-summary"><strong>${totalElements === 0 ? 0 : currentPage * size + 1}–${Math.min((currentPage + 1) * size, totalElements)}</strong><span> / ${totalElements}</span></div>${totalElements ? `<div class="admin-session-pagination-controls"><label class="admin-session-page-size"><span>${escapeHtml(text("adminSessionRowsPerPage"))}</span><select id="admin-event-size" aria-label="${escapeHtml(text("adminSessionRowsPerPage"))}" ${filterBusy ? "disabled" : ""}><option ${size === 10 ? "selected" : ""}>10</option><option ${size === 20 ? "selected" : ""}>20</option><option ${size === 50 ? "selected" : ""}>50</option><option ${size === 100 ? "selected" : ""}>100</option></select></label>${pageButton(0, text("adminSessionFirstPage"), "firstPage", currentPage <= 0, "first")}${pageButton(currentPage - 1, text("adminPrevious"), "previousPage", currentPage <= 0, "prev")}<span class="admin-session-page-indicator">${escapeHtml(text("adminPage"))} <strong>${currentPage + 1}</strong> / ${Math.max(totalPages, 1)}</span>${pageButton(currentPage + 1, text("adminNext"), "nextPage", currentPage + 1 >= totalPages, "next")}${pageButton(Math.max(totalPages - 1, 0), text("adminSessionLastPage"), "lastPage", currentPage + 1 >= totalPages, "last")}</div>` : ""}</div></div>${details}${clearDialog}</section>`;
}

function adminAdminKeysContent() {
  const page = state.data.adminKeys ?? {
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  };
  const keys = Array.isArray(page.content) ? page.content : [];
  const currentPage = Number.isSafeInteger(page.number) ? page.number : 0;
  const totalPages = Number.isSafeInteger(page.totalPages)
    ? page.totalPages
    : 0;
  const totalElements = Number.isSafeInteger(page.totalElements)
    ? page.totalElements
    : keys.length;
  const size = Number.isSafeInteger(state.data.adminKeySize)
    ? state.data.adminKeySize
    : 10;
  const sort = state.data.adminKeySort ?? "createdAt,desc";
  const active = state.data.adminKeyActive ?? "";
  const queryText = state.data.adminKeyQuery ?? "";
  const hasFilters = Boolean(queryText || (active && active !== "all"));
  const filterBusy = Boolean(state.busy);
  const firstRecord = totalElements === 0 ? 0 : currentPage * size + 1;
  const lastRecord = Math.min((currentPage + 1) * size, totalElements);
  const date = (value) =>
    value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleString(
          state.locale === "tr" ? "tr-TR" : "en-US",
        )
      : "—";
  const rows = keys
    .map(
      (key) =>
        `<tr><td><code class="admin-key-id">${escapeHtml(key.kid ?? key.keyId ?? "—")}</code></td><td>${escapeHtml(key.type ?? "—")}</td><td>${escapeHtml(key.algorithm ?? "—")}</td><td><span class="admin-session-status ${key.active ? "is-active" : "is-expired"}">${escapeHtml(text(key.active ? "adminKeyActive" : "adminKeyInactive"))}</span></td><td>${escapeHtml(date(key.createdAt))}</td></tr>`,
    )
    .join("");
  const pageButton = (target, label, icon, disabled, direction) =>
    `<button class="admin-session-page-button" type="button" data-admin-key-page="${target}" data-direction="${direction}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled || filterBusy ? "disabled" : ""}>${spin(state.busy === `admin-keys-page-${direction}`)}${state.busy === `admin-keys-page-${direction}` ? "" : actionIcon(icon)}</button>`;
  const rotatedResult = state.data.adminKeyRotatedResult
    ? `<dialog class="native-modal" open aria-labelledby="admin-key-rotated-title"><h2 id="admin-key-rotated-title">${escapeHtml(text("adminKeyRotatedTitle"))}</h2><p>${escapeHtml(text("adminKeyRotatedHelp"))}</p><p><code>${escapeHtml(state.data.adminKeyRotatedResult.kid ?? "")}</code></p><div class="actions"><button class="primary-button" type="button" data-action="admin-key-rotated-close">${escapeHtml(text("close"))}</button></div></dialog>`
    : "";
  return `<section class="admin-sessions-page admin-keys-page" aria-label="${escapeHtml(text("adminNavKeys"))}"><div class="admin-sessions-card"><form id="admin-key-search" class="admin-session-filters admin-key-filters" role="search"><label class="admin-session-search"><span class="admin-session-search-icon" aria-hidden="true">${state.busy === "admin-keys-search" ? spin(true) : actionIcon("search")}</span><span class="sr-only">${escapeHtml(text("adminSearchKeys"))}</span><input id="admin-key-query" name="q" type="search" aria-label="${escapeHtml(text("adminSearchKeys"))}" value="${escapeHtml(queryText)}" placeholder="${escapeHtml(text("adminSearch"))}" maxlength="200" ${filterBusy ? "disabled" : ""}/></label><label class="sr-only" for="admin-key-sort">${escapeHtml(text("adminSort"))}</label><select id="admin-key-sort" name="sort" aria-label="${escapeHtml(text("adminSort"))}" ${filterBusy ? "disabled" : ""}><option value="createdAt,desc" ${sort === "createdAt,desc" ? "selected" : ""}>${escapeHtml(text("adminNewest"))}</option><option value="createdAt,asc" ${sort === "createdAt,asc" ? "selected" : ""}>${escapeHtml(text("adminOldest"))}</option></select><label class="sr-only" for="admin-key-active">${escapeHtml(text("adminKeyStatus"))}</label><select id="admin-key-active" name="active" aria-label="${escapeHtml(text("adminKeyStatus"))}" ${filterBusy ? "disabled" : ""}><option value="" ${active === "" || active === "all" ? "selected" : ""}>${escapeHtml(text("adminAll"))}</option><option value="true" ${active === "true" ? "selected" : ""}>${escapeHtml(text("adminKeyActive"))}</option><option value="false" ${active === "false" ? "selected" : ""}>${escapeHtml(text("adminKeyInactive"))}</option></select></form><div class="admin-session-count admin-key-count" role="status"><span>${totalElements} ${escapeHtml(text("adminSessionRecords"))}</span>${hasFilters ? `<div class="admin-key-active-filters">${queryText ? `<span class="admin-key-filter-chip">${escapeHtml(text("adminSearch"))}: ${escapeHtml(queryText)}</span>` : ""}${active && active !== "all" ? `<span class="admin-key-filter-chip">${escapeHtml(text("adminKeyStatus"))}: ${escapeHtml(text(active === "true" ? "adminKeyActive" : "adminKeyInactive"))}</span>` : ""}<button class="secondary-button admin-key-clear" type="button" data-action="admin-key-clear-filters" ${filterBusy ? "disabled" : ""}>${escapeHtml(text("adminClearFilters"))}</button></div>` : ""}</div><div class="admin-session-table-scroll"><table class="admin-session-table admin-key-table"><thead><tr><th>${escapeHtml(text("adminKeyId"))}</th><th>${escapeHtml(text("adminKeyType"))}</th><th>${escapeHtml(text("adminKeyAlgorithm"))}</th><th>${escapeHtml(text("adminStatus"))}</th><th>${escapeHtml(text("adminSessionCreatedAt"))}</th></tr></thead><tbody>${rows || `<tr><td class="admin-session-empty" colspan="5"><div class="empty" role="status">${escapeHtml(text("adminNoKeys"))}</div></td></tr>`}</tbody></table></div><div class="admin-session-pagination ${totalElements === 0 ? "admin-key-no-pagination" : ""}"><div class="admin-session-summary"><strong>${firstRecord}–${lastRecord}</strong><span> / ${totalElements}</span></div>${totalElements ? `<div class="admin-session-pagination-controls"><label class="admin-session-page-size"><span>${escapeHtml(text("adminSessionRowsPerPage"))}</span><select id="admin-key-size" aria-label="${escapeHtml(text("adminSessionRowsPerPage"))}" ${filterBusy ? "disabled" : ""}><option ${size === 10 ? "selected" : ""}>10</option><option ${size === 20 ? "selected" : ""}>20</option><option ${size === 50 ? "selected" : ""}>50</option><option ${size === 100 ? "selected" : ""}>100</option></select></label>${pageButton(0, text("adminSessionFirstPage"), "firstPage", currentPage <= 0, "first")}${pageButton(currentPage - 1, text("adminPrevious"), "previousPage", currentPage <= 0, "prev")}<span class="admin-session-page-indicator">${escapeHtml(text("adminPage"))} <strong>${currentPage + 1}</strong> / ${Math.max(totalPages, 1)}</span>${pageButton(currentPage + 1, text("adminNext"), "nextPage", currentPage + 1 >= totalPages, "next")}${pageButton(Math.max(totalPages - 1, 0), text("adminSessionLastPage"), "lastPage", currentPage + 1 >= totalPages, "last")}</div>` : ""}</div></div>${rotatedResult}</section>`;
}

function adminAdminPoliciesContent() {
  const ciba = state.data.cibaPolicy ?? {};
  const offline = state.data.offlineAccessPolicy ?? {};
  const cibaDraft = state.data.cibaPolicyDraft ?? ciba;
  const offlineDraft = state.data.offlineAccessPolicyDraft ?? offline;
  const errors = violations(state.error?.body);
  const revokeBusy = state.busy === "admin-offline-access-revoke";
  const revokeAll = state.data.offlineAccessRevokeConfirm
    ? `<div class="actions"><span role="status">${escapeHtml(text("adminRevokeAllOfflineTokensConfirm"))}</span>${button(text("adminRevokeAllOfflineTokens"), { action: "admin-offline-access-revoke-confirm", danger: true, busy: revokeBusy, disabled: state.offline || Boolean(state.busy) })}<button class="secondary-button" type="button" data-action="admin-offline-access-revoke-cancel" ${chooseLazy(
        state.busy,
        () => "disabled",
        () => "",
      )}>${escapeHtml(text("cancel"))}</button></div>`
    : `<div class="settings-row"><div><strong>${escapeHtml(text("adminRevokeAllOfflineTokensTitle"))}</strong><p class="muted">${escapeHtml(text("adminRevokeAllOfflineTokensHelp"))}</p></div>${button(text("adminRevokeAllOfflineTokens"), { action: "admin-offline-access-revoke-request", danger: true, disabled: state.offline || Boolean(state.busy) })}</div>`;
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminCibaPolicy"))}"><h2>${escapeHtml(text("adminCibaPolicy"))}</h2><form data-form="admin-ciba-policy" novalidate>${field("requestLifespanSeconds", text("adminRequestLifespan"), cibaDraft.requestLifespanSeconds ?? "", errors.requestLifespanSeconds, "number", 'min="30" max="3600" required')}${field("pollingIntervalSeconds", text("adminPollingInterval"), cibaDraft.pollingIntervalSeconds ?? "", errors.pollingIntervalSeconds, "number", 'min="1" max="300" required')}<div class="field"><label for="deliveryMode">${escapeHtml(text("adminDeliveryMode"))}</label><select id="deliveryMode" name="deliveryMode"><option value="all" ${cibaDraft.deliveryMode === "all" ? "selected" : ""}>all</option><option value="poll" ${cibaDraft.deliveryMode === "poll" ? "selected" : ""}>poll</option><option value="ping" ${cibaDraft.deliveryMode === "ping" ? "selected" : ""}>ping</option><option value="push" ${cibaDraft.deliveryMode === "push" ? "selected" : ""}>push</option></select><div class="field-error">${escapeHtml(errors.deliveryMode ?? "")}</div></div><div class="field"><label for="userVerification">${escapeHtml(text("adminUserVerification"))}</label><select id="userVerification" name="userVerification"><option value="required" ${cibaDraft.userVerification === "required" ? "selected" : ""}>required</option><option value="preferred" ${cibaDraft.userVerification === "preferred" ? "selected" : ""}>preferred</option><option value="discouraged" ${cibaDraft.userVerification === "discouraged" ? "selected" : ""}>discouraged</option></select><div class="field-error">${escapeHtml(errors.userVerification ?? "")}</div></div><label class="settings-row"><input type="checkbox" name="mfaRequired" ${cibaDraft.mfaRequired ? "checked" : ""}/>${escapeHtml(text("adminMfaRequired"))}</label><label class="settings-row"><input type="checkbox" name="stepUpRequired" ${cibaDraft.stepUpRequired ? "checked" : ""}/>${escapeHtml(text("adminStepUpRequired"))}</label>${field("stepUpAcr", text("adminStepUpAcr"), cibaDraft.stepUpAcr ?? "", errors.stepUpAcr, "text", 'maxlength="100"')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-ciba-policy", disabled: state.offline })}</div></form></section><section class="card" aria-label="${escapeHtml(text("adminOfflineAccessPolicy"))}"><h2>${escapeHtml(text("adminOfflineAccessPolicy"))}</h2><form data-form="admin-offline-access-policy" novalidate>${field("idleTimeout", text("adminIdleTimeout"), offlineDraft.idleTimeout ?? "", errors.idleTimeout, "text", 'required placeholder="P30D"')}${field("maxLifespan", text("adminMaxLifespan"), offlineDraft.maxLifespan ?? "", errors.maxLifespan, "text", 'placeholder="P180D"')}<div class="field"><label class="settings-row"><input type="checkbox" name="maxLimited" ${offlineDraft.maxLimited ? "checked" : ""}/>${escapeHtml(text("adminMaxLimited"))}</label><div class="field-error">${escapeHtml(errors.maxLimited ?? "")}</div></div><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-offline-access-policy", disabled: state.offline })}</div></form><div class="actions">${revokeAll}</div></section></div>`;
}

function adminAdminConfigurationContent() {
  const branding = state.data.adminBranding ?? {};
  const brandingDraft = state.data.adminBrandingDraft ?? branding;
  const brandingErrors = violations(state.error?.body);
  const row = (label, value) =>
    `<div class="list-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value ?? text("adminNotConfigured"))}</span></div>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminBranding"))}"><h2>${escapeHtml(text("adminBranding"))}</h2><div class="list">${row(text("adminLogoPath"), branding.logoPath)}${row(text("adminFaviconPath"), branding.faviconPath)}${row(text("adminAppleTouchIconPath"), branding.appleTouchIconPath)}</div><form data-form="admin-branding" novalidate>${field("applicationName", text("adminApplicationName"), brandingDraft.applicationName ?? "", brandingErrors.applicationName, "text", 'maxlength="100" required')}${field("primaryColor", text("adminPrimaryColor"), brandingDraft.primaryColor ?? "", brandingErrors.primaryColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}${field("accentColor", text("adminAccentColor"), brandingDraft.accentColor ?? "", brandingErrors.accentColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}${field("backgroundColor", text("adminBackgroundColor"), brandingDraft.backgroundColor ?? "", brandingErrors.backgroundColor, "text", 'pattern="#[0-9A-Fa-f]{6}" maxlength="7" required')}<div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-branding", disabled: state.offline })}</div></form></section>`;
}

function adminServerInfoContent() {
  const server = state.data.adminServerInfo ?? {};
  const loading = state.loading && !state.data.adminServerInfo;
  const loadError = state.data.adminServerInfoLoadError;
  const copyFailed = state.data.adminServerInfoCopyFailed;
  if (loading)
    return `<p role="status">${escapeHtml(text("adminServerInfoLoading"))}</p>`;
  if (loadError)
    return `<div class="notice error" role="alert">${escapeHtml(text("adminServerInfoLoadError"))}</div>`;
  const copyButton = (id) => {
    const busy = state.busy === `server-info-copy:${id}`;
    const copied = state.data.adminServerInfoCopied === id;
    const label = copied ? text("adminCopied") : text("adminCopy");
    return `<button class="${copied ? "success-button" : "secondary-button"}" type="button" data-action="server-info-copy" data-copy-id="${escapeHtml(id)}" aria-label="${escapeHtml(label)}" ${state.busy ? "disabled" : ""}>${spin(busy)}${escapeHtml(label)}</button>`;
  };
  const endpointRows = [
    ["issuer", "adminIssuer", server.issuer],
    [
      "authorization",
      "adminAuthorizationEndpoint",
      server.authorizationEndpoint,
    ],
    ["token", "adminTokenEndpoint", server.tokenEndpoint],
    [
      "introspection",
      "adminIntrospectionEndpoint",
      server.introspectionEndpoint,
    ],
    ["revocation", "adminRevocationEndpoint", server.revocationEndpoint],
    ["userInfo", "adminUserInfoEndpoint", server.userInfoEndpoint],
    ["jwks", "adminJwksEndpoint", server.jwksEndpoint],
    ["endSession", "adminEndSessionEndpoint", server.endSessionEndpoint],
  ];
  const endpointTable = endpointRows
    .map(
      ([id, label, value]) =>
        `<tr><th scope="row">${escapeHtml(text(label))}</th><td><code>${escapeHtml(value ?? "—")}</code></td><td>${value ? copyButton(`endpoint:${id}`) : ""}</td></tr>`,
    )
    .join("");
  const activeKey = server.activeSigningKey;
  const locale = state.locale === "tr" ? "tr-TR" : "en-US";
  const runtimeKey = activeKey
    ? `<div class="server-info-key"><code>${escapeHtml(activeKey.kid)}</code><span class="server-info-badge is-success">${escapeHtml(text("adminActive"))}</span><span class="server-info-badge">${escapeHtml(activeKey.algorithm)}</span><span class="muted">${escapeHtml(new Date(activeKey.createdAt).toLocaleString(locale))}</span><span class="muted">${escapeHtml(text("adminKeyType"))}: ${escapeHtml(activeKey.type)} · ${escapeHtml(text("adminKeyUse"))}: ${escapeHtml(activeKey.use)}</span></div>`
    : "—";
  const tab = state.data.adminServerInfoTab ?? "discovery";
  const json =
    tab === "jwks"
      ? state.data.adminServerJwks
      : state.data.adminServerDiscovery;
  const endpoint =
    tab === "jwks" ? server.jwksEndpoint : server.discoveryEndpoint;
  const tabError =
    tab === "jwks"
      ? state.data.adminServerJwksError
      : state.data.adminServerDiscoveryError;
  const jsonText = JSON.stringify(json ?? {}, null, 2);
  const jsonPanel = tabError
    ? `<div class="notice warning" role="status">${escapeHtml(text(tab === "jwks" ? "adminJwksError" : "adminConfigurationError"))}</div>`
    : `<pre class="server-info-json">${escapeHtml(jsonText)}</pre>`;
  return `<div class="server-info-layout">${copyFailed ? `<div class="notice warning" role="status">${escapeHtml(text("adminServerInfoCopyFailed"))}</div>` : ""}<section class="card server-info-card"><h2>${escapeHtml(text("adminServerRuntime"))}</h2><dl class="server-info-runtime"><dt>${escapeHtml(text("adminSessionTimeout"))}</dt><dd>${escapeHtml(server.sessionTimeout ?? "—")}</dd><dt>${escapeHtml(text("adminActiveSigningKey"))}</dt><dd>${runtimeKey}</dd></dl></section><section class="card server-info-card"><h2>OIDC / OAuth 2.0 ${escapeHtml(text("adminEndpoints"))}</h2><div class="server-info-table-wrap"><table class="server-info-table"><thead><tr><th scope="col">${escapeHtml(text("adminTableName"))}</th><th scope="col">${escapeHtml(text("adminUrl"))}</th><th scope="col"><span class="sr-only">${escapeHtml(text("adminCopy"))}</span></th></tr></thead><tbody>${endpointTable}</tbody></table></div></section><section class="card server-info-card"><div class="server-info-tabs" role="tablist" aria-label="OIDC / OAuth 2.0"><button type="button" role="tab" aria-selected="${tab === "discovery"}" class="${tab === "discovery" ? "is-active" : ""}" data-action="server-info-tab" data-tab="discovery">${escapeHtml(text("adminDiscovery"))}</button><button type="button" role="tab" aria-selected="${tab === "jwks"}" class="${tab === "jwks" ? "is-active" : ""}" data-action="server-info-tab" data-tab="jwks">${escapeHtml(text("adminJwks"))}</button></div><div class="server-info-tab-content" role="tabpanel"><div class="server-info-json-heading"><span class="muted">${escapeHtml(endpoint ?? "—")}</span>${json !== undefined && !tabError ? `<button class="secondary-button" type="button" data-action="server-info-copy" data-copy-id="json:${tab}" ${state.busy ? "disabled" : ""}>${spin(state.busy === `server-info-copy:json:${tab}`)}${escapeHtml(state.data.adminServerInfoCopied === `json:${tab}` ? text("adminCopied") : text("adminCopyJson"))}</button>` : ""}</div>${jsonPanel}</div></section></div>`;
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
  const localizationSettingsForm = `<form data-form="admin-localization-settings" novalidate><label class="settings-row"><input type="checkbox" name="internationalizationEnabled" ${localizationDraft.internationalizationEnabled ? "checked" : ""}/>${escapeHtml(text("adminLocalizationEnabled"))}</label><div class="field"><label for="localizationDefaultLocale">${escapeHtml(text("adminDefaultLocale"))}</label><select id="localizationDefaultLocale" name="defaultLocale">${availableLocales.map((locale) => '<option value="' + escapeHtml(locale) + '" ' + (localizationDraft.defaultLocale === locale ? "selected" : "") + ">" + escapeHtml(locale) + "</option>").join("")}</select><div class="field-error">${escapeHtml(errors.defaultLocale ?? "")}</div></div><fieldset class="field"><legend>${escapeHtml(text("adminSupportedLocales"))}</legend>${availableLocales.map((locale) => '<label class="settings-row"><input type="checkbox" name="supportedLocales" value="' + escapeHtml(locale) + '" ' + (supportedLocales.includes(locale) ? "checked" : "") + "/>" + escapeHtml(locale) + "</label>").join("")}<div class="field-error">${escapeHtml(errors.supportedLocales ?? "")}</div></fieldset><div class="actions">${button(text("save"), { type: "submit", busy: state.busy === "admin-localization-settings", disabled: state.offline })}</div></form>`;
  const overrideField = (item, name, label, value, error) => {
    const id = `override-${item.id}-${name}`;
    return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" name="${name}" value="${escapeHtml(value ?? "")}" aria-invalid="${Boolean(error)}" required maxlength="${
      name === "messageValue"
        ? 4000
        : chooseLazy(
            name === "locale",
            () => 10,
            () =>
              chooseLazy(
                name === "bundle",
                () => 50,
                () => 255,
              ),
          )
    }"/><div class="field-error" id="${id}-error">${escapeHtml(error ?? "")}</div></div>`;
  };
  const createDraft = state.data.adminMessageOverrideCreateDraft ?? {};
  const createErrors = messageErrorTarget === "create" ? errors : {};
  const createForm = `<form data-form="admin-localization-message-create" novalidate><div class="field"><label for="new-override-locale">${escapeHtml(text("adminMessageLocale"))}</label><select id="new-override-locale" name="locale" required>${supportedLocales.map((locale) => '<option value="' + escapeHtml(locale) + '" ' + (createDraft.locale === locale ? "selected" : "") + ">" + escapeHtml(locale) + "</option>").join("")}</select><div class="field-error">${escapeHtml(createErrors.locale ?? "")}</div></div><div class="field"><label for="new-override-bundle">${escapeHtml(text("adminMessageBundle"))}</label><select id="new-override-bundle" name="bundle" required>${availableBundles.map((bundle) => '<option value="' + escapeHtml(bundle) + '" ' + (createDraft.bundle === bundle ? "selected" : "") + ">" + escapeHtml(bundle) + "</option>").join("")}</select><div class="field-error">${escapeHtml(createErrors.bundle ?? "")}</div></div>${field("messageKey", text("adminMessageKey"), createDraft.messageKey ?? "", createErrors.messageKey, "text", 'maxlength="255" pattern="[A-Za-z0-9_.-]+" required')}<div class="field"><label for="new-override-value">${escapeHtml(text("adminMessageValue"))}</label><textarea id="new-override-value" name="messageValue" required maxlength="4000">${escapeHtml(createDraft.messageValue ?? "")}</textarea><div class="field-error">${escapeHtml(createErrors.messageValue ?? "")}</div></div><div class="actions">${button(text("adminCreateMessageOverride"), { type: "submit", busy: state.busy === "admin-message-create", disabled: state.offline })}</div></form>`;
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminLocalizationSettings"))}"><h2>${escapeHtml(text("adminLocalizationSettings"))}</h2><div class="list">${row(
    text("adminLocalizationEnabled"),
    settings.internationalizationEnabled === true
      ? text("adminEnabled")
      : chooseLazy(
          settings.internationalizationEnabled === false,
          () => text("adminDisabled"),
          () => undefined,
        ),
  )}${row(text("adminDefaultLocale"), settings.defaultLocale)}${row(text("adminSupportedLocales"), list(settings.supportedLocales))}${row(text("adminAvailableLocales"), list(settings.availableLocales))}${row(text("adminAvailableBundles"), list(settings.availableBundles))}</div></section><section class="card" aria-label="${escapeHtml(text("adminMessageOverrides"))}"><h2>${escapeHtml(text("adminMessageOverrides"))}</h2>${
    overrides.length
      ? '<div class="list">' +
        overrides
          .map((item) => {
            const values = drafts[item.id] ?? item;
            const itemErrors = chooseLazy(
              messageErrorTarget === "update:" + item.id + "",
              () => errors,
              () => ({}),
            );
            const deletePending =
              String(state.data.adminMessageDeleteConfirmId) ===
              String(item.id);
            const deleteControls = chooseLazy(
              deletePending,
              () =>
                '<div class="actions"><span role="status">' +
                escapeHtml(text("adminMessageOverrideDeletePrompt")) +
                "</span>" +
                button(text("adminMessageOverrideDelete"), {
                  action: "admin-message-delete-confirm",
                  id: item.id,
                  danger: true,
                  busy: state.busy === "admin-message-delete:" + item.id + "",
                  disabled: state.offline || Boolean(state.busy),
                }) +
                '<button class="secondary-button" type="button" data-action="admin-message-delete-cancel" ' +
                chooseLazy(
                  state.busy,
                  () => "disabled",
                  () => "",
                ) +
                ">" +
                escapeHtml(text("cancel")) +
                "</button></div>",
              () =>
                '<div class="actions">' +
                button(text("adminMessageOverrideDelete"), {
                  action: "admin-message-delete-request",
                  id: item.id,
                  danger: true,
                  disabled: state.offline || Boolean(state.busy),
                }) +
                "</div>",
            );
            return (
              '<article class="list-item"><strong>' +
              escapeHtml(
                "" +
                  item.locale +
                  " · " +
                  item.bundle +
                  " · " +
                  item.messageKey +
                  "",
              ) +
              '</strong><form data-form="admin-localization-message" data-id="' +
              escapeHtml(item.id) +
              '" novalidate>' +
              overrideField(
                item,
                "locale",
                text("adminMessageLocale"),
                values.locale,
                itemErrors.locale,
              ) +
              "" +
              overrideField(
                item,
                "bundle",
                text("adminMessageBundle"),
                values.bundle,
                itemErrors.bundle,
              ) +
              "" +
              overrideField(
                item,
                "messageKey",
                text("adminMessageKey"),
                values.messageKey,
                itemErrors.messageKey,
              ) +
              '<div class="field"><label for="override-' +
              escapeHtml(item.id) +
              '-messageValue">' +
              escapeHtml(text("adminMessageValue")) +
              '</label><textarea id="override-' +
              escapeHtml(item.id) +
              '-messageValue" name="messageValue" required maxlength="4000" aria-invalid="' +
              Boolean(itemErrors.messageValue) +
              '">' +
              escapeHtml(formString(values.messageValue, "")) +
              '</textarea><div class="field-error" id="override-' +
              escapeHtml(item.id) +
              '-messageValue-error">' +
              escapeHtml(itemErrors.messageValue ?? "") +
              '</div></div><div class="actions">' +
              button(text("save"), {
                type: "submit",
                busy: state.busy === "admin-message-" + item.id + "",
                disabled: state.offline,
              }) +
              "</div></form>" +
              deleteControls +
              "</article>"
            );
          })
          .join("") +
        "</div>"
      : '<div class="empty" role="status">' +
        escapeHtml(text("adminNoMessageOverrides")) +
        "</div>"
  }${createForm}${localizationSettingsForm}</section></div>`;
}

function adminAdminLdapContent() {
  const providers = Array.isArray(state.data.adminLdapProviders)
    ? state.data.adminLdapProviders
    : [];
  const enabled = (value) =>
    value === true
      ? text("adminEnabled")
      : chooseLazy(
          value === false,
          () => text("adminDisabled"),
          () => text("adminNotConfigured"),
        );
  const count = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? String(value) : "0";
  if (providers.length === 0)
    return `<section class="card" aria-label="${escapeHtml(text("adminLdap"))}"><div class="empty" role="status">${escapeHtml(text("adminNoLdapProviders"))}</div></section>`;
  return `<section class="card" aria-label="${escapeHtml(text("adminLdap"))}"><div class="list">${providers
    .map(
      (provider) =>
        '<article class="list-item"><div><strong>' +
        escapeHtml(provider.name) +
        '</strong><span class="muted">' +
        escapeHtml(
          "" +
            (provider.vendor ?? "LDAP") +
            " · " +
            (provider.authenticationType ?? "") +
            " · " +
            (provider.editMode ?? "") +
            "",
        ) +
        '</span><span class="muted">' +
        escapeHtml(text("adminLdapSyncSummary")) +
        ": " +
        escapeHtml(count(provider.lastSyncImported)) +
        " " +
        escapeHtml(text("adminLdapImported")) +
        " · " +
        escapeHtml(count(provider.lastSyncUpdated)) +
        " " +
        escapeHtml(text("adminLdapUpdated")) +
        "</span>" +
        (provider.lastSyncAt
          ? '<time class="muted" datetime="' +
            escapeHtml(provider.lastSyncAt) +
            '">' +
            escapeHtml(
              new Date(provider.lastSyncAt).toLocaleString(
                chooseLazy(
                  state.locale === "tr",
                  () => "tr-TR",
                  () => "en-US",
                ),
              ),
            ) +
            "</time>"
          : "") +
        "</div><div><span>" +
        escapeHtml(
          provider.enabled ? text("adminEnabled") : text("adminDisabled"),
        ) +
        '</span><span class="muted">' +
        escapeHtml(text("adminLdapImportUsers")) +
        ": " +
        escapeHtml(enabled(provider.importUsers)) +
        '</span><span class="muted">' +
        escapeHtml(text("adminLdapTrustEmail")) +
        ": " +
        escapeHtml(enabled(provider.trustEmail)) +
        "</span>" +
        (provider.lastSyncStatus
          ? '<span class="muted">' +
            escapeHtml(text("adminLdapSyncStatus")) +
            ": " +
            escapeHtml(provider.lastSyncStatus) +
            "</span>"
          : "") +
        "</div></article>",
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
  return `<div class="grid two-col"><section class="card" aria-label="${escapeHtml(text("adminAuthenticationFlows"))}"><h2>${escapeHtml(text("adminAuthenticationFlows"))}</h2>${
    flows.length
      ? '<div class="list">' +
        flows
          .map(
            (flow) =>
              '<article class="list-item"><div><strong>' +
              escapeHtml(flow.name) +
              '</strong><span class="muted">' +
              escapeHtml("" + flow.alias + " · " + flow.flowType + "") +
              "</span>" +
              chooseLazy(
                flow.description,
                () =>
                  '<span class="muted">' +
                  escapeHtml(flow.description) +
                  "</span>",
                () => "",
              ) +
              "</div><span>" +
              escapeHtml(
                chooseLazy(
                  flow.builtIn,
                  () => text("adminBuiltIn"),
                  () => text("adminCustom"),
                ),
              ) +
              "</span></article>",
          )
          .join("") +
        "</div>"
      : '<div class="empty" role="status">' +
        escapeHtml(text("adminNoAuthenticationFlows")) +
        "</div>"
  }</section><section class="card" aria-label="${escapeHtml(text("adminAuthenticationBindings"))}"><h2>${escapeHtml(text("adminAuthenticationBindings"))}</h2>${bindings.length ? '<div class="list">' + bindings.map((binding) => '<article class="list-item"><strong>' + escapeHtml(binding.bindingType) + "</strong><span>" + escapeHtml(binding.flowName ?? text("adminNotConfigured")) + "</span></article>").join("") + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("adminNoAuthenticationBindings")) + "</div>"}</section><section class="card" aria-label="${escapeHtml(text("adminExecutionProviders"))}"><h2>${escapeHtml(text("adminExecutionProviders"))}</h2>${providers.length ? '<div class="list">' + providers.map((provider) => '<div class="list-item"><span>' + escapeHtml(provider) + "</span></div>").join("") + "</div>" : '<div class="empty" role="status">' + escapeHtml(text("adminNoExecutionProviders")) + "</div>"}</section></div>`;
}

function profileContent() {
  const profile = {
    ...state.profile,
    ...state.data.accountProfileDraft,
  };
  const errors = violations(state.error?.body);
  return `<section class="card"><h2>${escapeHtml(text("firstName"))} &amp; ${escapeHtml(text("lastName"))}</h2><p>${escapeHtml(text("profileLoadError"))}</p><form data-form="profile" novalidate><div class="form-grid">${field("firstName", text("firstName"), profile.firstName ?? "", errors.firstName)}${field("lastName", text("lastName"), profile.lastName ?? "", errors.lastName)}${field("email", text("email"), profile.email ?? "", errors.email, "email")}<div class="field"><label for="preferredLocale">${escapeHtml(text("language"))}</label><select id="preferredLocale" name="preferredLocale"><option value="en" ${profile.preferredLocale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${profile.preferredLocale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select><div class="field-error"></div></div>${field("currentPassword", text("currentPassword"), "", errors.currentPassword, "password", 'autocomplete="current-password"')}</div><div class="actions">${button(text("save"), { action: "save-profile", type: "submit", busy: state.busy === "profile", mutation: true })}</div></form></section>`;
}

function securityContent() {
  const mfa = state.data.mfa ?? {};
  const social = state.data.social ?? [];
  const passwordErrors = violations(state.error?.body);
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("passwordPolicy"))}</h2><p>${escapeHtml(text("securityTitle"))}</p><form data-form="password" novalidate>${field("currentPassword", text("currentPassword"), "", passwordErrors.currentPassword, "password")}${field("newPassword", text("newPassword"), "", passwordErrors.newPassword, "password")}${field("confirmPassword", text("confirmPassword"), "", passwordErrors.confirmPassword, "password")}<div class="actions">${button(text("save"), { action: "save-password", type: "submit", busy: state.busy === "password", mutation: true })}</div></form></section><section class="card"><h2>${escapeHtml(text("mfaTitle"))}</h2><p>${escapeHtml(text("mfaHelp"))}</p>${
    mfa.available === false
      ? '<div class="notice">' + escapeHtml(text("mfaUnavailable")) + "</div>"
      : chooseLazy(
          mfa.enabled,
          () =>
            '<div class="notice success">' +
            escapeHtml(text("mfaEnabled")) +
            "</div>" +
            field(
              "mfaCode",
              text("mfaCode"),
              "",
              "",
              "text",
              'inputmode="numeric" maxlength="${mfa.digits ?? 6}"',
            ) +
            "" +
            button(text("mfaDisable"), {
              action: "mfa-disable",
              busy: state.busy === "mfa",
              mutation: true,
            }) +
            "",
          () =>
            chooseLazy(
              mfa.setup,
              () =>
                '<div class="notice">' +
                escapeHtml(text("mfaSecret")) +
                ": <code>" +
                escapeHtml(mfa.setup.secret ?? "") +
                "</code></div>" +
                field(
                  "mfaCode",
                  text("mfaCode"),
                  "",
                  "",
                  "text",
                  'inputmode="numeric" maxlength="${mfa.setup.digits ?? 6}"',
                ) +
                "" +
                button(text("mfaEnable"), {
                  action: "mfa-enable",
                  busy: state.busy === "mfa",
                  mutation: true,
                }) +
                "",
              () =>
                button(text("mfaSetup"), {
                  action: "mfa-setup",
                  busy: state.busy === "mfa",
                  mutation: true,
                }),
            ),
        )
  }</section><section class="card"><h2>${escapeHtml(text("socialLinksTitle"))}</h2><p>${escapeHtml(text("socialLinksHelp"))}</p><div class="list">${
    social.length
      ? social
          .map(
            (link) =>
              '<div class="list-item"><div><strong>' +
              escapeHtml(link.displayName ?? link.provider) +
              '</strong><span class="muted">' +
              escapeHtml(
                chooseLazy(
                  link.linked,
                  () => text("socialConnected"),
                  () =>
                    chooseLazy(
                      link.configured && link.enabled,
                      () => text("socialNotConnected"),
                      () => text("socialNotConfigured"),
                    ),
                ),
              ) +
              "</span></div>" +
              chooseLazy(
                link.linked,
                () =>
                  button(text("socialRemove"), {
                    action: "social-remove",
                    danger: true,
                    busy: state.busy === "social",
                    mutation: true,
                  }),
                () =>
                  button(text("socialConnect"), {
                    action: "social-start",
                    busy: state.busy === "social",
                    disabled: !link.configured || !link.enabled,
                    mutation: true,
                    provider: link.provider,
                  }),
              ) +
              "</div>",
          )
          .join("")
      : '<div class="empty">' + escapeHtml(text("socialLinksEmpty")) + "</div>"
  }</div></section><section class="card"><h2>${escapeHtml(text("deleteAccount"))}</h2><p>${escapeHtml(text("deleteAccountWarning"))}</p><form data-form="delete" novalidate>${field("deletePassword", text("currentPassword"), "", "", "password")}<div class="actions">${button(text("deleteAccount"), { action: "delete-account", danger: true, type: "submit", busy: state.busy === "delete", mutation: true })}</div></form></section></div>`;
}

function pageItems(items, emptyText, renderItem) {
  return items?.length
    ? `<div class="list">${items.map(renderItem).join("")}</div>`
    : `<div class="empty">${escapeHtml(emptyText)}</div>`;
}

function sessionsContent() {
  const sessions = state.data.sessions ?? [];
  return `<section class="card"><h2>${escapeHtml(text("sessionsTitle"))}</h2><p>${escapeHtml(text("sessionsError"))}</p>${pageItems(sessions, text("sessionsEmpty"), (item) => '<div class="list-item" data-id="' + escapeHtml(item.id) + '"><div><strong>' + escapeHtml(item.current ? text("currentSession") : item.id) + '</strong><span class="muted">' + escapeHtml(item.createdAt ?? "") + " · " + escapeHtml(item.lastAccessedAt ?? "") + "</span></div>" + (item.current ? "" : button(text("signOutSession"), { action: "delete-session", danger: true, busy: state.busy === "sessions", mutation: true })) + "</div>")}<div class="actions">${button(text("signOutOthers"), { action: "delete-other-sessions", busy: state.busy === "sessions", mutation: true })}</div></section>`;
}

function applicationsContent() {
  const applications = state.data.applications ?? [];
  const offline = state.data.offlineSessions ?? [];
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("applicationsTitle"))}</h2><p>${escapeHtml(text("applicationsError"))}</p>${pageItems(applications, text("applicationsEmpty"), (item) => '<div class="list-item" data-id="' + escapeHtml(item.clientId) + '"><div><strong>' + escapeHtml(item.clientName ?? item.clientId) + '</strong><span class="muted">' + escapeHtml((item.scopes ?? []).join(", ")) + "</span></div>" + button(text("revokeApplication"), { action: "revoke-application", danger: true, busy: state.busy === "revoke-application", mutation: true }) + "</div>")}</section><section class="card"><h2>${escapeHtml(text("offlineSessionsTitle"))}</h2><p>${escapeHtml(text("offlineSessionsHelp"))}</p>${pageItems(offline, text("offlineSessionsEmpty"), (item) => '<div class="list-item" data-id="' + escapeHtml(item.id) + '"><div><strong>' + escapeHtml(item.clientName ?? item.clientId) + '</strong><span class="muted">' + escapeHtml(item.issuedAt ?? "") + "</span></div>" + button(text("revokeOfflineSession"), { action: "revoke-offline", danger: true, busy: state.busy === "revoke-offline", mutation: true }) + "</div>")}</section></div>`;
}

function settingsContent() {
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("appearance"))}</h2><div class="settings-row"><label for="theme">${escapeHtml(text("theme"))}</label><select id="theme"><option value="system">${escapeHtml(text("system"))}</option><option value="light">${escapeHtml(text("light"))}</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>${escapeHtml(text("dark"))}</option></select></div><div class="settings-row"><label for="language">${escapeHtml(text("language"))}</label><select id="language"><option value="en" ${state.locale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${state.locale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select></div></section><section class="card"><h2>${escapeHtml(text("security"))}</h2><p>${escapeHtml(text("secureVaultNote"))}</p>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</section></div>`;
}

function loginContent() {
  if (!hasConsoleSelection()) {
    return `<main class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true"><img class="brand-light" src="app://renderer/native/brand/logo-light.svg" alt=""/><img class="brand-dark" src="app://renderer/native/brand/logo-dark.svg" alt=""/></span><span>Kitezh</span></div><p class="console-label">${escapeHtml(text("signInNote"))}</p><h1>${escapeHtml(text("chooseConsole"))}</h1><p>${escapeHtml(text("chooseConsoleHelp"))}</p><div class="actions">${button(text("adminTitle"), { action: "choose-admin" })}${button(text("accountTitle"), { action: "choose-account" })}</div></section></main>`;
  }
  const title =
    state.console === "admin" ? text("adminTitle") : text("accountTitle");
  return `<main class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true"><img class="brand-light" src="app://renderer/native/brand/logo-light.svg" alt=""/><img class="brand-dark" src="app://renderer/native/brand/logo-dark.svg" alt=""/></span><span>Kitezh</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text("signInNote"))}</p>${state.error ? '<div class="notice error" role="alert">' + escapeHtml(state.error.message) + "</div>" : ""}${state.notice ? '<div class="notice success" role="status">' + escapeHtml(state.notice) + "</div>" : ""}<div class="actions">${button(text("signIn"), { action: "sign-in", busy: state.authStarting && !state.authCanceling, disabled: state.authStarting })}${
    state.authStarting
      ? button(text("cancelSignIn"), {
          action: "cancel-sign-in",
          busy: state.authCanceling,
          disabled: state.authCanceling,
        })
      : button(
          chooseLazy(
            state.console === "admin",
            () => text("accountTitle"),
            () => text("adminTitle"),
          ),
          { action: "switch-console" },
        )
  }</div></section></main>`;
}

function scheduleUserSearch(delay = 300) {
  clearTimeout(adminUserSearchTimer);
  if (state.route !== "users" || !state.session || state.offline) return;
  adminUserSearchTimer = setTimeout(() => void searchUsers(), delay);
}

async function searchUsers() {
  if (state.route !== "users" || !state.session || state.offline) return;
  if (state.busy) {
    scheduleUserSearch(100);
    return;
  }
  const query = (
    state.data.userSearchDraft ??
    state.data.userQuery ??
    ""
  ).trim();
  if (query === (state.data.userQuery ?? "")) return;
  state.data.userQuery = query;
  state.data.userPage = 0;
  state.data.adminSelectedUserIds = [];
  state.data.adminUserBulkConfirmAction = null;
  state.busy = "users-search";
  try {
    await loadRoute({ keepContent: true });
  } finally {
    if (state.busy === "users-search") state.busy = null;
    render();
  }
}

function render({ preserveDrafts = true } = {}) {
  const searchInput =
    /^(admin-user-query|admin-client-query|admin-role-query|role-users-query|role-candidate-(realm|client|user)|role-name|role-description|group-(name|attributesJson|candidate-query|query)|groupMember-query)$/.test(
      document.activeElement?.id ?? "",
    )
      ? document.activeElement
      : null;
  const searchSelection = searchInput
    ? [searchInput.selectionStart, searchInput.selectionEnd]
    : null;
  if (state.route !== "users" || !state.session)
    clearTimeout(adminUserSearchTimer);
  if (state.session && preserveDrafts) preserveOfflineDrafts();
  if (!state.session) {
    app.innerHTML = loginContent();
  } else {
    app.innerHTML = shell();
  }
  bind();
  const nextSearchInput =
    searchInput && document.getElementById(searchInput.id);
  if (nextSearchInput) {
    nextSearchInput.focus({ preventScroll: true });
    if (
      ["search", "text"].includes(nextSearchInput.type) ||
      nextSearchInput.tagName === "TEXTAREA"
    )
      nextSearchInput.setSelectionRange(...searchSelection);
  }
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
  if (state.console === "admin" && !adminRouteAllowed(state.route)) {
    state.loading = false;
    state.error = { kind: "forbidden" };
    render();
    return;
  }
  if (state.console === "admin" && state.route === "server-info") {
    state.data.adminServerInfo = null;
    state.data.adminServerInfoLoadError = false;
    state.data.adminServerDiscovery = undefined;
    state.data.adminServerJwks = undefined;
    state.data.adminServerDiscoveryError = false;
    state.data.adminServerJwksError = false;
    state.data.adminServerInfoCopyFailed = false;
  }
  state.loading = !keepContent;
  if (!preserveError) state.error = null;
  render();
  try {
    if (state.console === "admin" && state.route === "dashboard") {
      const [dashboard, events, serverInfo, health] = await Promise.allSettled([
        request("/api/admin/dashboard"),
        request("/api/admin/events?size=6&sort=occurredAt,desc"),
        request("/api/admin/server-info"),
        request("/actuator/health/readiness"),
      ]);
      if (dashboard.status === "rejected") throw dashboard.reason;
      state.data.dashboard = dashboard.value;
      state.data.adminDashboardEvents =
        events.status === "fulfilled" && Array.isArray(events.value?.content)
          ? events.value.content.slice(0, 6)
          : [];
      state.data.adminServerInfo =
        serverInfo.status === "fulfilled" ? serverInfo.value : null;
      state.data.adminHealth =
        health.status === "fulfilled" && health.value?.status === "UP"
          ? "UP"
          : "DOWN";
    }
    if (state.route === "notifications") {
      const base =
        state.console === "admin"
          ? "/api/admin/notifications"
          : "/api/account/notifications";
      const [page, unreadCount] = await Promise.all([
        request(`${base}?page=0&size=20`),
        request(`${base}/unread-count`),
      ]);
      state.data.notifications = page;
      state.data.notificationUnreadCount = unreadCount;
    }
    if (state.console === "admin" && state.route === "users") {
      const query = new URLSearchParams({
        q: state.data.userQuery ?? "",
        page: String(state.data.userPage ?? 0),
        size: String(state.data.userPageSize ?? 20),
        sort: state.data.userSort ?? "username,asc",
      });
      if (state.data.userStatus) query.set("enabled", state.data.userStatus);
      const users = await request(`/api/admin/users?${query.toString()}`);
      if (
        state.route === "users" &&
        (state.data.userSearchDraft ?? state.data.userQuery ?? "").trim() ===
          query.get("q")
      ) {
        state.data.users = users;
      }
    }
    if (state.console === "admin" && state.route === "user-detail") {
      const id = Number(state.data.adminUserDetailId);
      if (!Number.isSafeInteger(id) || id < 1)
        throw new Error("Invalid user id");
      const tab = state.data.adminUserDetailTab ?? "details";
      const user = await request(`/api/admin/users/${id}`);
      state.data.adminUserDetail = user;
      if (tab === "details") {
        state.data.adminUserDetailProfile = await request(
          `/api/admin/users/${id}/profile-attributes`,
        );
      } else if (tab === "credentials") {
        const [actionsResult, passkeysResult] = await Promise.allSettled([
          userRequiredActions(id),
          request(`/api/admin/users/${id}/webauthn/credentials?page=0&size=20`),
        ]);
        state.data.adminUserDetailRequiredActionsError =
          actionsResult.status === "rejected";
        state.data.adminUserDetailRequiredActionMutationError = false;
        state.data.adminUserRequiredActions =
          actionsResult.status === "fulfilled" &&
          Array.isArray(actionsResult.value)
            ? actionsResult.value
            : [];
        state.data.adminUserPasskeys ??= {};
        state.data.adminUserPasskeys[id] =
          passkeysResult.status === "fulfilled"
            ? passkeysResult.value
            : { content: [], number: 0, totalPages: 0, totalElements: 0 };
        state.data.adminUserPasskeyLoadErrors ??= {};
        state.data.adminUserPasskeyLoadErrors[id] =
          passkeysResult.status === "rejected";
        if (
          ![actionsResult, passkeysResult].some(
            (result) =>
              result.status === "rejected" && result.reason?.status === 401,
          )
        )
          state.error = null;
        state.data.userPasskeysOpenId = id;
      } else if (tab === "roles") {
        const roles = await request(
          "/api/admin/roles?page=0&size=100&sort=name,asc",
        );
        state.data.adminUserDetailRoles = Array.isArray(roles?.content)
          ? roles.content
          : [];
      } else if (tab === "groups") {
        const groupQuery = new URLSearchParams({
          page: String(state.data.adminUserDetailPages?.groups ?? 0),
          size: "100",
          sort: "name,asc",
        });
        if (state.data.adminUserDetailGroupQuery)
          groupQuery.set("q", state.data.adminUserDetailGroupQuery);
        const [memberships, groups] = await Promise.all([
          request(
            `/api/admin/users/${id}/groups?page=${state.data.adminUserDetailPages?.groups ?? 0}&size=100`,
          ),
          request(`/api/admin/groups?${groupQuery.toString()}`),
        ]);
        state.data.adminUserDetailGroups = memberships;
        state.data.adminUserDetailGroupOptions = Array.isArray(groups?.content)
          ? groups.content
          : [];
      } else if (tab === "sessions") {
        const page = state.data.adminUserDetailPages?.sessions ?? 0;
        const size = state.data.adminUserDetailPageSizes?.sessions ?? 10;
        state.data.adminUserDetailSessions = await request(
          `/api/admin/users/${id}/sessions?page=${page}&size=${size}&sort=lastAccessTime,desc`,
        );
      } else if (tab === "consents") {
        const page = state.data.adminUserDetailPages?.consents ?? 0;
        const size = state.data.adminUserDetailPageSizes?.consents ?? 10;
        state.data.adminUserDetailConsents = await request(
          `/api/admin/users/${id}/consents?page=${page}&size=${size}&sort=id.registeredClientId,asc`,
        );
      } else if (tab === "events") {
        const page = state.data.adminUserDetailPages?.events ?? 0;
        const size = state.data.adminUserDetailPageSizes?.events ?? 10;
        state.data.adminUserDetailEvents = await request(
          `/api/admin/users/${id}/events?page=${page}&size=${size}&sort=occurredAt,desc`,
        );
      }
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
    if (
      state.console === "admin" &&
      ["roles", "role-detail"].includes(state.route)
    ) {
      await roleScreens.load();
    }
    if (
      state.console === "admin" &&
      ["groups", "group-detail", "group-create"].includes(state.route)
    )
      await groupScreens.load();
    if (
      state.console === "admin" &&
      ["organizations", "organization-create"].includes(state.route)
    )
      await organizationScreens.load();
    if (state.console === "admin" && state.route === "client-scopes") {
      const query = new URLSearchParams({
        q: state.data.clientScopeQuery ?? "",
        page: String(state.data.clientScopePage ?? 0),
        size: "20",
        sort: state.data.clientScopeSort ?? "name,asc",
      });
      state.data.clientScopes = await request(
        `/api/admin/client-scopes?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "client-scope-detail") {
      const id = state.data.clientScopeDetailId;
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? ""))
        throw { kind: "validation" };
      state.data.clientScopeDetail = await request(
        `/api/admin/client-scopes/${encodeURIComponent(id)}`,
      );
      if (state.data.clientScopeDetail.builtIn)
        state.data.clientScopeEditing = false;
      await loadClientScopeDetailSections(id);
    }
    if (state.console === "admin" && state.route === "clients") {
      const query = new URLSearchParams({
        q: state.data.clientQuery ?? "",
        page: String(state.data.clientPage ?? 0),
        size: String(state.data.clientSize ?? 10),
        sort: state.data.clientSort ?? "clientId,asc",
      });
      state.data.clients = await request(`/api/admin/clients?${query}`);
      const page = clientPageInfo(
        state.data.clients,
        state.data.clientSize ?? 10,
      );
      if ((state.data.clientPage ?? 0) > page.number) {
        state.data.clientPage = page.number;
        query.set("page", String(page.number));
        state.data.clients = await request(`/api/admin/clients?${query}`);
      }
    }
    if (state.console === "admin" && state.route === "client-detail")
      await loadNativeClientDetail();
    if (state.console === "admin" && state.route === "identity-providers") {
      const query = new URLSearchParams({
        q: state.data.identityProviderQuery ?? "",
        page: String(state.data.identityProviderPage ?? 0),
        size: String(state.data.identityProviderSize ?? 10),
        sort: state.data.identityProviderSort ?? "guiOrder,asc",
      });
      state.data.identityProviders = await request(
        `/api/admin/identity-providers?${query.toString()}`,
      );
    }
    if (
      state.console === "admin" &&
      state.route === "identity-provider-create"
    ) {
      const createType =
        state.data.identityProviderCreateType === "saml" ? "saml" : "oidc";
      const key = createType === "saml" ? "new-saml" : "new";
      state.data.identityProviderConfigurationOpenId = key;
      state.data.identityProviderConfigurationBaselines ??= {};
      state.data.identityProviderConfigurationDrafts ??= {};
      if (!state.data.identityProviderConfigurationBaselines[key]) {
        const baseline = {
          ...defaultIdentityProviderConfiguration(),
          providerType: createType,
        };
        state.data.identityProviderConfigurationBaselines[key] = baseline;
        state.data.identityProviderConfigurationDrafts[key] =
          identityProviderConfigurationDraft(baseline);
      }
    }
    if (
      state.console === "admin" &&
      state.route === "identity-provider-detail"
    ) {
      const id = state.data.identityProviderDetailId;
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? ""))
        throw { kind: "validation" };
      const provider = await request(
        `/api/admin/identity-providers/${encodeURIComponent(id)}`,
      );
      if (provider?.id !== id || typeof provider.providerType !== "string")
        throw { kind: "validation" };
      const providersPage = state.data.identityProviders ?? { content: [] };
      const providers = Array.isArray(providersPage.content)
        ? providersPage.content
        : [];
      state.data.identityProviders = {
        ...providersPage,
        content: providers.some((item) => String(item.id) === id)
          ? providers.map((item) =>
              String(item.id) === id ? { ...item, ...provider } : item,
            )
          : [...providers, provider],
      };
      const baseline = safeIdentityProviderConfiguration(provider);
      state.data.identityProviderConfigurationBaselines ??= {};
      state.data.identityProviderConfigurationDrafts ??= {};
      state.data.identityProviderConfigurationBaselines[id] = baseline;
      state.data.identityProviderConfigurationDrafts[id] ??=
        identityProviderConfigurationDraft(baseline);
      state.data.identityProviderConfigurationOpenId = id;
      try {
        const policy = await request(
          `/api/admin/identity-providers/${encodeURIComponent(id)}/native-policy`,
        );
        state.data.identityProviderPolicies ??= {};
        state.data.identityProviderPolicies[id] = policy;
        state.data.identityProviderPolicyOpenId = id;
      } catch {
        state.data.identityProviderPolicies ??= {};
        state.data.identityProviderPolicies[id] = provider;
        state.data.identityProviderPolicyOpenId = id;
      }
      if (state.data.identityProviderDetailTab === "mappers") {
        const params = new URLSearchParams({
          q: state.data.identityProviderMapperQuery ?? "",
          page: String(state.data.identityProviderMapperPage ?? 0),
          size: String(state.data.identityProviderMapperSize ?? 10),
          sort: state.data.identityProviderMapperSort ?? "name,asc",
        });
        const mapperPage = await request(
          `/api/admin/identity-providers/${encodeURIComponent(id)}/mappers?${params}`,
        );
        state.data.identityProviderMapperPages ??= {};
        state.data.identityProviderMapperPages[id] = mapperPage;
        state.data.identityProviderMappers ??= {};
        state.data.identityProviderMappers[id] = Array.isArray(
          mapperPage?.content,
        )
          ? mapperPage.content
          : [];
        state.data.identityProviderMappersOpenId = id;
      }
    }
    if (state.console === "admin" && state.route === "sessions") {
      const query = new URLSearchParams({
        q: state.data.adminSessionQuery ?? "",
        status: state.data.adminSessionStatus ?? "active",
        clientId: state.data.adminSessionClientId ?? "",
        page: String(state.data.adminSessionPage ?? 0),
        size: String(state.data.adminSessionSize ?? 10),
        sort: state.data.adminSessionSort ?? "lastAccessTime,desc",
      });
      state.data.adminSessions = await request(
        `/api/admin/sessions?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "consents") {
      const query = new URLSearchParams({
        q: state.data.adminConsentQuery ?? "",
        clientId: state.data.adminConsentClientId ?? "",
        username: state.data.adminConsentUsername ?? "",
        scope: state.data.adminConsentScope ?? "",
        page: String(state.data.adminConsentPage ?? 0),
        size: String(state.data.adminConsentSize ?? 10),
        sort: state.data.adminConsentSort ?? "id.principalName,asc",
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
        page: String(state.data.adminEventPage ?? 0),
        size: String(state.data.adminEventSize ?? 10),
        sort: state.data.adminEventSort ?? "occurredAt,desc",
      });
      const search = (state.data.adminEventQuery ?? "").trim();
      const eventAction = state.data.adminEventAction ?? "";
      const targetType = state.data.adminEventTargetType ?? "";
      const targetId = (state.data.adminEventTargetId ?? "").trim();
      const from = state.data.adminEventFrom ?? "";
      const to = state.data.adminEventTo ?? "";
      if (search) query.set("q", search);
      if (eventAction) query.set("action", eventAction);
      if (targetType) query.set("targetType", targetType);
      if (targetId) query.set("targetId", targetId);
      if (from) query.set("from", new Date(`${from}T00:00:00`).toISOString());
      if (to) query.set("to", new Date(`${to}T23:59:59.999`).toISOString());
      state.data.adminEvents = await request(
        `/api/admin/events?${query.toString()}`,
      );
    }
    if (state.console === "admin" && state.route === "keys") {
      const query = new URLSearchParams({
        q: state.data.adminKeyQuery ?? "",
        page: String(state.data.adminKeyPage ?? 0),
        size: String(state.data.adminKeySize ?? 10),
        sort: state.data.adminKeySort ?? "createdAt,desc",
        active: state.data.adminKeyActive ?? "",
      });
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
    if (state.console === "admin" && state.route === "configuration")
      state.data.adminBranding = await request("/api/admin/settings/branding");
    if (state.console === "admin" && state.route === "server-info") {
      state.data.adminServerInfo = await request("/api/admin/server-info");
      const endpointPath = (endpoint) => {
        try {
          const url = new URL(endpoint);
          return `${url.pathname}${url.search}`;
        } catch {
          return null;
        }
      };
      const loadEndpoint = (endpoint) => {
        const path = endpointPath(endpoint);
        return path
          ? request(path)
          : Promise.reject(new Error("Invalid server endpoint"));
      };
      const [discovery, jwks] = await Promise.allSettled([
        loadEndpoint(state.data.adminServerInfo.discoveryEndpoint),
        loadEndpoint(state.data.adminServerInfo.jwksEndpoint),
      ]);
      state.data.adminServerDiscoveryError = discovery.status === "rejected";
      state.data.adminServerJwksError = jwks.status === "rejected";
      state.data.adminServerDiscovery =
        discovery.status === "fulfilled" ? discovery.value : null;
      state.data.adminServerJwks =
        jwks.status === "fulfilled" ? jwks.value : null;
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
    if (state.console === "admin" && state.route === "server-info") {
      state.data.adminServerInfoLoadError = true;
      state.error = null;
    }
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

function formString(value, fallback = "") {
  return typeof value === "string" ? value : String(fallback);
}

function clientConfigurationFormDraft(form) {
  if (state.route === "client-detail" && !clientCanUpdate())
    return clientConfigurationDraft(state.data.clientConfiguration);
  const draft = formValues(form);
  delete draft.cibaClientNotificationToken;
  for (const name of [
    "clientAuthenticationMethods",
    "authorizationGrantTypes",
    "dpopSigningAlgorithms",
  ])
    draft[name] = [...form.querySelectorAll(`input[name="${name}"]:checked`)]
      .map((input) => input.value)
      .join("\n");
  for (const name of [
    "requireAuthorizationConsent",
    "requireProofKey",
    "requireDpop",
    "requireDpopJkt",
    "dpopRefreshTokenOnly",
    "serviceAccountEnabled",
    "enabled",
    "frontChannelLogout",
    "backchannelLogout",
    "tokenExchangeDownscopeOnly",
    "tokenExchangeAllowDelegation",
  ])
    draft[name] = form.elements.namedItem(name).checked;
  return draft;
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
          : chooseLazy(
              value.trim(),
              () => [value.trim()],
              () => [],
            );
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
  for (const panel of app.querySelectorAll("[data-client-role-composites]")) {
    const composition =
      state.data.clientRoleCompositions?.[panel.dataset.clientRoleComposites];
    if (!composition?.open) continue;
    for (const kind of ["realm", "client"]) {
      const input = panel.querySelector(`input[name="${kind}-composite-q"]`);
      if (input) composition[kind + "Query"] = input.value;
    }
  }
  for (const panel of app.querySelectorAll("[data-client-role-assignments]")) {
    const assignment =
      state.data.clientRoleAssignments?.[panel.dataset.clientRoleAssignments];
    if (!assignment?.open) continue;
    for (const kind of ["user", "group"]) {
      const input = panel.querySelector(`input[name="${kind}-q"]`);
      if (input) assignment[`${kind}Query`] = input.value;
    }
  }
  for (const form of app.querySelectorAll("form[data-form]")) {
    const values = formValues(form);
    if (
      form.dataset.form === "admin-user-detail-password" &&
      state.route === "user-detail" &&
      state.data.adminUserDetailTab === "credentials" &&
      Number(form.dataset.userId) === state.data.adminUserDetailId
    ) {
      state.data.adminUserDetailPassword = {
        password: form.elements.namedItem("password").value,
        temporary: form.elements.namedItem("temporary").checked,
      };
    } else if (form.dataset.form === "profile") {
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
        void _password;
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
        state.data.adminRoleDrafts[roleName] = {
          description: form.elements.namedItem("description")?.value ?? "",
        };
      }
    } else if (
      ["admin-client-role-create", "admin-client-role-update"].includes(
        form.dataset.form,
      )
    ) {
      const clientId = form.dataset.clientId;
      const roleId = form.dataset.roleId ?? "new";
      if (/^[A-Za-z0-9_-]{1,100}$/.test(clientId ?? "")) {
        state.data.clientRoles ??= {};
        const panel = (state.data.clientRoles[clientId] ??= {});
        if (roleId === "new") panel.createDraft = values;
        else if (/^[1-9]\d{0,18}$/.test(roleId)) {
          panel.drafts ??= {};
          panel.drafts[roleId] = values;
        }
      }
    } else if (form.dataset.form === "admin-client-scope-edit") {
      const scopeId = form.dataset.scopeId;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "")) {
        state.data.adminClientScopeDrafts ??= {};
        state.data.adminClientScopeDrafts[scopeId] = values;
      }
    } else if (form.dataset.form === "admin-client-configuration") {
      const id = form.dataset.clientId;
      if (/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "")) {
        state.data.clientConfigurationDrafts ??= {};
        state.data.clientConfigurationDrafts[id] =
          clientConfigurationFormDraft(form);
      }
    } else if (
      form.dataset.form === "admin-identity-provider-connection" ||
      form.dataset.form === "admin-saml-identity-provider-connection"
    ) {
      const key =
        form.dataset.providerId ||
        (form.dataset.form === "admin-saml-identity-provider-connection"
          ? "new-saml"
          : "new");
      state.data.identityProviderConfigurationDrafts ??= {};
      state.data.identityProviderConfigurationDrafts[key] =
        form.dataset.form === "admin-saml-identity-provider-connection"
          ? samlIdentityProviderConfigurationFormDraft(form)
          : identityProviderConfigurationFormDraft(form);
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
    } else if (form.dataset.form === "admin-client-scope-create") {
      state.data.adminClientScopeCreateDraft = values;
    } else if (form.dataset.form === "admin-client-create") {
      state.data.adminClientCreateDraft = {
        ...values,
        requireAuthorizationConsent: form.elements.namedItem(
          "requireAuthorizationConsent",
        ).checked,
      };
    }
  }
}

async function submitForm(form) {
  if (form.dataset.form?.startsWith("native-group-")) {
    await groupScreens.submit(form);
    return;
  }
  if (state.busy) return;
  const values = formValues(form);
  if (form.dataset.form === "admin-user-detail-save") {
    const id = Number(form.dataset.userId);
    const user = adminUserById(id);
    if (
      state.offline ||
      state.data.adminAccess?.manageUsers !== true ||
      !user ||
      !form.reportValidity()
    )
      return;
    const body = {
      username: String(formString(values.username, "")).trim(),
      firstName: String(formString(values.firstName, "")).trim(),
      lastName: String(formString(values.lastName, "")).trim(),
      email: String(formString(values.email, "")).trim() || null,
      emailVerified: form.elements.namedItem("emailVerified").checked,
      enabled: form.elements.namedItem("enabled").checked,
      roles: user.assignedRoles ?? user.authorities ?? [],
    };
    state.busy = `user-detail-save:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}`, { method: "PUT", body });
      const attributes = profileAttributeValues(form);
      if (Object.keys(attributes).length > 0) {
        state.data.adminUserDetailProfile = await request(
          `/api/admin/users/${id}/profile-attributes`,
          {
            method: "PUT",
            body: { attributes },
          },
        );
      }
      await loadRoute({ keepContent: true });
      state.notice = text("adminUserProfileUpdated");
    } catch {
      /* Preserve the page and display the localized API error. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-detail-password") {
    const id = Number(form.dataset.userId);
    const password = String(formString(values.password, ""));
    if (
      state.offline ||
      state.data.adminAccess?.manageUsers !== true ||
      !adminUserById(id)
    )
      return;
    if (!password) return;
    if (password.length < 12 || password.length > 128) {
      state.data.adminUserDetailPasswordError = text("adminPasswordValidation");
      render();
      return;
    }
    if (!form.reportValidity()) return;
    delete state.data.adminUserDetailPasswordError;
    state.busy = `user-detail-password:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}/password`, {
        method: "PUT",
        body: {
          password,
          temporary: form.elements.namedItem("temporary").checked,
        },
      });
      const currentForm = document.getElementById(
        "admin-user-detail-password-form",
      );
      if (currentForm) {
        currentForm.elements.namedItem("password").value = "";
        currentForm.elements.namedItem("temporary").checked = true;
      }
      state.data.adminUserDetailPassword = { temporary: true };
      delete state.data.adminUserDetailPasswordError;
      await loadRoute({ keepContent: true });
      state.notice = text("adminPasswordReset");
    } catch {
      state.data.adminUserDetailPassword = {
        password,
        temporary: form.elements.namedItem("temporary").checked,
      };
      state.data.adminUserDetailPasswordError =
        violations(state.error?.body).password ?? "";
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-user-detail-roles") {
    const id = Number(form.dataset.userId);
    const user = adminUserById(id);
    const roles = [...form.querySelectorAll('input[name="roles"]:checked')].map(
      (input) => input.value,
    );
    if (state.offline || state.data.adminAccess?.manageUsers !== true || !user)
      return;
    if (roles.length === 0) {
      state.data.adminUserDetailRoleError =
        state.locale === "tr"
          ? "En az bir rol seçin."
          : "Select at least one role.";
      render();
      return;
    }
    state.data.adminUserDetailRoleError = "";
    state.busy = `user-detail-roles:${id}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(`/api/admin/users/${id}`, {
        method: "PUT",
        body: {
          username: user.username,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email ?? null,
          emailVerified: user.emailVerified,
          enabled: user.enabled,
          roles,
        },
      });
      await loadRoute({ keepContent: true });
      state.notice = text("adminUserProfileUpdated");
    } catch {
      /* Preserve the role selection for a retry. */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-role-search") {
    const clientId = form.dataset.clientId ?? "";
    const query = String(formString(values.q, "")).trim();
    await loadClientRoles(clientId, 0, query, `client-role-search:${clientId}`);
    return;
  }
  if (
    ["admin-client-role-create", "admin-client-role-update"].includes(
      form.dataset.form,
    )
  ) {
    const clientId = form.dataset.clientId ?? "";
    const roleId = form.dataset.roleId ?? "";
    const creating = form.dataset.form === "admin-client-role-create";
    const panel = state.data.clientRoles?.[clientId];
    if (
      state.offline ||
      state.data.adminAccess?.manageClients !== true ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !panel?.open ||
      (!creating && !/^[1-9]\d{0,18}$/.test(roleId)) ||
      (creating && roleId !== "")
    )
      return;
    const body = {
      name: String(formString(values.name, "")).trim(),
      description: String(formString(values.description, "")).trim() || null,
    };
    const localErrors = {};
    if (!body.name) localErrors.name = text("adminRequired");
    else if (body.name.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(body.name))
      localErrors.name = text("adminClientRoleNameInvalid");
    if ((body.description?.length ?? 0) > 500)
      localErrors.description = text("adminClientRoleDescriptionInvalid");
    if (Object.keys(localErrors).length > 0) {
      if (creating)
        panel.createDraft = { ...body, description: body.description ?? "" };
      else {
        panel.drafts ??= {};
        panel.drafts[roleId] = { ...body, description: body.description ?? "" };
      }
      panel.errorRoleId = creating ? "new" : roleId;
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
    panel.errorRoleId = creating ? "new" : roleId;
    state.error = null;
    state.notice = null;
    state.busy = creating
      ? `client-role-create:${clientId}`
      : `client-role-update:${clientId}:${roleId}`;
    render();
    try {
      const path = `/api/admin/clients/${encodeURIComponent(clientId)}/roles${creating ? "" : "/" + encodeURIComponent(roleId) + ""}`;
      const result = await request(path, {
        method: creating ? "POST" : "PUT",
        body,
      });
      if (creating) {
        panel.page = {
          ...(panel.page ?? { number: 0, totalPages: 0 }),
          content: [result, ...(panel.page?.content ?? [])].slice(0, 20),
        };
        panel.createDraft = {};
        state.notice = text("adminClientRoleCreated");
      } else {
        panel.page = {
          ...panel.page,
          content: (panel.page?.content ?? []).map((role) =>
            String(role.id) === roleId ? result : role,
          ),
        };
        delete panel.drafts?.[roleId];
        panel.editingId = null;
        state.notice = text("adminClientRoleUpdated");
      }
      panel.errorRoleId = null;
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-saml-identity-provider-connection") {
    const providerId = form.dataset.providerId ?? "";
    const creating = providerId.length === 0;
    const key = creating ? "new-saml" : providerId;
    const providers = state.data.identityProviders?.content ?? [];
    const provider = creating
      ? null
      : providers.find((item) => item.id === providerId);
    const baseline = state.data.identityProviderConfigurationBaselines?.[key];
    if (
      state.offline ||
      !adminRouteAllowed("identity-providers") ||
      (creating &&
        state.data.identityProviderConfigurationOpenId !== "new-saml") ||
      (!creating &&
        (!/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
          !provider ||
          provider.providerType !== "saml" ||
          baseline?.id !== providerId ||
          baseline?.providerType !== "saml"))
    )
      return;

    const draft = samlIdentityProviderConfigurationFormDraft(form);
    const signingKey = String(
      formString(values.samlSigningPrivateKey, ""),
    ).trim();
    const decryptionKey = String(
      formString(values.samlDecryptionPrivateKey, ""),
    ).trim();
    const localErrors = {};
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(draft.registrationId))
      localErrors.registrationId = text("adminRequired");
    if (!draft.displayName.trim())
      localErrors.displayName = text("adminRequired");
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(draft.alias))
      localErrors.alias = text("adminRequired");
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(draft.iconKey))
      localErrors.iconKey = text("adminRequired");
    const metadataUri = draft.samlMetadataUri.trim();
    const partyId = draft.samlAssertingPartyEntityId.trim();
    const ssoUri = draft.samlSingleSignOnServiceUrl.trim();
    const idpCertificate = draft.samlIdpCertificate.trim();
    const metadataConfigured = Boolean(metadataUri);
    const manualConfigured = Boolean(partyId && ssoUri && idpCertificate);
    if (!metadataConfigured && !manualConfigured)
      localErrors.samlMetadataUri = text("adminSamlSourceRequired");
    for (const name of [
      "samlMetadataUri",
      "samlSingleSignOnServiceUrl",
      "samlSingleLogoutServiceUrl",
    ]) {
      const uri = draft[name].trim();
      if (uri && !isSafeProviderEndpointUri(uri))
        localErrors[name] = text("adminInvalidUri");
    }
    for (const name of [
      "samlAssertingPartyEntityId",
      "samlServiceProviderEntityId",
      "samlSignatureAlgorithm",
    ]) {
      const uri = draft[name].trim();
      if (uri && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(uri))
        localErrors[name] = text("adminInvalidUri");
    }
    if (
      draft.samlSignAuthnRequests &&
      !signingKey &&
      !baseline?.samlSigningPrivateKeyConfigured
    )
      localErrors.samlSigningPrivateKey = text("adminRequired");
    if (
      signingKey &&
      !/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(
        signingKey,
      )
    )
      localErrors.samlSigningPrivateKey = text("adminRequired");
    if (
      decryptionKey &&
      !/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(
        decryptionKey,
      )
    )
      localErrors.samlDecryptionPrivateKey = text("adminRequired");
    for (const [name, label] of [
      ["samlIdpCertificate", "CERTIFICATE"],
      ["samlSigningCertificate", "CERTIFICATE"],
      ["samlDecryptionCertificate", "CERTIFICATE"],
    ]) {
      const pem = draft[name].trim();
      if (
        pem &&
        !(
          pem.startsWith(`-----BEGIN ${label}-----`) &&
          pem.includes("\n") &&
          pem.endsWith(`-----END ${label}-----`)
        )
      )
        localErrors[name] = text("adminRequired");
    }
    if (Object.keys(localErrors).length) {
      state.data.identityProviderConfigurationDrafts ??= {};
      state.data.identityProviderConfigurationDrafts[key] = draft;
      state.data.identityProviderConfigurationErrorId = key;
      state.error = {
        kind: "validation",
        body: {
          detail: Object.values(localErrors)[0],
          violations: Object.entries(localErrors).map(
            ([fieldName, message]) => ({ field: fieldName, message }),
          ),
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;

    const current = creating
      ? defaultIdentityProviderConfiguration()
      : baseline;
    const body = {
      registrationId: draft.registrationId.trim(),
      providerType: "saml",
      displayName: draft.displayName.trim(),
      alias: draft.alias.trim(),
      iconKey: draft.iconKey.trim(),
      shortStateParameter: Boolean(current.shortStateParameter),
      caseSensitiveUsername: Boolean(current.caseSensitiveUsername),
      enabled: Boolean(current.enabled),
      clientId: null,
      clientSecret: null,
      hideOnLogin: Boolean(current.hideOnLogin),
      accountLinkingOnly: Boolean(current.accountLinkingOnly),
      trustEmail: Boolean(current.trustEmail),
      mfaRequired: Boolean(current.mfaRequired),
      requiredClaims: current.requiredClaims || "sub",
      storeTokens: false,
      storedTokensReadable: false,
      guiOrder: Number(current.guiOrder ?? 0),
      showInAccountConsole: current.showInAccountConsole || "always",
      syncMode: current.syncMode || "import",
      authorizationUri: null,
      tokenUri: null,
      userInfoUri: null,
      jwkSetUri: null,
      issuerUri: null,
      clientAuthenticationMethod: "client_secret_basic",
      scopes: "openid",
      userNameAttribute: "sub",
      samlMetadataUri: metadataUri || null,
      samlAssertingPartyEntityId: partyId || null,
      samlSingleSignOnServiceUrl: ssoUri || null,
      samlSingleLogoutServiceUrl:
        draft.samlSingleLogoutServiceUrl.trim() || null,
      samlIdpCertificate: idpCertificate || null,
      samlSigningPrivateKey: signingKey || null,
      samlSigningCertificate: draft.samlSigningCertificate.trim() || null,
      samlServiceProviderEntityId:
        draft.samlServiceProviderEntityId.trim() || null,
      samlSignAuthnRequests: Boolean(draft.samlSignAuthnRequests),
      samlWantAssertionsSigned: Boolean(draft.samlWantAssertionsSigned),
      samlNameIdFormat: draft.samlNameIdFormat.trim() || null,
      samlPrincipalAttribute: draft.samlPrincipalAttribute.trim() || "NameID",
      samlEmailAttribute: draft.samlEmailAttribute.trim() || "email",
      samlFirstNameAttribute:
        draft.samlFirstNameAttribute.trim() || "givenName",
      samlLastNameAttribute: draft.samlLastNameAttribute.trim() || "sn",
      samlGroupsAttribute: draft.samlGroupsAttribute.trim() || "groups",
      samlDecryptionPrivateKey: decryptionKey || null,
      samlDecryptionCertificate: draft.samlDecryptionCertificate.trim() || null,
      samlSignatureAlgorithm: draft.samlSignatureAlgorithm.trim() || null,
      samlAuthnRequestBinding: draft.samlAuthnRequestBinding,
      samlResponseBinding: draft.samlResponseBinding,
      samlLogoutBinding: draft.samlLogoutBinding,
      samlForceAuthentication: Boolean(draft.samlForceAuthentication),
      samlPassSubject: Boolean(draft.samlPassSubject),
    };
    state.data.identityProviderConfigurationDrafts ??= {};
    state.data.identityProviderConfigurationDrafts[key] = draft;
    state.data.identityProviderConfigurationErrorId = key;
    state.error = null;
    state.notice = null;
    state.busy = `identity-provider-config-save:${key}`;
    render();
    try {
      const saved = await request(
        creating
          ? "/api/admin/identity-providers"
          : `/api/admin/identity-providers/${encodeURIComponent(providerId)}`,
        { method: creating ? "POST" : "PUT", body },
      );
      const safeSaved = safeIdentityProviderConfiguration(saved);
      if (creating) {
        state.data.identityProviderQuery = "";
        state.data.identityProviderPage = 0;
        state.data.identityProviders = {
          ...state.data.identityProviders,
          content: [safeSaved, ...providers],
          totalElements:
            Number(state.data.identityProviders?.totalElements ?? 0) + 1,
        };
        state.notice = text("adminSamlProviderCreated");
        state.data.identityProviderDetailId = String(safeSaved.id ?? "");
        state.data.identityProviderDetailTab = "details";
        state.route = "identity-provider-detail";
        window.history.pushState(
          null,
          "",
          `#/admin/identity-providers/${encodeURIComponent(state.data.identityProviderDetailId)}/details`,
        );
      } else {
        state.data.identityProviders = {
          ...state.data.identityProviders,
          content: providers.map((item) =>
            item.id === providerId ? { ...item, ...safeSaved } : item,
          ),
        };
        state.notice = text("adminProviderConnectionUpdated");
      }
      state.data.identityProviderConfigurationOpenId = null;
      delete state.data.identityProviderConfigurationDrafts[key];
      delete state.data.identityProviderConfigurationBaselines[key];
      state.data.identityProviderConfigurationErrorId = null;
    } catch {
      /* Private keys are deliberately excluded from the retained draft. */
    }
    state.busy = null;
    render();
    if (creating && state.data.identityProviderDetailId)
      void loadRoute({ keepContent: true });
    return;
  }
  if (form.dataset.form === "admin-identity-provider-connection") {
    const providerId = form.dataset.providerId ?? "";
    const creating = providerId.length === 0;
    const key = creating ? "new" : providerId;
    const providers = state.data.identityProviders?.content ?? [];
    const provider = creating
      ? null
      : providers.find((item) => item.id === providerId);
    const baseline = state.data.identityProviderConfigurationBaselines?.[key];
    if (
      state.offline ||
      !adminRouteAllowed("identity-providers") ||
      (creating && state.data.identityProviderConfigurationOpenId !== "new") ||
      (!creating &&
        (!/^[A-Za-z0-9_-]{1,100}$/.test(providerId) ||
          !provider ||
          provider.providerType === "saml" ||
          baseline?.id !== providerId ||
          baseline?.providerType === "saml"))
    )
      return;

    const draft = identityProviderConfigurationFormDraft(form);
    const secret = String(formString(values.clientSecret, ""));
    const localErrors = {};
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(draft.registrationId))
      localErrors.registrationId = text("adminRequired");
    if (!draft.displayName.trim())
      localErrors.displayName = text("adminRequired");
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(draft.alias))
      localErrors.alias = text("adminRequired");
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(draft.iconKey))
      localErrors.iconKey = text("adminRequired");
    if (!draft.clientId.trim()) localErrors.clientId = text("adminRequired");
    if ((creating || !baseline?.clientSecretConfigured) && !secret.trim())
      localErrors.clientSecret = text("adminProviderSecretRequired");
    for (const name of [
      "authorizationUri",
      "tokenUri",
      "userInfoUri",
      "jwkSetUri",
      "issuerUri",
    ]) {
      const required = name === "authorizationUri" || name === "tokenUri";
      if (
        (required && !draft[name].trim()) ||
        (draft[name].trim() && !isSafeProviderEndpointUri(draft[name].trim()))
      )
        localErrors[name] = text("adminInvalidUri");
    }
    if (!draft.clientAuthenticationMethod.trim())
      localErrors.clientAuthenticationMethod = text("adminRequired");
    if (!draft.scopes.trim()) localErrors.scopes = text("adminRequired");
    if (!draft.userNameAttribute.trim())
      localErrors.userNameAttribute = text("adminRequired");
    if (Object.keys(localErrors).length) {
      state.data.identityProviderConfigurationDrafts ??= {};
      state.data.identityProviderConfigurationDrafts[key] = draft;
      state.data.identityProviderConfigurationErrorId = key;
      state.error = {
        kind: "validation",
        body: {
          detail: Object.values(localErrors)[0],
          violations: Object.entries(localErrors).map(
            ([fieldName, message]) => ({
              field: fieldName,
              message,
            }),
          ),
        },
      };
      render();
      return;
    }
    if (!form.reportValidity()) return;

    const current = creating
      ? defaultIdentityProviderConfiguration()
      : baseline;
    const body = {
      registrationId: draft.registrationId.trim(),
      providerType: creating ? "oidc" : current.providerType,
      displayName: draft.displayName.trim(),
      alias: draft.alias.trim(),
      iconKey: draft.iconKey.trim(),
      shortStateParameter: Boolean(draft.shortStateParameter),
      caseSensitiveUsername: Boolean(draft.caseSensitiveUsername),
      enabled: Boolean(draft.enabled),
      clientId: draft.clientId.trim(),
      clientSecret: secret,
      hideOnLogin: Boolean(draft.hideOnLogin),
      accountLinkingOnly: Boolean(draft.accountLinkingOnly),
      trustEmail: Boolean(draft.trustEmail),
      mfaRequired: Boolean(draft.mfaRequired),
      requiredClaims: draft.requiredClaims.trim() || "sub",
      storeTokens: Boolean(draft.storeTokens),
      storedTokensReadable: Boolean(draft.storedTokensReadable),
      guiOrder: Number(draft.guiOrder ?? 0),
      showInAccountConsole: current.showInAccountConsole || "always",
      syncMode: draft.syncMode || "import",
      authorizationUri: draft.authorizationUri.trim(),
      tokenUri: draft.tokenUri.trim(),
      userInfoUri: draft.userInfoUri.trim() || null,
      jwkSetUri: draft.jwkSetUri.trim() || null,
      issuerUri: draft.issuerUri.trim() || null,
      clientAuthenticationMethod: draft.clientAuthenticationMethod,
      scopes: draft.scopes.trim(),
      userNameAttribute: draft.userNameAttribute.trim(),
    };
    state.data.identityProviderConfigurationDrafts ??= {};
    state.data.identityProviderConfigurationDrafts[key] = draft;
    state.data.identityProviderConfigurationErrorId = key;
    state.error = null;
    state.notice = null;
    state.busy = `identity-provider-config-save:${key}`;
    render();
    try {
      const saved = await request(
        creating
          ? "/api/admin/identity-providers"
          : `/api/admin/identity-providers/${encodeURIComponent(providerId)}`,
        { method: creating ? "POST" : "PUT", body },
      );
      const safeSaved = safeIdentityProviderConfiguration(saved);
      if (creating) {
        state.data.identityProviderQuery = "";
        state.data.identityProviderPage = 0;
        state.data.identityProviders = {
          ...state.data.identityProviders,
          content: [safeSaved, ...providers],
          totalElements:
            Number(state.data.identityProviders?.totalElements ?? 0) + 1,
        };
        state.notice = text("adminProviderConnectionCreated");
        state.data.identityProviderDetailId = String(safeSaved.id ?? "");
        state.data.identityProviderDetailTab = "details";
        state.route = "identity-provider-detail";
        window.history.pushState(
          null,
          "",
          `#/admin/identity-providers/${encodeURIComponent(state.data.identityProviderDetailId)}/details`,
        );
      } else {
        state.data.identityProviders = {
          ...state.data.identityProviders,
          content: providers.map((item) =>
            item.id === providerId ? { ...item, ...safeSaved } : item,
          ),
        };
        state.notice = text("adminProviderConnectionUpdated");
      }
      state.data.identityProviderConfigurationOpenId = null;
      delete state.data.identityProviderConfigurationDrafts[key];
      delete state.data.identityProviderConfigurationBaselines[key];
      state.data.identityProviderConfigurationErrorId = null;
    } catch {
      /* The secret stays out of drafts after validation or transport errors. */
    }
    state.busy = null;
    render();
    if (creating && state.data.identityProviderDetailId)
      void loadRoute({ keepContent: true });
    return;
  }
  if (form.dataset.form === "admin-user-password-reset") {
    const id = Number(form.dataset.userId);
    const user = adminUserById(id);
    const password = String(formString(values.password, ""));
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
    const user = adminUserById(userId);
    const action = String(formString(values.action, ""));
    const lifespan = String(formString(values.lifespan, ""));
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
    const label = String(formString(values.label, "")).trim();
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
    const queryKey =
      kind === "applicationRoles" ? "applicationRoleQuery" : "clientRoleQuery";
    mapping[queryKey] = String(formString(values.q, "")).trim();
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
  if (form.dataset.form === "client-evaluation") {
    if (state.busy || state.offline || state.route !== "client-detail") return;
    const params = new URLSearchParams({
      scopes: String(values.scopes ?? "").trim(),
      subject: String(values.subject ?? "").trim(),
    });
    state.data.clientEvaluationDraft = values;
    state.busy = "client-evaluate";
    state.error = null;
    render();
    try {
      state.data.clientEvaluation = await request(
        `${clientDetailPath()}/scope-evaluation?${params}`,
      );
    } catch {
      /* The request adapter renders localized validation and transport feedback. */
    } finally {
      state.busy = null;
      render();
    }
    return;
  }
  if (form.dataset.form === "admin-client-configuration") {
    const id = form.dataset.clientId ?? "";
    const clients =
      state.data.clientConfiguration && state.route === "client-detail"
        ? [state.data.clientConfiguration]
        : nativeClientRows();
    const existing = state.data.clientConfiguration;
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      existing?.id !== id ||
      !clients.some((client) => client.id === id) ||
      !clientCanUpdate(existing)
    )
      return;
    const values = formValues(form);
    const checkedValues = (name) =>
      [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(
        (input) => input.value,
      );
    const listValue = (name) => clientCreateLineValues(values[name] ?? "");
    const body = {
      clientId: String(formString(values.clientId, "")).trim(),
      clientName: String(formString(values.clientName, "")).trim(),
      clientAuthenticationMethods: checkedValues("clientAuthenticationMethods"),
      authorizationGrantTypes: checkedValues("authorizationGrantTypes"),
      redirectUris: listValue("redirectUris"),
      postLogoutRedirectUris: listValue("postLogoutRedirectUris"),
      scopes: listValue("scopes"),
      requireAuthorizationConsent: form.elements.namedItem(
        "requireAuthorizationConsent",
      ).checked,
      requireProofKey: form.elements.namedItem("requireProofKey").checked,
      requireDpop: form.elements.namedItem("requireDpop").checked,
      requireDpopJkt: form.elements.namedItem("requireDpopJkt").checked,
      dpopRefreshTokenOnly: form.elements.namedItem("dpopRefreshTokenOnly")
        .checked,
      dpopSigningAlgorithms: checkedValues("dpopSigningAlgorithms"),
      cibaDeliveryMode: String(formString(values.cibaDeliveryMode, "poll")),
      cibaNotificationEndpoint:
        String(formString(values.cibaNotificationEndpoint, "")).trim() || null,
      cibaClientNotificationToken: String(
        formString(values.cibaClientNotificationToken, ""),
      ),
      authorizationCodeTimeToLive:
        String(formString(values.authorizationCodeTimeToLive, "")).trim() ||
        null,
      accessTokenTimeToLive:
        String(formString(values.accessTokenTimeToLive, "")).trim() || null,
      refreshTokenTimeToLive:
        String(formString(values.refreshTokenTimeToLive, "")).trim() || null,
      serviceAccountEnabled: form.elements.namedItem("serviceAccountEnabled")
        .checked,
      clientSecretTimeToLive:
        String(formString(values.clientSecretTimeToLive, "")).trim() || null,
      enabled: form.elements.namedItem("enabled").checked,
      rootUrl: String(formString(values.rootUrl, "")).trim(),
      homeUrl: String(formString(values.homeUrl, "")).trim(),
      webOrigins: listValue("webOrigins"),
      adminUrl: String(formString(values.adminUrl, "")).trim(),
      frontChannelLogout: form.elements.namedItem("frontChannelLogout").checked,
      backchannelLogout: form.elements.namedItem("backchannelLogout").checked,
      jwkSetUrl: String(formString(values.jwkSetUrl, "")).trim(),
      tokenEndpointAuthenticationSigningAlgorithm:
        String(
          formString(values.tokenEndpointAuthenticationSigningAlgorithm, ""),
        ).trim() || null,
      x509CertificateSubjectDN: String(
        formString(values.x509CertificateSubjectDN, ""),
      ).trim(),
      clientSecretGracePeriod:
        String(formString(values.clientSecretGracePeriod, "")).trim() || null,
      offlineSessionIdle:
        String(formString(values.offlineSessionIdle, "")).trim() || null,
      offlineSessionMax:
        String(formString(values.offlineSessionMax, "")).trim() || null,
      tokenExchangeDownscopeOnly: form.elements.namedItem(
        "tokenExchangeDownscopeOnly",
      ).checked,
      tokenExchangeAllowDelegation: form.elements.namedItem(
        "tokenExchangeAllowDelegation",
      ).checked,
      tokenExchangeAllowedAudiences: listValue("tokenExchangeAllowedAudiences"),
    };
    const localErrors = {};
    if (!body.clientId) localErrors.clientId = text("adminRequired");
    else if (body.clientId.length > 100)
      localErrors.clientId = text("adminMax100");
    if (!body.clientName) localErrors.clientName = text("adminRequired");
    else if (body.clientName.length > 200)
      localErrors.clientName = text("adminMax200");
    if (body.clientAuthenticationMethods.length === 0)
      localErrors.clientAuthenticationMethods = text("adminRequired");
    if (body.authorizationGrantTypes.length === 0)
      localErrors.authorizationGrantTypes = text("adminRequired");
    if (body.scopes.length === 0) localErrors.scopes = text("adminRequired");
    if (
      !body.dpopSigningAlgorithms.length ||
      body.dpopSigningAlgorithms.some(
        (value) => !["RS256", "ES256"].includes(value),
      )
    )
      localErrors.dpopSigningAlgorithms = text("adminRequired");
    if (
      body.tokenEndpointAuthenticationSigningAlgorithm &&
      ![
        "RS256",
        "RS384",
        "RS512",
        "PS256",
        "PS384",
        "PS512",
        "ES256",
        "ES384",
        "ES512",
      ].includes(body.tokenEndpointAuthenticationSigningAlgorithm)
    )
      localErrors.tokenEndpointAuthenticationSigningAlgorithm =
        text("adminRequired");
    if (
      body.authorizationGrantTypes.includes("authorization_code") &&
      body.redirectUris.length === 0
    )
      localErrors.redirectUris = text("adminRequired");
    for (const name of [
      "redirectUris",
      "postLogoutRedirectUris",
      "webOrigins",
    ]) {
      if (!body[name].every(isAbsoluteFragmentFreeUri))
        localErrors[name] = text("adminInvalidUri");
    }
    for (const name of [
      "rootUrl",
      "homeUrl",
      ["admin", "Url"].join(""),
      "jwkSetUrl",
    ]) {
      if (body[name] && !isAbsoluteFragmentFreeUri(body[name]))
        localErrors[name] = text("adminInvalidUri");
    }
    if (Object.keys(localErrors).length) {
      const safeDraft = clientConfigurationFormDraft(form);
      state.data.clientConfigurationDrafts ??= {};
      state.data.clientConfigurationDrafts[id] = safeDraft;
      state.data.clientConfigurationErrorId = id;
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
      document
        .querySelector(`[name="${Object.keys(localErrors)[0]}"]`)
        ?.focus();
      return;
    }
    if (!form.reportValidity()) return;
    const safeDraft = clientConfigurationFormDraft(form);
    state.data.clientConfigurationDrafts ??= {};
    state.data.clientConfigurationDrafts[id] = safeDraft;
    state.data.clientConfigurationErrorId = id;
    state.error = null;
    state.notice = null;
    state.busy = `client-configuration-save:${id}`;
    render();
    try {
      const updated = await request(
        `/api/admin/clients/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body,
        },
      );
      const {
        serviceAccountUsername: _serviceAccountUsername,
        ...safeUpdated
      } = updated;
      void _serviceAccountUsername;
      state.data.clientConfiguration = safeUpdated;
      state.data.clients = {
        ...state.data.clients,
        content: clients.map((client) =>
          client.id === id
            ? {
                ...client,
                ...safeUpdated,
              }
            : client,
        ),
      };
      state.data.clientConfigurationDrafts[id] =
        clientConfigurationDraft(safeUpdated);
      state.data.clientConfigurationEditId =
        state.route === "client-detail" ? id : null;
      state.data.clientConfigurationErrorId = null;
      state.notice = text("adminClientConfigurationUpdated");
    } catch {
      /* Retain non-secret fields for localized validation or retry. */
    }
    state.busy = null;
    render({ preserveDrafts: false });
    return;
  }
  if (form.dataset.form === "admin-client-native-metadata") {
    const id = form.dataset.clientId ?? "";
    const clients =
      state.data.clientConfiguration && state.route === "client-detail"
        ? [state.data.clientConfiguration]
        : nativeClientRows();
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !clients.some((client) => client.id === id) ||
      !form.reportValidity()
    )
      return;
    const body = {
      clientName: String(formString(values.clientName, "")).trim(),
    };
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
    const clients =
      state.data.clientConfiguration && state.route === "client-detail"
        ? [state.data.clientConfiguration]
        : nativeClientRows();
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
      ].sort((left, right) => left.localeCompare(right)),
      optionalScopes: [
        ...new Set(
          [...form.querySelectorAll('input[name="optionalScopes"]:checked')]
            .map((input) => input.value)
            .filter((name) => available.has(name)),
        ),
      ].sort((left, right) => left.localeCompare(right)),
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
      const scopes = [
        ...new Set([
          ...(saved.defaultScopes ?? []),
          ...(saved.optionalScopes ?? []),
        ]),
      ];
      if (state.data.clientConfiguration?.id === clientId) {
        state.data.clientConfiguration.scopes = scopes;
        if (state.data.clientConfigurationDrafts?.[clientId])
          state.data.clientConfigurationDrafts[clientId].scopes =
            scopes.join("\n");
      }
      if (Array.isArray(state.data.clients?.content))
        state.data.clients.content = state.data.clients.content.map((client) =>
          client.id === clientId ? { ...client, scopes } : client,
        );
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
    render({ preserveDrafts: false });
    return;
  }
  if (form.dataset.form === "admin-identity-provider-policy") {
    const id = form.dataset.providerId ?? "";
    const providers = state.data.identityProviders?.content ?? [];
    const provider = providers.some((item) => item.id === id);
    if (
      state.offline ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !provider ||
      !state.data.identityProviderPolicies?.[id] ||
      !form.reportValidity()
    )
      return;
    const body = {
      displayName: String(formString(values.displayName, "")).trim(),
      enabled: form.elements.namedItem("enabled").checked,
      hideOnLogin: form.elements.namedItem("hideOnLogin").checked,
      accountLinkingOnly: form.elements.namedItem("accountLinkingOnly").checked,
      trustEmail: form.elements.namedItem("trustEmail").checked,
      mfaRequired: form.elements.namedItem("mfaRequired").checked,
      guiOrder: Number(values.guiOrder),
      showInAccountConsole: String(formString(values.showInAccountConsole, "")),
      syncMode: String(formString(values.syncMode, "")),
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
      name: String(formString(values.name, "")).trim(),
      sourceClaim: String(formString(values.sourceClaim, "")).trim(),
      target: String(formString(values.target, "")).trim(),
      mapperType: String(formString(values.mapperType, "")),
      syncMode: String(formString(values.syncMode, "")),
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
      const path = `/api/admin/identity-providers/${providerId}/mappers${mapperId ? "/" + mapperId + "" : ""}`;
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
            chooseLazy(
              mapper.id === mapperId,
              () => savedMapper,
              () => mapper,
            ),
          )
        : [...mappers, savedMapper];
      state.data.identityProviders = {
        ...state.data.identityProviders,
        content: providers.map((item) =>
          item.id === providerId
            ? {
                ...item,
                mapperCount: chooseLazy(
                  mapperId,
                  () => item.mapperCount,
                  () =>
                    chooseLazy(
                      Number.isSafeInteger(item.mapperCount),
                      () => item.mapperCount,
                      () => 0,
                    ) + 1,
                ),
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
    if (
      state.route === "identity-provider-detail" &&
      state.data.identityProviderDetailTab === "mappers"
    )
      await loadRoute({ keepContent: true });
    return;
  }
  if (form.dataset.form === "admin-client-scope-mapper") {
    const scopeId = form.dataset.scopeId ?? "";
    const mapperId = form.dataset.mapperId || null;
    const scope = clientScopeById(scopeId);
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
      name: String(formString(values.name, "")).trim(),
      mapperType: String(formString(values.mapperType, "")),
      source: String(formString(values.source, "")).trim() || null,
      claimName: String(formString(values.claimName, "")).trim() || null,
      value: String(formString(values.value, "")).trim() || null,
      priority: Number(formString(values.priority, 100)),
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
        `/api/admin/client-scopes/${scopeId}/mappers${mapperId ? "/" + mapperId + "" : ""}`,
        {
          method: mapperId ? "PUT" : "POST",
          body,
        },
      );
      state.data.clientScopeMappers[scopeId] = mapperId
        ? mappers.map((item) =>
            chooseLazy(
              String(item.id) === mapperId,
              () => saved,
              () => item,
            ),
          )
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
    const client = nativeClientRows().some(
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
      name: String(formString(values.name, "")).trim(),
      mapperType: String(formString(values.mapperType, "")),
      source: String(formString(values.source, "")).trim() || null,
      claimName: String(formString(values.claimName, "")).trim() || null,
      value: String(formString(values.value, "")).trim() || null,
      priority: Number(formString(values.priority, 100)),
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
        `/api/admin/clients/${encodeURIComponent(clientId)}/mappers${mapperId ? "/" + mapperId + "" : ""}`,
        { method: mapperId ? "PUT" : "POST", body },
      );
      state.data.clientMappers[clientId] = mapperId
        ? mappers.map((item) =>
            chooseLazy(
              String(item.id) === mapperId,
              () => saved,
              () => item,
            ),
          )
        : [...mappers, saved];
      syncNativeClientMapperPage(clientId, mapperId ? 0 : 1);
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
  if (form.dataset.form === "admin-user-edit") {
    const id = Number(form.dataset.userId);
    const users = state.data.users?.content ?? [];
    const user = users.some((candidate) => Number(candidate.id) === id);
    if (!Number.isSafeInteger(id) || id < 1 || !user || !form.reportValidity())
      return;
    const body = {
      username: String(formString(values.username, "")).trim(),
      firstName: String(formString(values.firstName, "")).trim() || null,
      lastName: String(formString(values.lastName, "")).trim() || null,
      email: String(formString(values.email, "")).trim() || null,
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
      locale: String(formString(values.locale, "")).trim(),
      bundle: String(formString(values.bundle, "")).trim(),
      messageKey: String(formString(values.messageKey, "")).trim(),
      messageValue: String(formString(values.messageValue, "")).trim(),
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
    if (
      state.offline ||
      state.data.adminAccess?.manageClients !== true ||
      clientScopeById(scopeId)?.builtIn
    )
      return;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(scopeId)) return;
    if (!form.reportValidity()) return;
    const body = {
      name: String(formString(values.name, scopeName)).trim(),
      displayName: String(formString(values.displayName, "")) || null,
      description: String(formString(values.description, "")) || null,
      displayOnConsentScreen: Boolean(
        form.elements.namedItem("displayOnConsentScreen")?.checked ??
        clientScopeById(scopeId)?.displayOnConsentScreen,
      ),
      consentScreenText:
        String(formString(values.consentScreenText, "")) || null,
      includeInTokenScope: Boolean(
        form.elements.namedItem("includeInTokenScope")?.checked ??
        clientScopeById(scopeId)?.includeInTokenScope ??
        true,
      ),
      groupMapperEnabled: Boolean(
        form.elements.namedItem("groupMapperEnabled")?.checked ??
        clientScopeById(scopeId)?.groupMapperEnabled,
      ),
      groupClaimName: String(
        formString(values.groupClaimName, "groups"),
      ).trim(),
      groupMapperFullPath: Boolean(
        form.elements.namedItem("groupMapperFullPath")?.checked ??
        clientScopeById(scopeId)?.groupMapperFullPath ??
        true,
      ),
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
    if (state.offline || state.data.adminAccess?.manageRoles !== true) return;
    const roleName = form.dataset.roleName ?? "";
    if (!/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName)) return;
    if (!form.reportValidity()) return;
    const description =
      String(formString(values.description, "")).trim() || null;
    state.data.adminRoleDrafts ??= {};
    state.data.adminRoleDrafts[roleName] = { description: description ?? "" };
    if ((description?.length ?? 0) > 500) {
      state.data.adminRoleErrorName = roleName;
      state.error = {
        kind: "validation",
        body: {
          violations: [
            {
              field: "description",
              message: text("adminRoleDescriptionTooLong"),
            },
          ],
        },
      };
      render();
      return;
    }
    state.error = null;
    state.notice = null;
    state.data.adminRoleErrorName = roleName;
    state.busy = `role-update:${roleName}`;
    render();
    try {
      const updated = await request(
        `/api/admin/roles/${encodeURIComponent(roleName)}`,
        {
          method: "PUT",
          body: { name: roleName, description },
        },
      );
      delete state.data.adminRoleDrafts[roleName];
      state.data.adminRoleErrorName = null;
      if (
        state.route === "role-detail" &&
        state.data.roleDetailName === roleName
      ) {
        state.data.roleDetail.description = updated.description;
      } else {
        await loadRoute({ keepContent: true });
      }
      state.notice = text("adminRoleUpdated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-role-create") {
    if (state.offline || state.data.adminAccess?.manageRoles !== true) return;
    const body = {
      name: String(formString(values.name, "")).trim(),
      description: String(formString(values.description, "")).trim() || null,
    };
    const localErrors = {};
    if (!body.name) localErrors.name = text("adminRoleNameRequired");
    else if (!/^ROLE_[A-Z0-9_]{1,45}$/.test(body.name))
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
      const created = await request("/api/admin/roles", {
        method: "POST",
        body,
      });
      state.data.adminRoleCreateDraft = null;
      state.busy = null;
      await roleScreens.open(created.name);
      state.notice = text("adminRoleCreated");
    } catch {
      /* request rendered localized server validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-create") {
    const bodyDraft = {
      clientId: String(formString(values.clientId, "")).trim(),
      clientName: String(formString(values.clientName, "")).trim(),
      authenticationMode:
        values.authenticationMode === "public" ? "public" : "confidential",
      redirectUris: String(formString(values.redirectUris, "")),
      postLogoutRedirectUris: String(
        formString(values.postLogoutRedirectUris, ""),
      ),
      scopes: String(formString(values.scopes, "")).trim(),
      requireAuthorizationConsent: form.elements.namedItem(
        "requireAuthorizationConsent",
      ).checked,
    };
    state.data.adminClientCreateDraft = bodyDraft;
    const redirectUris = clientCreateLineValues(bodyDraft.redirectUris);
    const postLogoutRedirectUris = clientCreateLineValues(
      bodyDraft.postLogoutRedirectUris,
    );
    const localErrors = {};
    if (!bodyDraft.clientId) localErrors.clientId = text("adminRequired");
    if (bodyDraft.clientId.length > 100)
      localErrors.clientId = text("adminMax100");
    if (!bodyDraft.clientName) localErrors.clientName = text("adminRequired");
    if (bodyDraft.clientName.length > 200)
      localErrors.clientName = text("adminMax200");
    if (redirectUris.length === 0)
      localErrors.redirectUris = text("adminRequired");
    else if (!redirectUris.every(isAbsoluteFragmentFreeUri))
      localErrors.redirectUris = text("adminInvalidUri");
    if (!postLogoutRedirectUris.every(isAbsoluteFragmentFreeUri))
      localErrors.postLogoutRedirectUris = text("adminInvalidUri");
    if (!bodyDraft.scopes || bodyDraft.scopes.length > 1000)
      localErrors.scopes = text("adminRequired");
    if (Object.keys(localErrors).length) {
      state.data.adminClientCreateError = true;
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
    if (state.offline || !form.reportValidity()) return;
    const confidential = bodyDraft.authenticationMode === "confidential";
    const body = {
      clientId: bodyDraft.clientId,
      clientName: bodyDraft.clientName,
      clientAuthenticationMethods: [
        confidential ? "client_secret_basic" : "none",
      ],
      authorizationGrantTypes: ["authorization_code", "refresh_token"],
      redirectUris,
      postLogoutRedirectUris,
      scopes: bodyDraft.scopes.split(/\s+/).filter(Boolean),
      requireAuthorizationConsent: bodyDraft.requireAuthorizationConsent,
      requireProofKey: true,
      requireDpop: false,
      requireDpopJkt: false,
      dpopRefreshTokenOnly: false,
      dpopSigningAlgorithms: ["RS256", "ES256"],
      cibaDeliveryMode: "poll",
      authorizationCodeTimeToLive: "PT5M",
      accessTokenTimeToLive: "PT5M",
      refreshTokenTimeToLive: "PT1H",
      serviceAccountEnabled: false,
      clientSecretTimeToLive: confidential ? "P90D" : null,
      enabled: true,
      frontChannelLogout: false,
      backchannelLogout: false,
      tokenEndpointAuthenticationSigningAlgorithm: "RS256",
      clientSecretGracePeriod: "PT24H",
      tokenExchangeDownscopeOnly: false,
      tokenExchangeAllowDelegation: false,
      tokenExchangeAllowedAudiences: [],
    };
    state.data.adminClientCreateError = true;
    state.error = null;
    state.notice = null;
    state.busy = "client-create";
    render();
    try {
      const created = await request("/api/admin/clients", {
        method: "POST",
        body,
      });
      const client = created?.client;
      if (!client || typeof client.id !== "string")
        throw new Error("invalid_client_create_response");
      state.data.clients = {
        ...(state.data.clients ?? { content: [], number: 0, totalPages: 0 }),
        content: [
          {
            id: client.id,
            clientId: client.clientId,
            clientName: client.clientName,
            scopes: Array.isArray(client.scopes) ? client.scopes : body.scopes,
            requireProofKey: true,
          },
          ...nativeClientRows().filter((entry) => entry.id !== client.id),
        ],
      };
      state.data.clientCreateSecret =
        confidential && typeof created.clientSecret === "string"
          ? created.clientSecret
          : null;
      state.data.adminClientCreateDraft = null;
      state.data.adminClientCreateError = false;
      state.data.clientQuery = "";
      state.data.clientPage = 0;
      if (!state.data.clientCreateSecret) {
        state.route = "clients";
        state.notice = text("adminClientCreated");
      }
    } catch {
      /* Keep only the non-secret form draft for localized validation or retry. */
      if (!state.error) state.error = { kind: "failure" };
    }
    state.busy = null;
    render();
    return;
  }
  if (form.dataset.form === "admin-client-scope-create") {
    if (state.offline || state.data.adminAccess?.manageClients !== true) return;
    const body = {
      name: String(formString(values.name, "")).trim(),
      displayName: String(formString(values.displayName, "")).trim() || null,
      description: String(formString(values.description, "")).trim() || null,
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
      window.history.pushState(null, "", "#/admin/client-scopes");
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
        state.data.userSearchDraft = "";
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
      username: String(formString(values.username, "")).trim(),
      firstName: String(formString(values.firstName, "")).trim() || null,
      lastName: String(formString(values.lastName, "")).trim() || null,
      email: String(formString(values.email, "")).trim() || null,
      emailVerified: form.elements.namedItem("emailVerified").checked,
      password: String(formString(values.password, "")),
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
      state.data.userSearchDraft = "";
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
      defaultLocale: String(formString(values.defaultLocale, "")),
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
      locale: String(formString(values.locale, "")).trim(),
      bundle: String(formString(values.bundle, "")).trim(),
      messageKey: String(formString(values.messageKey, "")).trim(),
      messageValue: String(formString(values.messageValue, "")).trim(),
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
      applicationName: String(formString(values.applicationName, "")).trim(),
      primaryColor: String(formString(values.primaryColor, "")).trim(),
      accentColor: String(formString(values.accentColor, "")).trim(),
      backgroundColor: String(formString(values.backgroundColor, "")).trim(),
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
        kind: "validation",
        body: {
          detail: message,
          violations: [{ field: "otpRequired", message }],
        },
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
      fromAddress: String(formString(values.fromAddress, "")).trim(),
      baseUrl: String(formString(values.baseUrl, "")).trim(),
      host: String(formString(values.host, "")).trim(),
      port: Number(values.port),
      username:
        String(formString(values.username, "")).trim() ||
        draft.username ||
        current.username ||
        "",
      password: String(formString(values.password, "")),
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
      deliveryMode: formString(values.deliveryMode),
      userVerification: formString(values.userVerification),
      mfaRequired: form.elements.namedItem("mfaRequired").checked,
      stepUpRequired: form.elements.namedItem("stepUpRequired").checked,
      stepUpAcr: String(formString(values.stepUpAcr, "")).trim() || null,
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
      idleTimeout: String(formString(values.idleTimeout, "")).trim(),
      maxLifespan: String(formString(values.maxLifespan, "")).trim() || null,
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
      firstName: String(formString(values.firstName, "")),
      lastName: String(formString(values.lastName, "")),
      email: String(formString(values.email, "")),
      preferredLocale: String(formString(values.preferredLocale, "en")),
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
          firstName: formString(values.firstName).trim(),
          lastName: formString(values.lastName).trim(),
          email: formString(values.email).trim(),
          currentPassword:
            formString(values.currentPassword).trim() || undefined,
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
      formString(values.newPassword).length < 12 ||
      values.newPassword !== values.confirmPassword
    ) {
      const message = text("passwordMismatch");
      state.error = {
        kind: "validation",
        body: {
          detail: message,
          violations: [{ field: "newPassword", message }],
        },
      };
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
      const message = text("passwordRequired");
      state.error = {
        kind: "validation",
        body: {
          detail: message,
          violations: [{ field: "deletePassword", message }],
        },
      };
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
  if (action === "server-info-tab") {
    if (state.busy) return;
    const tab = element.dataset.tab;
    if (!["discovery", "jwks"].includes(tab)) return;
    state.data.adminServerInfoTab = tab;
    render();
    return;
  }
  if (action === "server-info-copy") {
    if (state.busy) return;
    const id = element.dataset.copyId;
    const copyValue = (() => {
      if (id === "json:discovery")
        return JSON.stringify(state.data.adminServerDiscovery ?? {}, null, 2);
      if (id === "json:jwks")
        return JSON.stringify(state.data.adminServerJwks ?? {}, null, 2);
      const endpoint =
        /^endpoint:(issuer|authorization|token|introspection|revocation|userInfo|jwks|endSession)$/.exec(
          id ?? "",
        );
      if (!endpoint) return null;
      const endpointValues = {
        issuer: state.data.adminServerInfo?.issuer,
        authorization: state.data.adminServerInfo?.authorizationEndpoint,
        token: state.data.adminServerInfo?.tokenEndpoint,
        introspection: state.data.adminServerInfo?.introspectionEndpoint,
        revocation: state.data.adminServerInfo?.revocationEndpoint,
        userInfo: state.data.adminServerInfo?.userInfoEndpoint,
        jwks: state.data.adminServerInfo?.jwksEndpoint,
        endSession: state.data.adminServerInfo?.endSessionEndpoint,
      };
      return endpointValues[endpoint[1]] ?? null;
    })();
    if (typeof copyValue !== "string" || !copyValue) return;
    state.busy = `server-info-copy:${id}`;
    state.data.adminServerInfoCopyFailed = false;
    render();
    try {
      await navigator.clipboard.writeText(copyValue);
      state.data.adminServerInfoCopied = id;
      setTimeout(() => {
        if (state.data.adminServerInfoCopied !== id) return;
        state.data.adminServerInfoCopied = null;
        render();
      }, 1800);
    } catch {
      state.data.adminServerInfoCopyFailed = true;
      state.data.adminServerInfoCopied = null;
    } finally {
      state.busy = null;
      render();
    }
    return;
  }
  if (
    action.startsWith("admin-provider-") ||
    action.startsWith("admin-identity-provider-delete-")
  ) {
    if (
      state.busy ||
      state.console !== "admin" ||
      !adminRouteAllowed("identity-providers")
    )
      return;
    if (action === "admin-provider-create") {
      state.data.identityProviderCreateType = "oidc";
      state.route = "identity-provider-create";
      window.history.pushState(null, "", "#/admin/identity-providers/new");
      state.error = null;
      await loadRoute();
      return;
    }
    if (action === "admin-provider-list") {
      state.route = "identity-providers";
      state.data.identityProviderPage ??= 0;
      window.history.pushState(null, "", "#/admin/identity-providers");
      await loadRoute();
      return;
    }
    if (action === "admin-provider-open") {
      const id = element.dataset.id;
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "")) return;
      state.data.identityProviderDetailId = id;
      state.data.identityProviderDetailTab = "details";
      state.route = "identity-provider-detail";
      window.history.pushState(
        null,
        "",
        `#/admin/identity-providers/${encodeURIComponent(id)}/details`,
      );
      state.error = null;
      await loadRoute();
      return;
    }
    if (action === "admin-provider-tab") {
      const tab = element.dataset.tab;
      const id = state.data.identityProviderDetailId;
      if (
        !/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") ||
        !["details", "mappers"].includes(tab)
      )
        return;
      state.data.identityProviderDetailTab = tab;
      state.data.identityProviderMapperPage = 0;
      window.history.pushState(
        null,
        "",
        `#/admin/identity-providers/${encodeURIComponent(id)}/${tab}`,
      );
      await loadRoute();
      return;
    }
    if (action === "admin-provider-clear-filters") {
      clearTimeout(identityProviderSearchTimer);
      state.data.identityProviderQuery = "";
      state.data.identityProviderPage = 0;
      await loadRoute();
      return;
    }
    if (action === "admin-provider-mapper-clear") {
      if (state.busy) return;
      clearTimeout(identityProviderMapperSearchTimer);
      identityProviderMapperSearchTimer = null;
      state.data.identityProviderMapperQuery = "";
      state.data.identityProviderMapperPage = 0;
      state.busy = "provider-mappers-search";
      render();
      await loadRoute({ keepContent: true });
      state.busy = null;
      render();
      return;
    }
    if (action === "admin-provider-mapper-create") {
      const providerId = element.dataset.provider;
      if (
        !/^[A-Za-z0-9_-]{1,100}$/.test(providerId ?? "") ||
        !Array.isArray(state.data.identityProviderMappers?.[providerId])
      )
        return;
      state.data.providerMapperEditor = { providerId, mapperId: null };
      state.data.providerMapperErrorKey = null;
      state.error = null;
      render();
      return;
    }
  }
  if (action === "admin-provider-create-type") {
    if (state.busy || state.route !== "identity-provider-create") return;
    state.data.identityProviderCreateType =
      element.value === "saml" ? "saml" : "oidc";
    state.data.identityProviderConfigurationOpenId =
      state.data.identityProviderCreateType === "saml" ? "new-saml" : "new";
    render();
    return;
  }
  if (
    action.startsWith("admin-client-scope-") &&
    ![
      "admin-client-scope-role-mappings-toggle",
      "admin-client-scope-mappers-toggle",
    ].includes(action) &&
    state.data.adminAccess?.manageClients !== true
  )
    return;
  if (
    ["client-scope-open", "client-scope-edit", "client-scope-back"].includes(
      action,
    )
  ) {
    if (state.busy || state.console !== "admin") return;
    if (action === "client-scope-back") {
      state.route = "client-scopes";
      state.data.clientScopeDeleteConfirmId = null;
    } else {
      const id = element.dataset.id;
      if (
        !/^[A-Za-z0-9_-]{1,100}$/.test(id ?? "") ||
        !adminRouteAllowed("client-scope-detail")
      )
        return;
      const scope = clientScopeById(id);
      if (
        action === "client-scope-edit" &&
        (state.data.adminAccess?.manageClients !== true || scope?.builtIn)
      )
        return;
      state.data.clientScopeDetailId = id;
      state.data.clientScopeDetail = null;
      state.data.clientScopeEditing = action === "client-scope-edit";
      state.route = "client-scope-detail";
    }
    const hash =
      state.route === "client-scopes"
        ? "#/admin/client-scopes"
        : `#/admin/client-scopes/${state.data.clientScopeDetailId}/${state.data.clientScopeEditing ? "edit" : "details"}`;
    window.history.pushState(null, "", hash);
    state.busy = "client-scope-navigation";
    await loadRoute();
    state.busy = null;
    render();
    if (state.data.clientScopeEditing)
      document
        .querySelector('[data-form="admin-client-scope-edit"] input')
        ?.focus();
    else document.querySelector(".topbar h1")?.focus();
    return;
  }
  if (action.startsWith("client-") && !action.startsWith("client-create")) {
    await clientAction(action, element);
    return;
  }
  if (action === "create-group" || action.startsWith("group-")) {
    await groupScreens.handle(action, element);
    return;
  }
  if (action === "create-organization" || action.startsWith("organization-")) {
    await organizationScreens.handle(action, element);
    return;
  }
  if (action.startsWith("role-") && (await roleScreens.handle(action, element)))
    return;
  if (action === "admin-user-detail-open") {
    if (state.busy || state.offline) return;
    const id = Number(element.dataset.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    state.route = "user-detail";
    state.data.adminUserDetailId = id;
    state.data.adminUserDetailTab = "details";
    state.data.adminUserDetailDeleteConfirm = false;
    delete state.data.adminUserDetailPassword;
    delete state.data.adminUserDetailPasswordError;
    state.busy = "route:user-detail";
    state.notice = null;
    void loadRoute().finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (action === "admin-user-detail-back" && state.data.roleReturnFromUser) {
    if (state.busy) return;
    state.data.roleReturnFromUser = false;
    state.route = "role-detail";
    await loadRoute();
    return;
  }
  if (action === "admin-user-detail-back") {
    if (state.busy) return;
    state.route = "users";
    delete state.data.adminUserDetailPassword;
    delete state.data.adminUserDetailPasswordError;
    state.busy = "route:users";
    void loadRoute().finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (action === "admin-user-detail-tab") {
    if (state.busy) return;
    const tab = element.dataset.tab;
    if (
      ![
        "details",
        "credentials",
        "roles",
        "groups",
        "sessions",
        "consents",
        "events",
      ].includes(tab)
    )
      return;
    if (tab === "events" && !state.data.adminAccess?.viewEvents) return;
    state.data.adminUserDetailTab = tab;
    if (tab !== "credentials") {
      delete state.data.adminUserDetailPassword;
      delete state.data.adminUserDetailPasswordError;
    }
    state.busy = `user-detail-tab:${tab}`;
    state.error = null;
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (action === "admin-user-detail-page") {
    if (state.busy) return;
    const tab = element.dataset.tab;
    const page = Number(element.dataset.page);
    if (
      !["groups", "sessions", "consents", "events"].includes(tab) ||
      !Number.isSafeInteger(page) ||
      page < 0
    )
      return;
    state.data.adminUserDetailPages ??= {};
    state.data.adminUserDetailPages[tab] = page;
    state.busy = `user-detail-page:${tab}`;
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (action === "admin-user-detail-page-size") {
    const tab = element.dataset.tab;
    const size = Number(element.value);
    if (
      state.busy ||
      !["sessions", "consents", "events"].includes(tab) ||
      ![10, 20, 50, 100].includes(size)
    )
      return;
    state.data.adminUserDetailPageSizes ??= {};
    state.data.adminUserDetailPages ??= {};
    state.data.adminUserDetailPageSizes[tab] = size;
    state.data.adminUserDetailPages[tab] = 0;
    state.busy = `user-detail-page:${tab}`;
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (
    action === "admin-user-detail-delete" ||
    action === "admin-user-detail-delete-cancel"
  ) {
    if (state.busy || state.data.adminAccess?.manageUsers !== true) return;
    state.data.adminUserDetailDeleteConfirm =
      action === "admin-user-detail-delete";
    render();
    return;
  }
  if (action === "admin-user-detail-delete-confirm") {
    const id = Number(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !state.data.adminUserDetailDeleteConfirm ||
      state.data.adminAccess?.manageUsers !== true ||
      !Number.isSafeInteger(id) ||
      id < 1
    )
      return;
    state.busy = `user-detail-delete:${id}`;
    state.error = null;
    render();
    try {
      await request(`/api/admin/users/${id}`, { method: "DELETE" });
      state.data.adminUserDetailDeleteConfirm = false;
      state.data.adminUserDetail = null;
      state.route = "users";
      await loadRoute({ keepContent: true });
      state.notice = text("adminUserDeleted");
    } catch {
      /* Keep the confirmation visible for retry or cancellation. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-toggle-enabled") {
    const user = adminUserById(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !user ||
      state.data.adminAccess?.manageUsers !== true
    )
      return;
    const enabled = !user.enabled;
    state.busy = `user-detail-enabled:${user.id}`;
    state.error = null;
    render();
    try {
      await request(`/api/admin/users/${user.id}/enabled`, {
        method: "PUT",
        body: { enabled },
      });
      user.enabled = enabled;
      state.notice = text("adminUserEnabledUpdated");
    } catch {
      /* Keep the displayed state unchanged after a failed request. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-impersonate") {
    const id = Number(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !adminUserById(id) ||
      state.data.adminAccess?.manageUsers !== true
    )
      return;
    state.busy = `user-detail-impersonate:${id}`;
    state.error = null;
    render();
    try {
      const result = await request(`/api/admin/users/${id}/impersonation`, {
        method: "POST",
      });
      if (typeof result?.url !== "string")
        throw new Error("Invalid impersonation response");
      await api.openExternal(result.url);
    } catch {
      /* request rendered the localized API or transport error. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-unlock") {
    const user = adminUserById(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !user?.locked ||
      state.data.adminAccess?.manageUsers !== true
    )
      return;
    state.busy = `user-detail-unlock:${user.id}`;
    state.error = null;
    render();
    try {
      await request(`/api/admin/users/${user.id}/unlock`, { method: "POST" });
      user.locked = false;
      user.lockedUntil = null;
      user.failedLoginCount = 0;
      state.notice = text("adminUserUnlocked");
    } catch {
      /* Keep lock state until the server confirms the unlock. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-required-actions-retry") {
    if (state.busy || state.offline) return;
    const userId = Number(state.data.adminUserDetailId);
    state.busy = "user-detail-required-actions-retry";
    state.error = null;
    render();
    try {
      state.data.adminUserRequiredActions = await userRequiredActions(userId);
      state.data.adminUserDetailRequiredActionsError = false;
      state.data.adminUserDetailRequiredActionMutationError = false;
    } catch {
      state.data.adminUserDetailRequiredActionsError = true;
      if (state.session) state.error = null;
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-required-action") {
    const userId = Number(state.data.adminUserDetailId);
    const key = element.dataset.key;
    const item = (state.data.adminUserRequiredActions ?? []).find(
      (entry) => entry.key === key,
    );
    if (
      state.busy ||
      state.offline ||
      !item ||
      !item.enabled ||
      item.globalPolicy ||
      state.data.adminUserDetailRequiredActionsError ||
      state.data.adminAccess?.manageUsers !== true
    )
      return;
    const assigned = !item.assigned;
    state.busy = `user-detail-required-action:${key}`;
    state.error = null;
    state.data.adminUserDetailRequiredActionMutationError = false;
    render();
    try {
      await request(
        `/api/admin/required-actions/users/${userId}/${encodeURIComponent(key)}`,
        { method: assigned ? "POST" : "DELETE" },
      );
      item.assigned = assigned;
      try {
        state.data.adminUserRequiredActions = await userRequiredActions(userId);
      } catch {
        state.data.adminUserDetailRequiredActionsError = true;
        if (state.session) state.error = null;
      }
    } catch {
      state.data.adminUserDetailRequiredActionMutationError = true;
      if (state.session) state.error = null;
      /* Re-render restores the server-confirmed checkbox state. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-action-email-toggle") {
    if (state.busy || state.data.adminAccess?.manageUsers !== true) return;
    state.data.userActionEmailOpenId = Number(state.data.adminUserDetailId);
    state.data.adminUserActionEmailDrafts ??= {};
    state.data.adminUserActionEmailDrafts[state.data.userActionEmailOpenId] ??=
      { action: "UPDATE_PASSWORD", lifespan: "43200" };
    render();
    return;
  }
  if (
    action === "admin-user-detail-totp-request" ||
    action === "admin-user-detail-totp-cancel"
  ) {
    if (state.busy) return;
    state.data.adminUserDetailTotpConfirm =
      action === "admin-user-detail-totp-request";
    render();
    return;
  }
  if (action === "admin-user-detail-totp-confirm") {
    const user = adminUserById(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !user?.totpEnabled ||
      !state.data.adminUserDetailTotpConfirm ||
      state.data.adminAccess?.manageUsers !== true
    )
      return;
    state.busy = `user-detail-totp:${user.id}`;
    render();
    try {
      await request(`/api/admin/users/${user.id}/totp`, { method: "DELETE" });
      user.totpEnabled = false;
      state.data.adminUserDetailTotpConfirm = false;
      state.notice = text("adminAuthenticatorReset");
    } catch {
      /* Keep the confirmation visible if reset fails. */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-user-detail-add-group" ||
    action === "admin-user-detail-remove-group"
  ) {
    const userId = Number(state.data.adminUserDetailId);
    const groupId =
      action === "admin-user-detail-add-group"
        ? state.data.adminUserDetailGroupSelection
        : element.dataset.id;
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageUsers !== true ||
      !/^[1-9]\d*$/.test(String(groupId ?? ""))
    )
      return;
    state.busy = `user-detail-group:${groupId}`;
    render();
    try {
      await request(
        `/api/admin/groups/${groupId}/users${action === "admin-user-detail-add-group" ? "" : "/" + userId}`,
        {
          method: action === "admin-user-detail-add-group" ? "POST" : "DELETE",
          ...(action === "admin-user-detail-add-group"
            ? { body: { userId } }
            : {}),
        },
      );
      await loadRoute({ keepContent: true });
      state.notice =
        action === "admin-user-detail-add-group"
          ? state.locale === "tr"
            ? "Kullanıcı gruba eklendi."
            : "User added to group."
          : state.locale === "tr"
            ? "Kullanıcı gruptan çıkarıldı."
            : "User removed from group.";
    } catch {
      /* Keep the current group data on failure. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-revoke-session-cancel") {
    if (state.busy) return;
    state.data.adminUserDetailPendingSession = null;
    render();
    return;
  }
  if (
    action === "admin-user-detail-revoke-session" ||
    action === "admin-user-detail-revoke-session-confirm"
  ) {
    if (action === "admin-user-detail-revoke-session") {
      if (state.busy) return;
      state.data.adminUserDetailPendingSession = element.dataset.id;
      render();
      return;
    }
    const sessionId = state.data.adminUserDetailPendingSession;
    if (
      state.busy ||
      state.offline ||
      !sessionId ||
      state.data.adminAccess?.manageSessions !== true
    )
      return;
    state.busy = `user-detail-session:${sessionId}`;
    render();
    try {
      await request(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      state.data.adminUserDetailPendingSession = null;
      await loadRoute({ keepContent: true });
      state.notice =
        state.locale === "tr" ? "Oturum sonlandırıldı." : "Session revoked.";
    } catch {
      /* Keep the pending session confirmation available. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-revoke-all-sessions-cancel") {
    if (state.busy) return;
    state.data.adminUserDetailPendingRevokeAll = false;
    render();
    return;
  }
  if (action === "admin-user-detail-revoke-all-sessions") {
    const user = adminUserById(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !user ||
      state.data.adminAccess?.manageSessions !== true
    )
      return;
    state.data.adminUserDetailPendingRevokeAll = true;
    render();
    return;
  }
  if (action === "admin-user-detail-revoke-all-sessions-confirm") {
    const user = adminUserById(state.data.adminUserDetailId);
    if (
      state.busy ||
      state.offline ||
      !user ||
      !state.data.adminUserDetailPendingRevokeAll ||
      state.data.adminAccess?.manageSessions !== true
    )
      return;
    state.data.adminUserDetailPendingRevokeAll = false;
    state.busy = `user-detail-all-sessions:${user.id}`;
    render();
    try {
      await request(
        `/api/admin/users/${encodeURIComponent(user.username)}/sessions`,
        { method: "DELETE" },
      );
      await loadRoute({ keepContent: true });
      state.notice =
        state.locale === "tr"
          ? "Tüm kullanıcı oturumları sonlandırıldı."
          : "All user sessions revoked.";
    } catch {
      /* Keep current session list on failure. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-user-detail-revoke-consent-cancel") {
    if (state.busy) return;
    state.data.adminUserDetailPendingConsent = null;
    render();
    return;
  }
  if (action === "admin-user-detail-consent-details") {
    if (state.busy) return;
    const clientId = element.dataset.id;
    state.data.adminUserDetailConsentOpenId =
      state.data.adminUserDetailConsentOpenId === clientId ? null : clientId;
    render();
    return;
  }
  if (
    action === "admin-user-detail-revoke-consent" ||
    action === "admin-user-detail-revoke-consent-confirm"
  ) {
    if (action === "admin-user-detail-revoke-consent") {
      if (state.busy) return;
      state.data.adminUserDetailPendingConsent = {
        clientId: element.dataset.id,
        username: element.dataset.child,
      };
      render();
      return;
    }
    const pending = state.data.adminUserDetailPendingConsent;
    if (
      state.busy ||
      state.offline ||
      !pending ||
      state.data.adminAccess?.manageConsents !== true
    )
      return;
    state.busy = `user-detail-consent:${pending.clientId}`;
    render();
    try {
      await request(
        `/api/admin/consents/${encodeURIComponent(pending.clientId)}/${encodeURIComponent(pending.username)}`,
        { method: "DELETE" },
      );
      state.data.adminUserDetailPendingConsent = null;
      await loadRoute({ keepContent: true });
      state.notice =
        state.locale === "tr"
          ? "Kullanıcı izni kaldırıldı."
          : "User consent revoked.";
    } catch {
      /* Keep the pending consent confirmation available. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "notification-read") {
    const id = element.dataset.id ?? "";
    if (
      state.busy ||
      state.offline ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return;
    state.busy = `notification-read:${id}`;
    state.error = null;
    render();
    try {
      const base =
        state.console === "admin"
          ? "/api/admin/notifications"
          : "/api/account/notifications";
      await request(`${base}/${encodeURIComponent(id)}/read`, {
        method: "PUT",
      });
      const item = (state.data.notifications?.content ?? []).find(
        (entry) => entry.id === id,
      );
      if (item) item.read = true;
      state.data.notificationUnreadCount = Math.max(
        0,
        (state.data.notificationUnreadCount ?? 0) - 1,
      );
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "notifications-refresh") {
    if (state.busy || state.offline) return;
    state.busy = "notifications-refresh";
    await loadRoute({ keepContent: true });
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-role-composites-toggle") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId))
    )
      return;
    const key = clientId + ":" + roleId;
    state.data.clientRoleCompositions ??= {};
    const current = state.data.clientRoleCompositions[key];
    if (current?.open) {
      current.open = false;
      render();
      return;
    }
    const composition = (state.data.clientRoleCompositions[key] = {
      ...current,
      open: true,
      confirm: null,
      realmCandidates: [],
      clientCandidates: [],
    });
    state.busy = `client-role-composites-load:${clientId}:${roleId}`;
    state.error = null;
    render();
    try {
      const detail = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}?page=0&size=20&sort=username,asc`,
      );
      composition.realmRoles = Array.isArray(detail?.compositeRealmRoles)
        ? detail.compositeRealmRoles
        : [];
      composition.clientRoles = Array.isArray(detail?.compositeRoles)
        ? detail.compositeRoles
        : [];
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-role-composites-close") {
    if (state.busy) return;
    const key =
      (element.dataset.id ?? "") + ":" + (element.dataset.clientRoleId ?? "");
    const composition = state.data.clientRoleCompositions?.[key];
    if (composition) composition.open = false;
    render();
    return;
  }
  if (action === "admin-client-role-composite-search") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const kind = element.dataset.memberKind;
    const key = clientId + ":" + roleId;
    const composition = state.data.clientRoleCompositions?.[key];
    const query = String(
      element
        .closest("[data-client-role-composites]")
        ?.querySelector(`input[name="${kind}-composite-q"]`)?.value ?? "",
    ).trim();
    if (
      !composition?.open ||
      !["realm", "client"].includes(kind) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId))
    )
      return;
    const errorKey = kind + "SearchError";
    if (query.length < 2 || query.length > 100) {
      composition[errorKey] =
        query.length < 2
          ? "adminClientRoleSearchMinimum"
          : "adminClientRoleSearchMaximum";
      composition[kind + "Query"] = query;
      render();
      return;
    }
    composition[errorKey] = null;
    composition[kind + "Query"] = query;
    composition[kind + "Candidates"] = [];
    state.busy = `client-role-composite-search:${clientId}:${roleId}:${kind}`;
    state.error = null;
    render();
    try {
      const suffix =
        kind === "realm"
          ? "available-realm-composites"
          : "available-composites";
      const page = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}/${suffix}?q=${encodeURIComponent(query)}&page=0&size=10&sort=name,asc`,
      );
      const candidates = Array.isArray(page?.content) ? page.content : [];
      composition[kind + "Candidates"] =
        kind === "realm"
          ? candidates.filter((candidate) =>
              /^ROLE_[A-Z0-9_]{1,45}$/.test(candidate?.name ?? ""),
            )
          : candidates.filter(
              (candidate) =>
                Number.isSafeInteger(Number(candidate?.id)) &&
                Number(candidate.id) > 0 &&
                /^[A-Za-z0-9_-]{1,100}$/.test(candidate?.clientId ?? "") &&
                typeof candidate?.name === "string",
            );
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-role-composite-cancel") {
    if (state.busy) return;
    const key =
      (element.dataset.id ?? "") + ":" + (element.dataset.clientRoleId ?? "");
    const composition = state.data.clientRoleCompositions?.[key];
    if (
      composition?.confirm?.kind === element.dataset.memberKind &&
      composition.confirm.id === element.dataset.memberId
    )
      composition.confirm = null;
    render();
    return;
  }
  if (
    [
      "admin-client-role-composite-add-request",
      "admin-client-role-composite-add-confirm",
      "admin-client-role-composite-remove-request",
      "admin-client-role-composite-remove-confirm",
    ].includes(action)
  ) {
    if (state.busy || state.data.adminAccess?.manageClients !== true) return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const memberId = element.dataset.memberId ?? "";
    const kind = element.dataset.memberKind;
    const key = clientId + ":" + roleId;
    const composition = state.data.clientRoleCompositions?.[key];
    if (
      !composition?.open ||
      !["realm", "client"].includes(kind) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId)) ||
      (kind === "realm"
        ? !/^ROLE_[A-Z0-9_]{1,45}$/.test(memberId)
        : !/^[1-9]\d{0,18}$/.test(memberId) ||
          !Number.isSafeInteger(Number(memberId)))
    )
      return;
    const adding = action.includes("add");
    const assigned =
      kind === "realm"
        ? (composition.realmRoles ?? [])
        : (composition.clientRoles ?? []);
    const candidates =
      kind === "realm"
        ? (composition.realmCandidates ?? [])
        : (composition.clientCandidates ?? []);
    const hasMember = (role) =>
      kind === "realm" ? role.name === memberId : String(role.id) === memberId;
    const confirmation = composition.confirm;
    if (action.endsWith("request")) {
      if (adding ? !candidates.some(hasMember) : !assigned.some(hasMember))
        return;
      composition.confirm = { kind, id: memberId, adding };
      render();
      return;
    }
    if (
      !confirmation ||
      confirmation.kind !== kind ||
      confirmation.id !== memberId ||
      confirmation.adding !== adding ||
      (adding ? !candidates.some(hasMember) : !assigned.some(hasMember)) ||
      state.offline
    )
      return;
    state.busy = `client-role-composite-${adding ? "add" : "remove"}:${clientId}:${roleId}:${kind}:${memberId}`;
    state.error = null;
    state.notice = null;
    render();
    let changed = false;
    let timedOut = false;
    try {
      const suffix =
        kind === "realm"
          ? `realm-composites/${encodeURIComponent(memberId)}`
          : `composites/${encodeURIComponent(memberId)}`;
      const detail = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}/${suffix}?page=0&size=20&sort=username,asc`,
        { method: adding ? "POST" : "DELETE" },
      );
      composition.realmRoles = Array.isArray(detail?.compositeRealmRoles)
        ? detail.compositeRealmRoles
        : composition.realmRoles;
      composition.clientRoles = Array.isArray(detail?.compositeRoles)
        ? detail.compositeRoles
        : composition.clientRoles;
      composition.confirm = null;
      changed = true;
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
      timedOut = state.error?.kind === "timeout";
    }
    if (changed || timedOut) {
      try {
        await api.auth.clearAllSessions();
      } catch {
        /* backend invalidated all users; remove renderer session state regardless */
      }
      state.session = null;
      state.profile = null;
      state.data = {};
      state.route = "dashboard";
      state.error = timedOut
        ? { kind: "timeout", message: text("apiTimeout") }
        : null;
      state.notice = changed
        ? text("adminClientRoleCompositeSessionEnded")
        : null;
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-role-assignments-toggle") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const key = `${clientId}:${roleId}`;
    const current = state.data.clientRoleAssignments?.[key];
    if (current?.open) {
      current.open = false;
      render();
      return;
    }
    await loadClientRoleAssignmentDetail(
      clientId,
      roleId,
      `client-role-assignment-load:${clientId}:${roleId}`,
      current ?? {},
    );
    return;
  }
  if (action === "admin-client-role-assignments-close") {
    if (state.busy) return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const assignment =
      state.data.clientRoleAssignments?.[`${clientId}:${roleId}`];
    if (assignment) assignment.open = false;
    render();
    return;
  }
  if (action === "admin-client-role-assignment-search") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const kind = element.dataset.memberKind;
    const key = `${clientId}:${roleId}`;
    const assignment = state.data.clientRoleAssignments?.[key];
    const query = String(
      element
        .closest("[data-client-role-assignments]")
        ?.querySelector(`input[name="${kind}-q"]`)?.value ?? "",
    ).trim();
    if (
      !assignment?.open ||
      !["user", "group"].includes(kind) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId))
    )
      return;
    const searchErrorKey =
      kind === "user" ? "userSearchError" : "groupSearchError";
    if (query.length < 2 || query.length > 100) {
      assignment[searchErrorKey] =
        query.length < 2
          ? "adminClientRoleSearchMinimum"
          : "adminClientRoleSearchMaximum";
      render();
      return;
    }
    assignment[searchErrorKey] = null;
    const candidateKey = kind === "user" ? "userCandidates" : "groupCandidates";
    const queryKey = kind === "user" ? "userQuery" : "groupQuery";
    assignment[candidateKey] = [];
    assignment[queryKey] = query;
    state.busy = `client-role-assignment-search:${clientId}:${roleId}:${kind}`;
    state.error = null;
    render();
    try {
      const endpoint = kind === "user" ? "available-users" : "available-groups";
      const sort = kind === "user" ? "username,asc" : "name,asc";
      const page = await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}/${endpoint}?q=${encodeURIComponent(query)}&page=0&size=10&sort=${sort}`,
      );
      assignment[candidateKey] = Array.isArray(page?.content)
        ? page.content
        : [];
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-client-role-assignment-add" ||
    action === "admin-client-role-assignment-remove-request" ||
    action === "admin-client-role-assignment-remove-confirm" ||
    action === "admin-client-role-assignment-remove-cancel"
  ) {
    if (state.busy || state.data.adminAccess?.manageClients !== true) return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const memberId = element.dataset.memberId ?? "";
    const kind = element.dataset.memberKind;
    const key = `${clientId}:${roleId}`;
    const assignment = state.data.clientRoleAssignments?.[key];
    if (
      !assignment?.open ||
      !["user", "group"].includes(kind) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId)) ||
      !/^[1-9]\d{0,18}$/.test(memberId) ||
      !Number.isSafeInteger(Number(memberId))
    )
      return;
    const memberKey = kind === "user" ? "users" : "groups";
    const candidateKey = kind === "user" ? "userCandidates" : "groupCandidates";
    const assigned = assignment[memberKey] ?? [];
    const removeConfirm = assignment.removeConfirm;
    if (action === "admin-client-role-assignment-remove-cancel") {
      if (removeConfirm?.kind === kind && removeConfirm.id === memberId) {
        assignment.removeConfirm = null;
        render();
      }
      return;
    }
    if (state.offline) return;
    if (action === "admin-client-role-assignment-remove-request") {
      if (!assigned.some((member) => String(member.id) === memberId)) return;
      assignment.removeConfirm = { kind, id: memberId };
      render();
      return;
    }
    const adding = action === "admin-client-role-assignment-add";
    if (adding) {
      if (
        !assignment[candidateKey]?.some(
          (candidate) => String(candidate.id) === memberId,
        )
      )
        return;
    } else if (
      removeConfirm?.kind !== kind ||
      removeConfirm.id !== memberId ||
      !assigned.some((member) => String(member.id) === memberId)
    ) {
      return;
    }
    const assignmentPath =
      kind === "user"
        ? `/users${chooseLazy(
            adding,
            () => "",
            () => "/" + encodeURIComponent(memberId) + "",
          )}`
        : `/groups/${encodeURIComponent(memberId)}`;
    const path = `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}${assignmentPath}?page=0&size=20&sort=username,asc`;
    const busyKey = `client-role-assignment-${adding ? "add" : "remove"}:${clientId}:${roleId}:${kind}:${memberId}`;
    state.busy = busyKey;
    state.error = null;
    state.notice = null;
    render();
    try {
      const detail = await request(path, {
        method: adding ? "POST" : "DELETE",
        ...(adding && kind === "user"
          ? { body: { userId: Number(memberId) } }
          : {}),
      });
      assignment.users = Array.isArray(detail?.users?.content)
        ? detail.users.content
        : assignment.users;
      assignment.groups = Array.isArray(detail?.groups?.content)
        ? detail.groups.content
        : assignment.groups;
      assignment[candidateKey] = (assignment[candidateKey] ?? []).filter(
        (candidate) => String(candidate.id) !== memberId,
      );
      assignment.removeConfirm = null;
      state.notice = text(
        kind === "user"
          ? chooseLazy(
              adding,
              () => "adminClientRoleUserAssigned",
              () => "adminClientRoleUserRemoved",
            )
          : chooseLazy(
              adding,
              () => "adminClientRoleGroupAssigned",
              () => "adminClientRoleGroupRemoved",
            ),
      );
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-roles-toggle") {
    const clientId = element.dataset.id ?? "";
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !state.data.clients?.content?.some((client) => client.id === clientId) ||
      clientId === "admin-console"
    )
      return;
    state.data.clientRoles ??= {};
    const panel = (state.data.clientRoles[clientId] ??= { open: false });
    if (panel.open) {
      panel.open = false;
      render();
      return;
    }
    await loadClientRoles(
      clientId,
      0,
      panel.query ?? "",
      `client-roles-load:${clientId}`,
    );
    return;
  }
  if (
    action === "admin-client-role-edit" ||
    action === "admin-client-role-edit-cancel" ||
    action === "admin-client-role-delete-request" ||
    action === "admin-client-role-delete-cancel" ||
    action === "admin-client-role-delete-confirm"
  ) {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const clientId = element.dataset.id ?? "";
    const roleId = element.dataset.clientRoleId ?? "";
    const panel = state.data.clientRoles?.[clientId];
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(clientId) ||
      !/^[1-9]\d{0,18}$/.test(roleId) ||
      !Number.isSafeInteger(Number(roleId)) ||
      !panel?.open ||
      !panel.page?.content?.some((role) => String(role.id) === roleId)
    )
      return;
    if (action === "admin-client-role-edit") {
      const role = panel.page.content.find(
        (item) => String(item.id) === roleId,
      );
      panel.editingId = roleId;
      panel.drafts ??= {};
      panel.drafts[roleId] = {
        name: role.name ?? "",
        description: role.description ?? "",
      };
      panel.errorRoleId = null;
      state.error = null;
      render();
      return;
    }
    if (action === "admin-client-role-edit-cancel") {
      panel.editingId = null;
      delete panel.drafts?.[roleId];
      panel.errorRoleId = null;
      state.error = null;
      render();
      return;
    }
    if (action === "admin-client-role-delete-request") {
      panel.deleteConfirmId = roleId;
      render();
      return;
    }
    if (action === "admin-client-role-delete-cancel") {
      panel.deleteConfirmId = null;
      render();
      return;
    }
    if (panel.deleteConfirmId !== roleId) return;
    state.busy = `client-role-delete:${clientId}:${roleId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      await request(
        `/api/admin/clients/${encodeURIComponent(clientId)}/roles/${encodeURIComponent(roleId)}`,
        { method: "DELETE" },
      );
      panel.page = {
        ...panel.page,
        content: panel.page.content.filter(
          (role) => String(role.id) !== roleId,
        ),
      };
      panel.deleteConfirmId = null;
      state.notice = text("adminClientRoleDeleted");
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (
    action === "admin-role-composite-add" ||
    action === "admin-role-composite-remove-request" ||
    action === "admin-role-composite-remove-confirm"
  ) {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageRoles !== true
    )
      return;
    const roleName = element.dataset.id ?? "";
    const childName = element.dataset.child ?? "";
    const composition = state.data.adminRoleCompositions?.[roleName];
    if (
      !/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName) ||
      !/^ROLE_[A-Z0-9_]{1,45}$/.test(childName) ||
      !composition?.open
    )
      return;
    if (action === "admin-role-composite-remove-request") {
      if (!composition.compositeRoles?.includes(childName)) return;
      composition.removeConfirmName = childName;
      render();
      return;
    }
    if (action === "admin-role-composite-remove-confirm") {
      if (composition.removeConfirmName !== childName) return;
    } else if (
      !composition.candidates?.some((role) => role.name === childName)
    ) {
      return;
    }
    const adding = action === "admin-role-composite-add";
    state.busy = `role-composite-${adding ? "add" : "remove"}:${roleName}:${childName}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const detail = await request(
        `/api/admin/roles/${encodeURIComponent(roleName)}/composites/${encodeURIComponent(childName)}?page=0&size=20&sort=username,asc`,
        { method: adding ? "POST" : "DELETE" },
      );
      composition.compositeRoles = Array.isArray(detail?.compositeRoles)
        ? detail.compositeRoles
        : (composition.compositeRoles ?? []);
      composition.candidates = (composition.candidates ?? []).filter(
        (role) => role.name !== childName,
      );
      composition.removeConfirmName = null;
      if (state.data.roleDetail && Number.isSafeInteger(detail.userCount))
        state.data.roleDetail.userCount = detail.userCount;
      state.data.roleCandidates = {};
      state.notice = text(
        adding ? "adminRoleCompositeAdded" : "adminRoleCompositeRemoved",
      );
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-role-composite-remove-cancel") {
    if (state.busy) return;
    const roleName = element.dataset.id ?? "";
    if (!/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName)) return;
    const composition = state.data.adminRoleCompositions?.[roleName];
    if (composition) composition.removeConfirmName = null;
    render();
    return;
  }
  if (
    action === "admin-role-client-composite-add" ||
    action === "admin-role-client-composite-remove-request" ||
    action === "admin-role-client-composite-remove-confirm"
  ) {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageRoles !== true
    )
      return;
    const roleName = element.dataset.id ?? "";
    const childRoleId = element.dataset.clientRoleId ?? "";
    const composition = state.data.adminRoleCompositions?.[roleName];
    if (
      !/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName) ||
      !/^[1-9]\d{0,18}$/.test(childRoleId) ||
      !Number.isSafeInteger(Number(childRoleId)) ||
      !composition?.open
    )
      return;
    if (action === "admin-role-client-composite-remove-request") {
      if (
        !composition.compositeClientRoles?.some(
          (role) => String(role?.id) === childRoleId,
        )
      )
        return;
      composition.removeClientConfirmId = childRoleId;
      render();
      return;
    }
    if (action === "admin-role-client-composite-remove-confirm") {
      if (composition.removeClientConfirmId !== childRoleId) return;
    } else if (
      !composition.clientCandidates?.some(
        (role) => String(role?.id) === childRoleId,
      )
    ) {
      return;
    }
    const adding = action === "admin-role-client-composite-add";
    state.busy = `role-client-composite-${adding ? "add" : "remove"}:${roleName}:${childRoleId}`;
    state.error = null;
    state.notice = null;
    render();
    try {
      const detail = await request(
        `/api/admin/roles/${encodeURIComponent(roleName)}/client-composites/${encodeURIComponent(childRoleId)}?page=0&size=20&sort=username,asc`,
        { method: adding ? "POST" : "DELETE" },
      );
      composition.compositeClientRoles = Array.isArray(
        detail?.compositeClientRoles,
      )
        ? detail.compositeClientRoles
        : (composition.compositeClientRoles ?? []);
      composition.clientCandidates = (
        composition.clientCandidates ?? []
      ).filter((candidate) => String(candidate.id) !== childRoleId);
      composition.removeClientConfirmId = null;
      if (state.data.roleDetail && Number.isSafeInteger(detail.userCount))
        state.data.roleDetail.userCount = detail.userCount;
      state.data.roleCandidates = {};
      state.notice = text(
        adding
          ? "adminRoleCompositeClientAdded"
          : "adminRoleCompositeClientRemoved",
      );
    } catch {
      /* request rendered localized authorization, validation or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-role-client-composite-remove-cancel") {
    if (state.busy) return;
    const roleName = element.dataset.id ?? "";
    if (!/^ROLE_[A-Z0-9_]{1,45}$/.test(roleName)) return;
    const composition = state.data.adminRoleCompositions?.[roleName];
    if (composition) composition.removeClientConfirmId = null;
    render();
    return;
  }
  if (action === "admin-client-scope-role-mappings-toggle") {
    if (state.busy || state.offline) return;
    const scopeId = element.dataset.id;
    const scope = clientScopeById(scopeId);
    if (
      typeof scopeId !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(scopeId) ||
      !scope
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
        clientRoleQuery: "",
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
    const scope = clientScopeById(scopeId);
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
        [
          ...panel.querySelectorAll(
            'select[name="applicationRoles"] option:checked',
          ),
        ]
          .map((option) => option.value.trim())
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const clientRoleIds = [
      ...new Set(
        [
          ...panel.querySelectorAll(
            'select[name="clientRoleIds"] option:checked',
          ),
        ]
          .map((option) => Number(option.value))
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
    const scope = clientScopeById(scopeId);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(scopeId ?? "") || !scope) return;
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
    const client = nativeClientRows().some(
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
      !nativeClientRows().some((item) => String(item.id) === clientId) ||
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
      !nativeClientRows().some((item) => String(item.id) === clientId) ||
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
      !nativeClientRows().some((item) => String(item.id) === clientId) ||
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
      syncNativeClientMapperPage(clientId, -1);
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
    const scope = clientScopeById(scopeId);
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
    const scope = clientScopeById(scopeId);
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
    const scope = clientScopeById(scopeId);
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
  if (action === "admin-event-filter-toggle") {
    if (state.busy) return;
    state.data.adminEventShowFilters = !state.data.adminEventShowFilters;
    render();
    return;
  }
  if (action === "admin-event-detail-close") {
    state.data.adminEventSelected = null;
    render();
    return;
  }
  if (action === "admin-event-clear-filters") {
    if (state.busy || state.offline) return;
    state.data.adminEventQuery = "";
    state.data.adminEventAction = "";
    state.data.adminEventTargetType = "";
    state.data.adminEventTargetId = "";
    state.data.adminEventFrom = "";
    state.data.adminEventTo = "";
    state.data.adminEventPage = 0;
    state.busy = "admin-events-search";
    render();
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
    return;
  }
  if (action === "admin-event-clear-request") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageEvents !== true
    )
      return;
    state.data.adminEventClearConfirm = true;
    state.data.adminEventClearError = false;
    render();
    return;
  }
  if (action === "admin-event-clear-cancel") {
    if (state.busy) return;
    state.data.adminEventClearConfirm = false;
    render();
    return;
  }
  if (action === "admin-event-clear-confirm") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageEvents !== true
    )
      return;
    state.busy = "admin-events-clear";
    state.data.adminEventClearError = false;
    state.data.adminEventClearSuccess = false;
    render();
    try {
      await request("/api/admin/events", { method: "DELETE" });
      state.data.adminEventClearConfirm = false;
      state.data.adminEventSelected = null;
      state.data.adminEventPage = 0;
      await loadRoute({ keepContent: true });
      state.data.adminEventClearSuccess = true;
    } catch {
      state.data.adminEventClearError = true;
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-key-clear-filters") {
    if (state.busy || state.offline) return;
    state.data.adminKeyQuery = "";
    state.data.adminKeyActive = "";
    state.data.adminKeyPage = 0;
    state.busy = "admin-keys-search";
    render();
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
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
      const rotatedKey = await request("/api/admin/keys/rotate", {
        method: "POST",
      });
      await loadRoute({ keepContent: true });
      state.data.adminKeyRotateConfirm = false;
      state.data.adminKeyRotatedResult =
        rotatedKey && typeof rotatedKey.kid === "string"
          ? { kid: rotatedKey.kid }
          : null;
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
  if (action === "admin-key-rotated-close") {
    state.data.adminKeyRotatedResult = null;
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
  if (action === "admin-user-select-all") {
    if (state.busy || state.offline) return;
    const pageIds = (state.data.users?.content ?? []).map((user) =>
      Number(user.id),
    );
    const selected = new Set(
      (state.data.adminSelectedUserIds ?? []).map(Number),
    );
    if (element.checked) pageIds.forEach((id) => selected.add(id));
    else pageIds.forEach((id) => selected.delete(id));
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
    const fileInput = document.querySelector(
      `[data-admin-avatar-file="${id}"]`,
    );
    const file = fileInput?.files?.[0];
    if (!file && fileInput?.dataset.adminAvatarAuto === "true") {
      fileInput.click();
      return;
    }
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
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
    const user = adminUserById(id);
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
    const user = (state.data.users?.content ?? []).some(
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
    const user = adminUserById(id);
    if (!Number.isSafeInteger(id) || id < 1 || !user) return;
    if (
      action === "admin-user-passkeys-close" ||
      Number(state.data.userPasskeysOpenId) === id
    ) {
      state.data.userPasskeysOpenId = null;
      if (state.route === "user-detail")
        state.data.adminUserPasskeys[id] = null;
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
    const user = users.some((candidate) => Number(candidate.id) === id);
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
    action === "admin-role-delete-request" ||
    action === "admin-role-delete-confirm"
  ) {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageRoles !== true
    )
      return;
    const name = element.dataset.id;
    if (["ROLE_ADMIN", "ROLE_USER"].includes(name)) return;
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
      if (roles.length === 1 && (state.data.rolePage ?? 0) > 0)
        state.data.rolePage -= 1;
      await roleScreens.load();
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
    if (
      state.route === "identity-provider-detail" &&
      state.data.identityProviderDetailTab === "mappers"
    )
      await loadRoute({ keepContent: true });
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
    const provider = (state.data.identityProviders?.content ?? []).some(
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
  if (action === "admin-oidc-provider-create") {
    if (state.busy || state.offline || !adminRouteAllowed("identity-providers"))
      return;
    state.data.identityProviderConfigurationOpenId = "new";
    state.data.identityProviderConfigurationBaselines ??= {};
    state.data.identityProviderConfigurationDrafts ??= {};
    state.data.identityProviderConfigurationBaselines.new =
      defaultIdentityProviderConfiguration();
    state.data.identityProviderConfigurationDrafts.new =
      identityProviderConfigurationDraft(
        state.data.identityProviderConfigurationBaselines.new,
      );
    state.data.identityProviderConfigurationErrorId = null;
    state.error = null;
    render();
    return;
  }
  if (action === "admin-saml-provider-create") {
    if (state.busy || state.offline || !adminRouteAllowed("identity-providers"))
      return;
    const baseline = {
      ...defaultIdentityProviderConfiguration(),
      providerType: "saml",
    };
    state.data.identityProviderConfigurationOpenId = "new-saml";
    state.data.identityProviderConfigurationBaselines ??= {};
    state.data.identityProviderConfigurationDrafts ??= {};
    state.data.identityProviderConfigurationBaselines["new-saml"] = baseline;
    state.data.identityProviderConfigurationDrafts["new-saml"] =
      identityProviderConfigurationDraft(baseline);
    state.data.identityProviderConfigurationErrorId = null;
    state.error = null;
    render();
    return;
  }
  if (
    action === "admin-identity-provider-config-edit" ||
    action === "admin-saml-provider-config-edit"
  ) {
    if (state.busy || state.offline || !adminRouteAllowed("identity-providers"))
      return;
    const id = element.dataset.id ?? "";
    const provider = (state.data.identityProviders?.content ?? []).find(
      (item) => item.id === id,
    );
    const expectedProviderType =
      action === "admin-saml-provider-config-edit" ? "saml" : "oidc";
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !provider ||
      provider.providerType !== expectedProviderType
    )
      return;
    if (state.data.identityProviderConfigurationOpenId === id) {
      state.data.identityProviderConfigurationOpenId = null;
      delete state.data.identityProviderConfigurationDrafts?.[id];
      delete state.data.identityProviderConfigurationBaselines?.[id];
      state.data.identityProviderConfigurationErrorId = null;
      render();
      return;
    }
    state.busy = `identity-provider-config-load:${id}`;
    state.error = null;
    render();
    try {
      const response = await request(
        `/api/admin/identity-providers/${encodeURIComponent(id)}`,
      );
      if (
        response?.id !== id ||
        response.providerType !== expectedProviderType ||
        typeof response.registrationId !== "string" ||
        (expectedProviderType === "oidc" &&
          typeof response.clientId !== "string")
      )
        throw new Error("invalid_identity_provider_connection_response");
      const baseline = safeIdentityProviderConfiguration(response);
      state.data.identityProviderConfigurationBaselines ??= {};
      state.data.identityProviderConfigurationDrafts ??= {};
      state.data.identityProviderConfigurationBaselines[id] = baseline;
      state.data.identityProviderConfigurationDrafts[id] =
        identityProviderConfigurationDraft(baseline);
      state.data.identityProviderConfigurationOpenId = id;
      state.data.identityProviderConfigurationErrorId = null;
    } catch {
      /* The API adapter supplies localized authorization and transport feedback. */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-identity-provider-config-cancel") {
    if (state.busy) return;
    const key = element.dataset.providerId || "new";
    if (state.data.identityProviderConfigurationOpenId !== key) return;
    state.data.identityProviderConfigurationOpenId = null;
    delete state.data.identityProviderConfigurationDrafts?.[key];
    delete state.data.identityProviderConfigurationBaselines?.[key];
    state.data.identityProviderConfigurationErrorId = null;
    state.error = null;
    if (
      ["identity-provider-create", "identity-provider-detail"].includes(
        state.route,
      )
    ) {
      state.route = "identity-providers";
      window.history.pushState(null, "", "#/admin/identity-providers");
      await loadRoute();
      return;
    }
    render();
    return;
  }
  if (
    action === "admin-client-delete-request" ||
    action === "admin-client-delete-confirm"
  ) {
    if (state.busy || state.offline || !state.data.adminAccess?.manageClients)
      return;
    const id = element.dataset.id;
    const clients =
      state.data.clientConfiguration && state.route === "client-detail"
        ? [state.data.clientConfiguration]
        : nativeClientRows();
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
      state.route = "clients";
      state.data.clientConfiguration = null;
      window.history.replaceState(null, "", "#/admin/clients");
      await loadRoute({ keepContent: true });
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
    const client = nativeClientRows().some((item) => item.id === id);
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
  if (action === "admin-client-configuration-edit") {
    if (state.busy || state.offline || !adminRouteAllowed("clients")) return;
    const id = element.dataset.id ?? "";
    const client = nativeClientRows().find((entry) => entry.id === id);
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      !client ||
      client.clientId === "admin-console" ||
      !state.data.adminAccess?.manageClients
    )
      return;
    if (state.data.clientConfigurationEditId === id) {
      state.data.clientConfigurationEditId = null;
      state.data.clientConfiguration = null;
      delete state.data.clientConfigurationDrafts?.[id];
      state.data.clientConfigurationErrorId = null;
      state.error = null;
      render();
      return;
    }
    state.busy = `client-configuration-load:${id}`;
    state.error = null;
    render();
    try {
      const configuration = await request(
        `/api/admin/clients/${encodeURIComponent(id)}`,
      );
      if (
        configuration?.id !== id ||
        typeof configuration.clientId !== "string" ||
        !Array.isArray(configuration.clientAuthenticationMethods) ||
        !Array.isArray(configuration.authorizationGrantTypes)
      )
        throw new Error("invalid_client_configuration_response");
      const {
        serviceAccountUsername: _serviceAccountUsername,
        ...safeConfiguration
      } = configuration;
      void _serviceAccountUsername;
      state.data.clientConfiguration = safeConfiguration;
      state.data.clientConfigurationEditId = id;
      state.data.clientConfigurationDrafts ??= {};
      state.data.clientConfigurationDrafts[id] =
        clientConfigurationDraft(safeConfiguration);
      state.data.clientConfigurationErrorId = null;
    } catch {
      /* request rendered localized authorization, timeout, or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-client-configuration-cancel") {
    if (state.busy) return;
    const id = element.dataset.id ?? "";
    if (state.data.clientConfigurationEditId !== id) return;
    state.data.clientConfigurationDrafts[id] = clientConfigurationDraft(
      state.data.clientConfiguration,
    );
    state.data.clientConfigurationErrorId = null;
    state.error = null;
    render({ preserveDrafts: false });
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
    const client = nativeClientRows().some((item) => item.id === id);
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
    state.data.clientScopeAssignmentsOpenId =
      state.route === "client-detail" ? id : null;
    state.data.clientScopeAssignmentErrorId = null;
    state.error = null;
    render({ preserveDrafts: false });
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
        totalElements: Math.max(
          0,
          Number(
            state.data.identityProviders?.totalElements ?? providers.length,
          ) - 1,
        ),
      };
      state.data.identityProviderDeleteConfirmId = null;
      if (
        state.data.identityProviders.content.length === 0 &&
        (state.data.identityProviderPage ?? 0) > 0
      )
        state.data.identityProviderPage -= 1;
      await loadRoute({ keepContent: true });
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
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    const id = element.dataset.id;
    const scopes = state.data.clientScopes?.content ?? [];
    const scope = clientScopeById(id);
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
      if (state.route === "client-scope-detail") {
        state.route = "client-scopes";
        window.history.pushState(null, "", "#/admin/client-scopes");
      }
      await loadRoute({ keepContent: true });
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
  if (action === "admin-session-detail") {
    if (state.busy || state.offline) return;
    const id = element.dataset.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) return;
    state.busy = `admin-session-detail:${id}`;
    state.error = null;
    render();
    try {
      state.data.adminSessionDetail = await request(
        `/api/admin/sessions/${encodeURIComponent(id)}`,
      );
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-session-detail-close") {
    if (state.busy) return;
    state.data.adminSessionDetail = null;
    render();
    return;
  }
  if (
    action === "admin-session-revoke-all-request" ||
    action === "admin-session-revoke-all-confirm"
  ) {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageSessions !== true
    )
      return;
    if (action === "admin-session-revoke-all-request") {
      state.data.adminSessionRevokeAllConfirm = true;
      state.error = null;
      render();
      return;
    }
    if (!state.data.adminSessionRevokeAllConfirm) return;
    state.busy = "admin-session-revoke-all";
    state.error = null;
    state.notice = null;
    render();
    try {
      await request("/api/admin/sessions/revoke-all", { method: "POST" });
      await api.auth.clearSession("admin");
      state.session = null;
      state.profile = null;
      state.data = {};
      state.route = "dashboard";
      state.notice = null;
    } catch {
      /* request rendered localized authorization or transport feedback */
    }
    state.busy = null;
    render();
    return;
  }
  if (action === "admin-session-revoke-all-cancel") {
    if (state.busy) return;
    state.data.adminSessionRevokeAllConfirm = false;
    render();
    return;
  }
  if (action === "admin-session-delete-cancel") {
    if (state.busy) return;
    state.data.adminSessionDeleteConfirmId = null;
    render();
    return;
  }
  if (action === "admin-consent-clear-filters") {
    if (state.busy) return;
    state.data.adminConsentQuery = "";
    state.data.adminConsentClientId = "";
    state.data.adminConsentUsername = "";
    state.data.adminConsentScope = "";
    state.data.adminConsentSort = "id.principalName,asc";
    state.data.adminConsentPage = 0;
    state.busy = "admin-consents-clear";
    render();
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
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
        `/api/admin/consents/${encodeURIComponent(consent.clientId)}/${encodeURIComponent(consent.principalName)}`,
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
      "admin-return-authorized",
    ].includes(action)
  ) {
    if (action === "logout") return logout();
    if (action === "sign-in") return signIn();
    if (action === "cancel-sign-in") return cancelSignIn();
    if (action === "switch-console" || action === "switch-account") {
      state.console = state.console === "admin" ? "account" : "admin";
      state.route = state.console === "admin" ? "dashboard" : "profile";
      state.session = null;
      state.data = {};
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
    if (action === "admin-return-authorized") {
      if (state.busy) return;
      const route = firstAuthorizedAdminRoute();
      if (!route) {
        state.error = { kind: "forbidden" };
        render();
        return;
      }
      state.route = route;
      state.busy = "admin-return-authorized";
      void loadRoute({ preserveError: true }).finally(() => {
        state.busy = null;
        render();
      });
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
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageRoles !== true
    )
      return;
    state.busy = "role-create-route";
    state.route = "role-create";
    state.data.adminRoleCreateDraft = null;
    state.data.roleCreateFocused = false;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "create-client-scope") {
    if (
      state.busy ||
      state.offline ||
      state.data.adminAccess?.manageClients !== true
    )
      return;
    state.busy = "client-scope-create-route";
    state.route = "client-scope-create";
    window.history.pushState(null, "", "#/admin/client-scopes/create");
    state.data.adminClientScopeCreateDraft = null;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    document
      .querySelector('[data-form="admin-client-scope-create"] input')
      ?.focus();
    return;
  }
  if (action === "create-client") {
    if (state.busy || state.offline || !adminRouteAllowed("client-create"))
      return;
    state.busy = "client-create-route";
    state.route = "client-create";
    state.data.adminClientCreateDraft = null;
    state.data.adminClientCreateError = false;
    state.data.clientCreateSecret = null;
    state.error = null;
    state.notice = null;
    await loadRoute();
    state.busy = null;
    render();
    return;
  }
  if (action === "client-create-cancel") {
    if (state.busy) return;
    state.route = "clients";
    state.data.adminClientCreateDraft = null;
    state.data.adminClientCreateError = false;
    state.error = null;
    state.notice = null;
    render();
    return;
  }
  if (action === "client-create-secret-dismiss") {
    if (state.busy) return;
    state.data.clientCreateSecret = null;
    state.route = "clients";
    state.notice = null;
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
      state.busy = null;
      render();
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
      state.busy = null;
      render();
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
      state.busy = null;
      render();
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
  document.querySelectorAll(".scope-menu").forEach((menu) => {
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    });
    menu.addEventListener("toggle", () => {
      if (menu.open)
        document.querySelectorAll(".scope-menu[open]").forEach((other) => {
          if (other !== menu) other.open = false;
        });
    });
  });
  bindNativeClients();
  groupScreens.bind(document);
  organizationScreens.bind(document);
  roleScreens.bind(document);
  document
    .querySelector(
      '[data-form="admin-user-detail-password"] input[name="password"]',
    )
    ?.addEventListener("input", (event) => {
      delete state.data.adminUserDetailPasswordError;
      event.currentTarget.setAttribute("aria-invalid", "false");
      const feedback = event.currentTarget
        .closest(".field")
        ?.querySelector(".field-error");
      if (feedback) feedback.textContent = "";
    });
  document
    .querySelectorAll('[data-admin-avatar-auto="true"]')
    .forEach((input) =>
      input.addEventListener("change", () => {
        if (input.files?.length)
          document
            .querySelector(
              `[data-action="admin-user-avatar-upload"][data-id="${input.dataset.adminAvatarFile}"]`,
            )
            ?.click();
      }),
    );
  document
    .getElementById("admin-user-detail-group-search")
    ?.addEventListener("input", (event) => {
      const query = event.currentTarget.value;
      state.data.adminUserDetailGroupQuery = query;
      const memberIds = new Set(
        (state.data.adminUserDetailGroups?.content ?? []).map((group) =>
          Number(group.id),
        ),
      );
      const options = (state.data.adminUserDetailGroupOptions ?? []).filter(
        (group) => !memberIds.has(Number(group.id)),
      );
      const selected = options.find(
        (group) => (group.path ?? group.name) === query,
      );
      state.data.adminUserDetailGroupSelection = selected
        ? String(selected.id)
        : "";
      const addButton = document.querySelector(
        '[data-action="admin-user-detail-add-group"]',
      );
      if (addButton)
        addButton.disabled = !selected || state.offline || Boolean(state.busy);
      clearTimeout(adminGroupSearchTimer);
      if (!selected && query.trim()) {
        adminGroupSearchTimer = setTimeout(async () => {
          try {
            const params = new URLSearchParams({
              q: query.trim(),
              page: "0",
              size: "10",
              sort: "name,asc",
            });
            const results = await request(
              `/api/admin/groups?${params.toString()}`,
            );
            if (
              state.route !== "user-detail" ||
              state.data.adminUserDetailTab !== "groups" ||
              state.data.adminUserDetailGroupQuery !== query
            )
              return;
            state.data.adminUserDetailGroupOptions = Array.isArray(
              results?.content,
            )
              ? results.content
              : [];
            const list = document.getElementById(
              "admin-user-detail-group-options",
            );
            if (list)
              list.innerHTML = state.data.adminUserDetailGroupOptions
                .filter((group) => !memberIds.has(Number(group.id)))
                .map(
                  (group) =>
                    `<option value="${escapeHtml(group.path ?? group.name)}"></option>`,
                )
                .join("");
          } catch {
            /* The existing memberships remain usable when suggestions cannot load. */
          }
        }, 250);
      }
    });
  document.querySelectorAll("[data-route]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const destination = element.dataset.route;
      if (state.route !== destination) {
        state.data.clientCreateSecret = null;
        state.data.clientRegeneratedSecret = null;
      }
      state.route = destination;
      if (destination === "client-scopes")
        window.history.pushState(null, "", "#/admin/client-scopes");
      else if (window.location.hash.startsWith("#/admin/client-scopes"))
        window.history.pushState(null, "", `#/${state.console}/${destination}`);
      if (destination === "identity-providers")
        window.history.pushState(null, "", "#/admin/identity-providers");
      else if (window.location.hash.startsWith("#/admin/identity-providers"))
        window.history.pushState(null, "", `#/${state.console}/${destination}`);
      if (destination === "groups") groupScreens.syncUrl();
      else if (window.location.hash.startsWith("#/admin/groups"))
        window.history.pushState(null, "", `#/${state.console}/${destination}`);
      if (destination === "organizations") organizationScreens.syncUrl();
      else if (window.location.hash.startsWith("#/admin/organizations"))
        window.history.pushState(null, "", `#/${state.console}/${destination}`);
      state.notice = null;
      state.busy = `route:${state.route}`;
      void loadRoute().finally(() => {
        if (
          state.route !== destination ||
          state.busy !== `route:${destination}`
        )
          return;
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-user-query")
    ?.addEventListener("input", (event) => {
      state.data.userSearchDraft = event.currentTarget.value;
      clearTimeout(adminUserSearchTimer);
      if (!event.isComposing) scheduleUserSearch();
    });
  document
    .getElementById("admin-user-query")
    ?.addEventListener("compositionend", (event) => {
      state.data.userSearchDraft = event.currentTarget.value;
      scheduleUserSearch();
    });
  document
    .getElementById("admin-user-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.data.userSearchDraft = String(
        formString(new FormData(event.currentTarget).get("q"), ""),
      );
      clearTimeout(adminUserSearchTimer);
      void searchUsers();
    });
  document
    .getElementById("admin-user-page-size")
    ?.addEventListener("change", (event) => {
      const size = Number(event.currentTarget.value);
      if (state.busy || state.offline || ![10, 20, 50, 100].includes(size))
        return;
      state.data.userPageSize = size;
      state.data.userPage = 0;
      state.data.adminSelectedUserIds = [];
      state.data.adminUserBulkConfirmAction = null;
      state.busy = "users-page-size";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .getElementById("admin-user-sort")
    ?.addEventListener("change", (event) => {
      if (state.busy) return;
      state.data.userSort = event.currentTarget.value;
      state.data.userPage = 0;
      state.data.adminSelectedUserIds = [];
      state.busy = "users-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .getElementById("admin-user-status")
    ?.addEventListener("change", (event) => {
      if (state.busy) return;
      state.data.userStatus = event.currentTarget.value;
      state.data.userPage = 0;
      state.data.adminSelectedUserIds = [];
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
    .getElementById("admin-client-scope-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      state.data.clientScopeQuery = String(
        formString(new FormData(event.currentTarget).get("q"), ""),
      ).trim();
      state.data.clientScopeSort = String(
        new FormData(event.currentTarget).get("sort") ?? "name,asc",
      );
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
        const candidatesKey =
          kind === "applicationRoles"
            ? "applicationRoleCandidates"
            : "clientRoleCandidates";
        const currentPage = mapping?.[candidatesKey];
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
      clearTimeout(adminClientSearchTimer);
      state.data.clientQuery = String(
        formString(new FormData(event.currentTarget).get("q"), ""),
      ).trim();
      state.data.clientSearchDraft = state.data.clientQuery;
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
  document.querySelectorAll("[data-client-role-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const clientId = element.dataset.clientRolePage ?? "";
      const nextPage = Number(element.dataset.page);
      const panel = state.data.clientRoles?.[clientId];
      if (!panel?.open || !Number.isSafeInteger(nextPage) || nextPage < 0)
        return;
      void loadClientRoles(
        clientId,
        nextPage,
        panel.query ?? "",
        `client-role-page:${clientId}`,
      );
    }),
  );
  document
    .getElementById("admin-identity-provider-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      clearTimeout(identityProviderSearchTimer);
      const values = new FormData(event.currentTarget);
      reloadIdentityProviderList(values.get("q"), values.get("sort"));
    });
  document
    .getElementById("admin-identity-provider-query")
    ?.addEventListener("input", (event) => {
      clearTimeout(identityProviderSearchTimer);
      const query = event.currentTarget.value;
      identityProviderSearchTimer = setTimeout(() => {
        if (query.trim() === (state.data.identityProviderQuery ?? "")) return;
        reloadIdentityProviderList(
          query,
          state.data.identityProviderSort,
          true,
        );
      }, 300);
    });
  document
    .getElementById("admin-identity-provider-sort")
    ?.addEventListener("change", (event) => {
      clearTimeout(identityProviderSearchTimer);
      reloadIdentityProviderList(
        document.getElementById("admin-identity-provider-query")?.value,
        event.currentTarget.value,
      );
    });
  document
    .getElementById("admin-identity-provider-size")
    ?.addEventListener("change", (event) => {
      const size = Number(event.currentTarget.value);
      if (state.busy || ![10, 20, 50, 100].includes(size)) return;
      state.data.identityProviderSize = size;
      state.data.identityProviderPage = 0;
      state.busy = "identity-providers-page-size";
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
        const activePage = Number(state.data.identityProviders?.number ?? 0);
        const lastPage = Math.max(
          Number(state.data.identityProviders?.totalPages ?? 1) - 1,
          0,
        );
        state.busy =
          nextPage === 0 && activePage > 0
            ? "identity-providers-page-first"
            : nextPage === lastPage && nextPage > activePage
              ? "identity-providers-page-last"
              : `identity-providers-page-${nextPage < activePage ? "prev" : "next"}`;
        void loadRoute({ keepContent: true }).finally(() => {
          state.busy = null;
          render();
        });
      }),
    );
  const mapperSearch = document.getElementById("admin-provider-mapper-search");
  const reloadProviderMappers = (query, sort) => {
    clearTimeout(identityProviderMapperSearchTimer);
    identityProviderMapperSearchTimer = null;
    if (state.busy) return;
    const nextQuery = String(query ?? "").trim();
    const nextSort = String(sort ?? "name,asc");
    if (
      nextQuery === (state.data.identityProviderMapperQuery ?? "") &&
      nextSort === (state.data.identityProviderMapperSort ?? "name,asc")
    )
      return;
    state.data.identityProviderMapperQuery = nextQuery;
    state.data.identityProviderMapperSort = nextSort;
    state.data.identityProviderMapperPage = 0;
    state.busy = "provider-mappers-search";
    render();
    void loadRoute({ keepContent: true }).finally(() => {
      state.busy = null;
      render();
    });
  };
  mapperSearch
    ?.querySelector('input[name="q"]')
    ?.addEventListener("input", (event) => {
      clearTimeout(identityProviderMapperSearchTimer);
      const query = event.currentTarget.value;
      const sort = mapperSearch.querySelector('select[name="sort"]').value;
      identityProviderMapperSearchTimer = setTimeout(
        () => reloadProviderMappers(query, sort),
        300,
      );
    });
  mapperSearch
    ?.querySelector('select[name="sort"]')
    ?.addEventListener("change", (event) => {
      const query = mapperSearch.querySelector('input[name="q"]').value;
      reloadProviderMappers(query, event.currentTarget.value);
    });
  document.querySelectorAll("[data-provider-mapper-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const page = Number(element.dataset.providerMapperPage);
      if (!Number.isSafeInteger(page) || page < 0) return;
      state.data.identityProviderMapperPage = page;
      state.busy = `provider-mappers-page-${element.dataset.providerMapperPageKind ?? "next"}`;
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document
    .getElementById("admin-provider-mapper-size")
    ?.addEventListener("change", (event) => {
      const size = Number(event.currentTarget.value);
      if (state.busy || ![10, 20, 50, 100].includes(size)) return;
      state.data.identityProviderMapperSize = size;
      state.data.identityProviderMapperPage = 0;
      state.busy = "provider-mappers-page-size";
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .querySelector("[data-provider-create-type]")
    ?.addEventListener("change", (event) => {
      void action("admin-provider-create-type", event.currentTarget);
    });
  document
    .getElementById("admin-session-search")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.busy) return;
      const values = new FormData(event.currentTarget);
      state.data.adminSessionQuery = String(
        formString(values.get("q"), ""),
      ).trim();
      state.data.adminSessionStatus = String(
        formString(values.get("status"), "active"),
      );
      state.data.adminSessionClientId = String(
        formString(values.get("clientId"), ""),
      ).trim();
      state.data.adminSessionSort = String(
        formString(values.get("sort"), "lastAccessTime,desc"),
      );
      state.data.adminSessionPage = 0;
      state.busy = "admin-sessions-search";
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  [
    "admin-session-sort",
    "admin-session-status",
    "admin-session-client",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      document.getElementById("admin-session-search")?.requestSubmit();
    });
  });
  document
    .getElementById("admin-session-size")
    ?.addEventListener("change", (event) => {
      const size = Number(event.currentTarget.value);
      if (state.busy || ![10, 20, 50, 100].includes(size)) return;
      state.data.adminSessionSize = size;
      state.data.adminSessionPage = 0;
      state.busy = "admin-sessions-page-size";
      render();
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
      const currentPage = Number(state.data.adminSessions?.number ?? 0);
      const totalPages = Number(state.data.adminSessions?.totalPages ?? 0);
      const pageKind =
        nextPage === 0
          ? "first"
          : nextPage === totalPages - 1
            ? "last"
            : nextPage < currentPage
              ? "prev"
              : "next";
      state.busy = `admin-sessions-page-${pageKind}`;
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
      const values = new FormData(event.currentTarget);
      state.data.adminConsentQuery = String(
        formString(values.get("q"), ""),
      ).trim();
      state.data.adminConsentClientId = String(
        formString(values.get("clientId"), ""),
      ).trim();
      state.data.adminConsentUsername = String(
        formString(values.get("username"), ""),
      ).trim();
      state.data.adminConsentScope = String(
        formString(values.get("scope"), ""),
      ).trim();
      state.data.adminConsentSort = String(
        formString(values.get("sort"), "id.principalName,asc"),
      );
      state.data.adminConsentPage = 0;
      state.busy = "admin-consents-search";
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .querySelectorAll(
      "#admin-consent-query, #admin-consent-client, #admin-consent-user, #admin-consent-scope, #admin-consent-sort",
    )
    .forEach((element) =>
      element.addEventListener("change", () => {
        if (state.busy || element.disabled) return;
        document.getElementById("admin-consent-search")?.requestSubmit();
      }),
    );
  document
    .getElementById("admin-consent-size")
    ?.addEventListener("change", (event) => {
      if (state.busy) return;
      const size = Number(event.currentTarget.value);
      if (![10, 20, 50, 100].includes(size)) return;
      state.data.adminConsentSize = size;
      state.data.adminConsentPage = 0;
      state.busy = "admin-consents-search";
      render();
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
      render();
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
      const values = new FormData(event.currentTarget);
      state.data.adminEventQuery = String(
        formString(values.get("q"), ""),
      ).trim();
      state.data.adminEventSort = String(
        formString(
          values.get("sort"),
          state.data.adminEventSort ?? "occurredAt,desc",
        ),
      );
      if (values.has("action"))
        state.data.adminEventAction = String(
          formString(values.get("action"), ""),
        );
      if (values.has("targetType"))
        state.data.adminEventTargetType = String(
          formString(values.get("targetType"), ""),
        );
      if (values.has("targetId"))
        state.data.adminEventTargetId = String(
          formString(values.get("targetId"), ""),
        ).trim();
      if (values.has("from"))
        state.data.adminEventFrom = String(formString(values.get("from"), ""));
      if (values.has("to"))
        state.data.adminEventTo = String(formString(values.get("to"), ""));
      state.data.adminEventPage = 0;
      state.busy = "admin-events-search";
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .getElementById("admin-event-query")
    ?.addEventListener("input", (event) => {
      state.data.adminEventSearchDraft = event.target.value;
      clearTimeout(adminEventSearchTimer);
      const search = () => {
        if (state.route !== "events" || state.offline) return;
        if (state.busy) {
          adminEventSearchTimer = setTimeout(search, 100);
          return;
        }
        if (
          (state.data.adminEventSearchDraft ?? "").trim() !==
          (state.data.adminEventQuery ?? "")
        )
          document.getElementById("admin-event-search")?.requestSubmit();
      };
      adminEventSearchTimer = setTimeout(search, 300);
    });
  document
    .querySelectorAll(
      "#admin-event-sort, #admin-event-action, #admin-event-target-type, #admin-event-target-id, #admin-event-from, #admin-event-to",
    )
    .forEach((element) =>
      element.addEventListener("change", () => {
        if (state.busy || element.disabled) return;
        document.getElementById("admin-event-search")?.requestSubmit();
      }),
    );
  document
    .getElementById("admin-event-size")
    ?.addEventListener("change", (event) => {
      if (state.busy) return;
      const size = Number(event.currentTarget.value);
      if (![10, 20, 50, 100].includes(size)) return;
      state.data.adminEventSize = size;
      state.data.adminEventPage = 0;
      state.busy = "admin-events-search";
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document.querySelectorAll(".admin-event-row").forEach((row) => {
    const open = () => {
      if (state.busy) return;
      const index = Number(row.dataset.adminEventIndex);
      const item = state.data.adminEvents?.content?.[index];
      if (!item) return;
      state.data.adminEventSelected = item;
      render();
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  document.querySelectorAll("[data-admin-event-page]").forEach((element) =>
    element.addEventListener("click", () => {
      if (state.busy || element.disabled) return;
      const nextPage = Number(element.dataset.adminEventPage);
      if (!Number.isSafeInteger(nextPage) || nextPage < 0) return;
      state.data.adminEventPage = nextPage;
      state.busy = `admin-events-page-${element.dataset.direction ?? (nextPage < Number(state.data.adminEvents?.number ?? 0) ? "prev" : "next")}`;
      render();
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
      state.data.adminKeyQuery = String(formString(values.get("q"), "")).trim();
      state.data.adminKeyActive = String(formString(values.get("active"), ""));
      state.data.adminKeySort = String(
        formString(values.get("sort"), "createdAt,desc"),
      );
      state.data.adminKeyPage = 0;
      state.busy = "admin-keys-search";
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    });
  document
    .querySelectorAll("#admin-key-query, #admin-key-sort, #admin-key-active")
    .forEach((element) =>
      element.addEventListener("change", () => {
        if (state.busy || element.disabled) return;
        document.getElementById("admin-key-search")?.requestSubmit();
      }),
    );
  document
    .getElementById("admin-key-query")
    ?.addEventListener("input", (event) => {
      state.data.adminKeySearchDraft = event.target.value;
      clearTimeout(adminKeySearchTimer);
      const search = () => {
        if (state.route !== "keys" || state.offline) return;
        if (state.busy) {
          adminKeySearchTimer = setTimeout(search, 100);
          return;
        }
        if (
          (state.data.adminKeySearchDraft ?? "").trim() !==
          (state.data.adminKeyQuery ?? "")
        )
          document.getElementById("admin-key-search")?.requestSubmit();
      };
      adminKeySearchTimer = setTimeout(search, 300);
    });
  document
    .getElementById("admin-key-size")
    ?.addEventListener("change", (event) => {
      if (state.busy) return;
      const size = Number(event.currentTarget.value);
      if (![10, 20, 50, 100].includes(size)) return;
      state.data.adminKeySize = size;
      state.data.adminKeyPage = 0;
      state.busy = "admin-keys-search";
      render();
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
      state.busy = `admin-keys-page-${element.dataset.direction ?? (nextPage < Number(state.data.adminKeys?.number ?? 0) ? "prev" : "next")}`;
      render();
      void loadRoute({ keepContent: true }).finally(() => {
        state.busy = null;
        render();
      });
    }),
  );
  document.querySelectorAll("[data-action]").forEach((element) =>
    element.addEventListener("click", (event) => {
      if (element.tagName === "A") event.preventDefault();
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
    .querySelectorAll('form[data-form="admin-user-detail-roles"]')
    .forEach((form) =>
      form.addEventListener("change", (event) => {
        const input = event.target;
        if (!input.matches('input[name="roles"]')) return;
        input
          .closest(".admin-role-option")
          ?.classList.toggle("selected", input.checked);
        if (state.data.adminUserDetailRoleError) {
          state.data.adminUserDetailRoleError = "";
          form.querySelector(".admin-user-role-error").textContent = "";
        }
      }),
    );
  document
    .querySelectorAll('[data-action="admin-user-detail-page-size"]')
    .forEach((element) =>
      element.addEventListener(
        "change",
        () => void action(element.dataset.action, element),
      ),
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

function restoreNativeClientUrl() {
  if (state.console !== "admin") return false;
  const match =
    /^#\/admin\/clients(?:\/([A-Za-z0-9_-]{1,100})\/(settings|credentials|scopes|roles|mappers|evaluation|sessions|consents|events))?$/.exec(
      window.location.hash,
    );
  if (!match) return false;
  state.data.clientRegeneratedSecret = null;
  state.data.clientOperation = null;
  if (!match[1]) state.route = "clients";
  else {
    state.route = "client-detail";
    state.data.clientDetailId = match[1];
    state.data.clientDetailTab = match[2];
  }
  return true;
}
function restoreClientScopeUrl() {
  if (state.console !== "admin") return false;
  const match =
    /^#\/admin\/client-scopes(?:\/(create|[A-Za-z0-9_-]{1,100})(?:\/(details|edit))?)?$/.exec(
      window.location.hash,
    );
  if (!match) return false;
  if (!match[1]) state.route = "client-scopes";
  else if (match[1] === "create") state.route = "client-scope-create";
  else {
    state.route = "client-scope-detail";
    state.data.clientScopeDetailId = match[1];
    state.data.clientScopeEditing =
      match[2] === "edit" && state.data.adminAccess?.manageClients === true;
  }
  return true;
}
function restoreIdentityProviderUrl() {
  if (state.console !== "admin") return false;
  const match =
    /^#\/admin\/identity-providers(?:\/(new|[A-Za-z0-9_-]{1,100})(?:\/(details|mappers))?)?$/.exec(
      window.location.hash,
    );
  if (!match) return false;
  const id = match[1];
  if (!id) state.route = "identity-providers";
  else if (id === "new") {
    state.route = "identity-provider-create";
    state.data.identityProviderCreateType ??= "oidc";
  } else {
    state.route = "identity-provider-detail";
    state.data.identityProviderDetailId = id;
    state.data.identityProviderDetailTab = match[2] ?? "details";
  }
  return true;
}
window.addEventListener("popstate", () => {
  if (!state.session || state.busy) return;
  if (restoreIdentityProviderUrl()) {
    void loadRoute();
    return;
  }
  if (restoreClientScopeUrl()) {
    void loadRoute();
    return;
  }
  if (restoreNativeClientUrl()) void clientReload("client-history", false);
});

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
  state.loading = Boolean(state.session && state.console === "admin");
  render();
  if (state.session) {
    if (state.console === "admin") {
      state.data.adminAccess = null;
      try {
        const identity = await request("/api/admin/whoami");
        state.data.adminAccess = normalizeAdminAccess(identity?.access);
        if (!state.data.adminAccess) throw { kind: "forbidden" };
        state.route = firstAuthorizedAdminRoute() ?? "dashboard";
        groupScreens.restoreUrl();
        organizationScreens.restoreUrl();
        restoreNativeClientUrl();
        restoreClientScopeUrl();
        restoreIdentityProviderUrl();
        state.error = null;
      } catch (error) {
        state.route = "dashboard";
        state.loading = false;
        if (!error?.kind) state.error = { kind: "forbidden" };
        render();
        return;
      }
    } else {
      state.route = "profile";
    }
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
