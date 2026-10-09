const boot = globalThis.__KITEZH_NATIVE_BOOTSTRAP__ ?? {};
const api = globalThis.desktopApi;
const messages = boot.messages ?? { en: {}, tr: {} };
const state = {
  locale: boot.locale === "tr" ? "tr" : "en",
  theme: boot.theme === "dark" ? "dark" : "light",
  console: new URLSearchParams(location.search).get("console") === "admin" ? "admin" : "account",
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
const hasConsoleSelection = () => new URLSearchParams(location.search).has("console");
const text = (key) => messages[state.locale]?.[key] ?? messages.en?.[key] ?? key;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const spin = (busy) => busy ? '<span class="spinner" aria-hidden="true"></span>' : "";
const button = (label, options = {}) => `<button class="${options.danger ? "danger-button" : "primary-button"}" type="${options.type ?? "button"}" data-action="${options.action ?? ""}" ${options.provider ? `data-provider="${escapeHtml(options.provider)}"` : ""} ${options.disabled || options.busy ? "disabled" : ""} ${options.busy ? "aria-busy=\"true\"" : ""}>${spin(options.busy)}${escapeHtml(label)}</button>`;
const field = (name, label, value = "", error = "", type = "text", extra = "") => `<div class="field"><label for="${name}">${escapeHtml(label)}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" aria-invalid="${Boolean(error)}" ${extra}/><div class="field-error" id="${name}-error">${escapeHtml(error)}</div></div>`;
const pageHeader = (title, description) => `<div class="topbar"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</div></div>`;

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
}

function problemMessage(error) {
  if (error?.kind === "offline") return state.locale === "tr" ? "Çevrimdışısınız. Bağlantıyı kontrol edip tekrar deneyin." : "You are offline. Check your connection and try again.";
  if (error?.kind === "timeout") return state.locale === "tr" ? "İstek zaman aşımına uğradı. Tekrar deneyin." : "The request timed out. Try again.";
  if (error?.kind === "forbidden") return state.locale === "tr" ? "Bu işlemi yapma yetkiniz yok." : "You are not allowed to perform this action.";
  if (error?.kind === "unauthorized") return state.locale === "tr" ? "Oturumunuz sona erdi. Tekrar giriş yapın." : "Your session expired. Sign in again.";
  if (error?.kind === "validation") return error.body?.detail ?? (state.locale === "tr" ? "Alanları kontrol edin." : "Check the fields and try again.");
  return state.locale === "tr" ? "İşlem tamamlanamadı. Tekrar deneyin." : "The operation could not be completed. Try again.";
}

function setError(error) {
  state.error = { message: problemMessage(error), body: error?.body, kind: error?.kind };
}

async function request(path, options = {}) {
  if (state.offline && (options.method ?? "GET") !== "GET") {
    const error = { kind: "offline", status: 0, body: null };
    setError(error);
    throw error;
  }
  const response = await api.api.request({ console: state.console, path, method: options.method, body: options.body });
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
  return Object.fromEntries((body?.violations ?? []).filter((item) => item?.field && item?.message).map((item) => [item.field, item.message]));
}

function shell() {
  const navigation = state.console === "admin" ? "" : `${navButton("profile", text("firstName"))}${navButton("security", text("security"))}${navButton("sessions", text("sessions"))}${navButton("applications", text("applications"))}${navButton("settings", text("settings"))}`;
  return `<div class="app"><aside class="sidebar" aria-label="${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(state.console === "admin" ? text("adminTitle") : text("accountTitle"))}</p><nav class="nav" aria-label="${escapeHtml(text("settings"))}">${navigation}</nav><div class="sidebar-footer">${state.console === "admin" ? button(text("accountTitle"), { action: "switch-account" }) : ""}${button(state.locale === "tr" ? text("english") : text("turkish"), { action: "toggle-locale" })}</div></aside><main class="main">${pageHeader(routeTitle(), routeDescription())}<div class="content">${state.offline ? `<div class="notice warning" role="status">${escapeHtml(state.locale === "tr" ? "Çevrimdışı mod: güvenli değişiklikler bağlantı gelene kadar devre dışı." : "Offline mode: safe mutations are disabled until connectivity returns.")}</div>` : ""}${state.notice ? `<div class="notice success" role="status">${escapeHtml(state.notice)}</div>` : ""}${state.error ? `<div class="notice error" role="alert">${escapeHtml(state.error.message)} ${state.error.kind === "unauthorized" ? button(text("signIn"), { action: "sign-in" }) : button(text("sessionsRetry"), { action: "retry" })}</div>` : ""}${content()}</div></main></div>`;
}

function navButton(route, label) {
  return `<button type="button" data-route="${route}" aria-current="${state.route === route ? "page" : "false"}">${escapeHtml(label)}</button>`;
}

function routeTitle() {
  if (state.console === "admin") return text("adminTitle");
  return ({ profile: text("accountTitle"), security: text("securityTitle"), sessions: text("sessionsTitle"), applications: text("applicationsTitle"), settings: text("settingsTitle") })[state.route];
}

function routeDescription() {
  if (state.console === "admin") return text("adminOverview");
  return ({ profile: state.locale === "tr" ? "Profil bilgilerinizi yönetin." : "Manage your profile information.", security: text("mfaHelp"), sessions: text("sessionsError"), applications: text("applicationsError"), settings: state.locale === "tr" ? "Masaüstü tercihlerini yönetin." : "Manage desktop preferences." })[state.route];
}

function content() {
  if (state.loading) return '<div class="loading" role="status"><span class="spinner"></span>' + escapeHtml(text("loading")) + '</div>';
  if (state.console === "admin") return adminContent();
  if (state.route === "profile") return profileContent();
  if (state.route === "security") return securityContent();
  if (state.route === "sessions") return sessionsContent();
  if (state.route === "applications") return applicationsContent();
  return settingsContent();
}

function adminContent() {
  return `<section class="card"><h2>${escapeHtml(text("adminTitle"))}</h2><p>${escapeHtml(text("adminComingSoon"))}</p></section>`;
}

function profileContent() {
  const profile = state.profile ?? {};
  const errors = violations(state.error?.body);
  return `<section class="card"><h2>${escapeHtml(text("firstName"))} &amp; ${escapeHtml(text("lastName"))}</h2><p>${escapeHtml(text("profileLoadError"))}</p><form data-form="profile" novalidate><div class="form-grid">${field("firstName", text("firstName"), profile.firstName ?? "", errors.firstName)}${field("lastName", text("lastName"), profile.lastName ?? "", errors.lastName)}${field("email", text("email"), profile.email ?? "", errors.email, "email")}<div class="field"><label for="preferredLocale">${escapeHtml(text("language"))}</label><select id="preferredLocale" name="preferredLocale"><option value="en" ${profile.preferredLocale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${profile.preferredLocale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select><div class="field-error"></div></div>${field("currentPassword", text("currentPassword"), "", errors.currentPassword, "password", "autocomplete=\"current-password\"")}</div><div class="actions">${button(text("save"), { action: "save-profile", type: "submit", busy: state.busy === "profile" })}</div></form></section>`;
}

function securityContent() {
  const mfa = state.data.mfa ?? {};
  const social = state.data.social ?? [];
  const passwordErrors = violations(state.error?.body);
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("passwordPolicy"))}</h2><p>${escapeHtml(text("securityTitle"))}</p><form data-form="password" novalidate>${field("currentPassword", text("currentPassword"), "", passwordErrors.currentPassword, "password")}${field("newPassword", text("newPassword"), "", passwordErrors.newPassword, "password")}${field("confirmPassword", text("confirmPassword"), "", passwordErrors.confirmPassword, "password")}<div class="actions">${button(text("save"), { action: "save-password", type: "submit", busy: state.busy === "password" })}</div></form></section><section class="card"><h2>${escapeHtml(text("mfaTitle"))}</h2><p>${escapeHtml(text("mfaHelp"))}</p>${mfa.available === false ? `<div class="notice">${escapeHtml(text("mfaUnavailable"))}</div>` : mfa.enabled ? `<div class="notice success">${escapeHtml(text("mfaEnabled"))}</div>${field("mfaCode", text("mfaCode"), "", "", "text", "inputmode=\"numeric\" maxlength=\"${mfa.digits ?? 6}\"")}${button(text("mfaDisable"), { action: "mfa-disable", busy: state.busy === "mfa" })}` : mfa.setup ? `<div class="notice">${escapeHtml(text("mfaSecret"))}: <code>${escapeHtml(mfa.setup.secret ?? "")}</code></div>${field("mfaCode", text("mfaCode"), "", "", "text", "inputmode=\"numeric\" maxlength=\"${mfa.setup.digits ?? 6}\"")}${button(text("mfaEnable"), { action: "mfa-enable", busy: state.busy === "mfa" })}` : button(text("mfaSetup"), { action: "mfa-setup", busy: state.busy === "mfa" })}</section><section class="card"><h2>${escapeHtml(text("socialLinksTitle"))}</h2><p>${escapeHtml(text("socialLinksHelp"))}</p><div class="list">${social.length ? social.map((link) => `<div class="list-item"><div><strong>${escapeHtml(link.displayName ?? link.provider)}</strong><span class="muted">${escapeHtml(link.linked ? text("socialConnected") : link.configured && link.enabled ? text("socialNotConnected") : text("socialNotConfigured"))}</span></div>${link.linked ? button(text("socialRemove"), { action: "social-remove", danger: true }) : button(text("socialConnect"), { action: "social-start", busy: state.busy === "social", disabled: !link.configured || !link.enabled, value: link.provider })}</div>`).join("") : `<div class="empty">${escapeHtml(text("socialLinksEmpty"))}</div>`}</div></section><section class="card"><h2>${escapeHtml(text("deleteAccount"))}</h2><p>${escapeHtml(text("deleteAccountWarning"))}</p><form data-form="delete" novalidate>${field("deletePassword", text("currentPassword"), "", "", "password")}<div class="actions">${button(text("deleteAccount"), { action: "delete-account", danger: true, type: "submit", busy: state.busy === "delete" })}</div></form></section></div>`;
}

function pageItems(items, emptyText, renderItem) {
  return items?.length ? `<div class="list">${items.map(renderItem).join("")}</div>` : `<div class="empty">${escapeHtml(emptyText)}</div>`;
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
  return `<div class="grid two-col"><section class="card"><h2>${escapeHtml(text("appearance"))}</h2><div class="settings-row"><label for="theme">${escapeHtml(text("theme"))}</label><select id="theme"><option value="system">${escapeHtml(text("system"))}</option><option value="light">${escapeHtml(text("light"))}</option><option value="dark" ${state.theme === "dark" ? "selected" : ""}>${escapeHtml(text("dark"))}</option></select></div><div class="settings-row"><label for="language">${escapeHtml(text("language"))}</label><select id="language"><option value="en" ${state.locale === "en" ? "selected" : ""}>${escapeHtml(text("english"))}</option><option value="tr" ${state.locale === "tr" ? "selected" : ""}>${escapeHtml(text("turkish"))}</option></select></div></section><section class="card"><h2>${escapeHtml(text("security"))}</h2><p>${escapeHtml(state.locale === "tr" ? "Oturum anahtarları yalnızca masaüstü ana sürecinin güvenli kasasında tutulur." : "Session keys are kept only in the desktop main-process secure vault." )}</p>${button(text("signOut"), { action: "logout", busy: state.busy === "logout" })}</section></div>`;
}

function loginContent() {
  if (!hasConsoleSelection()) {
    return `<div class="login"><section class="card login-card"><div class="brand"><span class="brand-mark" aria-hidden="true">K</span><span>Kitezh</span></div><p class="console-label">${escapeHtml(text("signInNote"))}</p><h1>${escapeHtml(state.locale === "tr" ? "Bir konsol seçin" : "Choose a console")}</h1><p>${escapeHtml(state.locale === "tr" ? "Devam etmek istediğiniz konsolu seçin." : "Select where you want to continue.")}</p><div class="actions">${button(text("adminTitle"), { action: "choose-admin" })}${button(text("accountTitle"), { action: "choose-account" })}</div></section></div>`;
  }
  const title = state.console === "admin" ? text("adminTitle") : text("accountTitle");
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
  state.loading = true; state.error = null; render();
  try {
    state.profile = await request("/api/account/profile");
    state.loading = false;
    render();
  } catch { state.loading = false; render(); }
}

async function loadRoute() {
  state.loading = true; state.error = null; render();
  try {
    if (state.route === "profile") state.profile = await request("/api/account/profile");
    if (state.route === "sessions") state.data.sessions = (await request("/api/account/sessions?page=0&size=20"))?.content ?? [];
    if (state.route === "applications") {
      state.data.applications = (await request("/api/account/applications?page=0&size=20"))?.content ?? [];
      state.data.offlineSessions = (await request("/api/account/offline-sessions?page=0&size=20"))?.content ?? [];
    }
    if (state.route === "security") {
      state.data.mfa = await request("/api/account/mfa");
      state.data.mfa.recovery = await request("/api/account/mfa/recovery-codes");
      state.data.social = await request("/api/account/social-links");
    }
    state.loading = false; render();
  } catch { state.loading = false; render(); }
}

async function signIn() {
  if (state.authStarting) return;
  state.authStarting = true; state.error = null; render();
  try { await api.auth.startLogin(state.console); } catch { state.error = { message: text("browserError") }; }
  state.authStarting = false; render();
}

async function logout() {
  if (state.busy) return;
  state.busy = "logout"; render();
  try { await api.auth.logout(state.console); state.session = null; state.profile = null; state.data = {}; state.route = "profile"; state.notice = null; }
  catch { state.session = null; state.error = { message: state.locale === "tr" ? "Çıkış yapılamadı." : "Sign out could not be completed." }; }
  state.busy = null; render();
}

function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

async function submitForm(form) {
  if (state.busy) return;
  const values = formValues(form);
  if (form.dataset.form === "profile") {
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) { state.error = { message: text("invalidEmail"), body: { violations: [{ field: "email", message: text("invalidEmail") }] } }; render(); return; }
    state.busy = "profile"; state.error = null; render();
    try { state.profile = await request("/api/account/profile", { method: "PUT", body: { firstName: String(values.firstName).trim(), lastName: String(values.lastName).trim(), email: String(values.email).trim(), currentPassword: String(values.currentPassword).trim() || undefined } }); await request("/api/auth/localization/me", { method: "PUT", body: { locale: values.preferredLocale } }); state.notice = text("passwordSaved"); }
    catch { /* request rendered the sanitized error */ }
    state.busy = null; render(); return;
  }
  if (form.dataset.form === "password") {
    if (String(values.newPassword).length < 12 || values.newPassword !== values.confirmPassword) { state.error = { message: text("passwordMismatch") }; render(); return; }
    state.busy = "password"; state.error = null; render();
    try { await request("/api/account/password", { method: "PUT", body: { currentPassword: values.currentPassword, newPassword: values.newPassword } }); state.notice = text("passwordSaved"); form.reset(); }
    catch { /* request rendered the sanitized error */ }
    state.busy = null; render(); return;
  }
  if (form.dataset.form === "delete") {
    if (!values.deletePassword) { state.error = { message: text("passwordRequired") }; render(); return; }
    if (!confirm(text("deleteAccountConfirm"))) return;
    state.busy = "delete"; state.error = null; render();
    try { await request("/api/account", { method: "DELETE", body: { currentPassword: values.deletePassword } }); await api.auth.clearSession(state.console); state.session = null; state.notice = text("deleteAccount"); }
    catch { /* request rendered the sanitized error */ }
    state.busy = null; render();
  }
}

async function action(action, element) {
  if (["logout", "sign-in", "switch-console", "switch-account", "toggle-locale", "retry"].includes(action)) {
    if (action === "logout") return logout();
    if (action === "sign-in") return signIn();
    if (action === "switch-console" || action === "switch-account") { state.console = state.console === "admin" ? "account" : "admin"; state.session = null; state.error = null; render(); return signIn(); }
    if (action === "toggle-locale") { const next = state.locale === "en" ? "tr" : "en"; await api.language.set(next); state.locale = next; render(); return; }
    if (action === "retry") return loadRoute();
  }
  if (action === "choose-admin" || action === "choose-account") {
    state.console = action === "choose-admin" ? "admin" : "account";
    history.replaceState(null, "", `?console=${state.console}`);
    return signIn();
  }
  if (action === "mfa-setup") { state.busy = "mfa"; render(); try { state.data.mfa.setup = await request("/api/account/mfa/setup", { method: "POST" }); } catch {} state.busy = null; render(); return; }
  if (action === "mfa-enable" || action === "mfa-disable") { const code = document.getElementById("mfaCode")?.value ?? ""; const digits = state.data.mfa.setup?.digits ?? state.data.mfa.digits ?? 6; if (!new RegExp(`^\\d{${digits}}$`).test(code)) { state.error = { message: text("mfaInvalidCode") }; render(); return; } state.busy = "mfa"; render(); try { await request(`/api/account/mfa/${action === "mfa-enable" ? "enable" : "disable"}`, { method: "POST", body: { code } }); state.data.mfa = await request("/api/account/mfa"); state.data.mfa.setup = null; state.notice = text("mfaEnabled"); } catch {} state.busy = null; render(); return; }
  if (action === "delete-session" || action === "delete-other-sessions") { if (!confirm(text("signOutSessionConfirm"))) return; state.busy = "sessions"; render(); try { await request(action === "delete-other-sessions" ? "/api/account/sessions/others" : `/api/account/sessions/${encodeURIComponent(element.closest(".list-item")?.dataset.id ?? "")}`, { method: "DELETE" }); state.notice = text("signOutSession"); await loadRoute(); } catch { state.busy = null; render(); } return; }
  if (action === "revoke-application" || action === "revoke-offline") { if (!confirm(text(action === "revoke-application" ? "revokeApplicationConfirm" : "revokeOfflineSessionConfirm"))) return; state.busy = action; render(); const identity = element.closest(".list-item")?.dataset.id ?? ""; try { await request(action === "revoke-application" ? `/api/account/applications/${encodeURIComponent(identity)}` : `/api/account/offline-sessions/${encodeURIComponent(identity)}`, { method: "DELETE" }); state.notice = text(action === "revoke-application" ? "revokeApplicationSuccess" : "revokeOfflineSessionSuccess"); await loadRoute(); } catch { state.busy = null; render(); } return; }
  if (action === "social-remove") { if (!confirm(text("socialRemoveConfirm"))) return; const item = element.closest(".list-item"); const provider = state.data.social.find((candidate) => candidate.displayName === item?.querySelector("strong")?.textContent); state.busy = "social"; render(); try { await request(`/api/account/social-links/${encodeURIComponent(provider?.provider ?? "")}`, { method: "DELETE" }); state.notice = text("socialRemoveSuccess"); await loadRoute(); } catch { state.busy = null; render(); } }
  if (action === "social-start") { if (state.busy || state.offline) return; state.busy = "social"; state.error = null; render(); try { const result = await api.auth.socialLink.start(element.dataset.provider); if (!result || result.status < 200 || result.status >= 300) { setError(result); } else { state.notice = text("socialLinkStarted"); } } catch { state.error = { message: text("socialLinkError") }; } state.busy = null; render(); }
}

function bind() {
  document.querySelectorAll("[data-route]").forEach((element) => element.addEventListener("click", () => { state.route = element.dataset.route; state.notice = null; void loadRoute(); }));
  document.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", () => { if (element.disabled) return; void action(element.dataset.action, element); }));
  document.querySelectorAll("form").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); void submitForm(form); }));
  document.getElementById("theme")?.addEventListener("change", (event) => { void api.theme.set(event.target.value); });
  document.getElementById("language")?.addEventListener("change", (event) => { void api.language.set(event.target.value); });
}

async function hydrate() {
  try {
    const preferred = await api.auth.hasSession(state.console);
    state.session = preferred;
    const other = await api.auth.hasSession(state.console === "admin" ? "account" : "admin");
    if (!state.session && other) { state.console = state.console === "admin" ? "account" : "admin"; state.session = other; }
  } catch { state.session = null; }
  state.loading = false;
  render();
  if (state.session && state.console === "account") void loadRoute();
  else if (new URLSearchParams(location.search).has("console")) void signIn();
}

api.theme.onChanged(setTheme);
api.language.onChanged((locale) => { state.locale = locale; render(); });
api.onAuthCallback((callback) => { if (callback.error) { state.error = { message: text("authError") }; state.authStarting = false; render(); return; } state.authStarting = false; void hydrate(); });
api.auth.socialLink.onCallback((callback) => { state.busy = null; if (callback.error) { state.error = { message: text("socialLinkError") }; render(); return; } state.notice = text("socialLinkSuccess"); void loadRoute(); });
api.onMenuLogout(() => { void logout(); });
window.addEventListener("online", () => { state.offline = false; render(); });
window.addEventListener("offline", () => { state.offline = true; render(); });
setTheme(boot.theme);
void hydrate();
