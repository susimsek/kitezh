import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const rendererPath = path.join(
  desktopDirectory,
  "src",
  "native",
  "renderer.mjs",
);
let rendererInstance = 0;

function makeResponse(path, method, body) {
  if (path === "/api/admin/users" && method === "POST") {
    return { id: 9, username: body?.username, enabled: body?.enabled };
  }
  if (path === "/api/admin/whoami") {
    return {
      access: {
        isAdmin: true,
        queryUsers: true,
        viewUsers: true,
        manageUsers: true,
        viewRoles: true,
        manageRoles: true,
        queryGroups: true,
        viewGroups: true,
        manageGroups: true,
        queryClients: true,
        viewClients: true,
        manageClients: true,
        viewSessions: true,
        manageSessions: true,
        viewConsents: true,
        manageConsents: true,
        viewEvents: true,
        manageEvents: true,
        viewKeys: true,
        manageKeys: true,
      },
    };
  }
  if (path.startsWith("/api/admin/users?")) {
    return {
      content: [
        {
          id: 1,
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          enabled: true,
          locked: true,
          totpEnabled: true,
          roles: ["ROLE_USER"],
          groups: [],
          createdAt: "2026-10-12T08:30:00Z",
          requiredActions: [],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (/^\/api\/admin\/roles\/ROLE_[A-Z0-9_]+(?:\?|$)/.test(path)) {
    const name = path.split("?")[0].split("/").at(-1);
    return {
      name,
      description: "Standard user",
      userCount: 0,
      protectedRole: ["ROLE_USER", "ROLE_ADMIN"].includes(name),
      users: {
        content: [],
        page: { number: 0, size: 10, totalElements: 0, totalPages: 0 },
      },
      compositeRoles: [],
      compositeClientRoles: [],
    };
  }
  if (path.startsWith("/api/admin/roles?")) {
    return {
      content: [
        {
          id: 2,
          name: "ROLE_USER",
          description: "Standard user",
          composite: false,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/groups?")) {
    return {
      content: [
        { id: 3, name: "Engineering", path: "/Engineering", memberCount: 1 },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path === "/api/admin/clients/console-client") {
    return {
      id: "console-client",
      clientId: "console-client",
      clientName: "Console Client",
      enabled: true,
      clientAuthenticationMethods: ["none"],
      authorizationGrantTypes: ["authorization_code", "refresh_token"],
      scopes: ["openid"],
      redirectUris: ["https://client.example.test/callback"],
      postLogoutRedirectUris: [],
      dpopSigningAlgorithms: ["RS256", "ES256"],
      ...(method === "PUT" ? body : {}),
    };
  }
  if (path.startsWith("/api/admin/clients?")) {
    return {
      content: [
        {
          id: "console-client",
          clientId: "console-client",
          clientName: "Console Client",
          name: "Console Client",
          enabled: true,
          protocol: "openid-connect",
          publicClient: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path === "/api/admin/client-scopes/profile" && method === "GET") {
    return { id: "profile", name: "profile", description: "Profile scope", builtIn: false };
  }
  if (path.startsWith("/api/admin/client-scopes?")) {
    return {
      content: [
        { id: "profile", name: "profile", description: "Profile scope" },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/identity-providers?")) {
    return {
      content: [
        {
          alias: "github",
          displayName: "GitHub",
          providerId: "github",
          enabled: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path === "/api/admin/notifications/unread-count") return 1;
  if (path.startsWith("/api/admin/notifications")) {
    return {
      content: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          messageKey: "notificationAdminUserRegistered",
          createdAt: "2026-10-12T08:30:00Z",
          read: false,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/sessions")) {
    return {
      content: [
        {
          id: "session-1",
          username: "ada",
          authorizationCount: 2,
          active: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/consents")) {
    return {
      content: [
        {
          username: "ada",
          clientId: "console-client",
          scopes: ["openid"],
          createdAt: "2026-10-12T08:30:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/offline-sessions")) {
    return {
      content: [
        {
          id: "offline-session-1",
          username: "ada",
          clientId: "console-client",
          lastAccessTime: "2026-10-12T08:30:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/events")) {
    return {
      content: [
        {
          action: "user.updated",
          actor: "admin",
          targetType: "user",
          targetId: "1",
          occurredAt: "2026-10-12T08:30:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path.startsWith("/api/admin/keys")) {
    return {
      content: [
        {
          kid: "signing-key-1",
          algorithm: "RS256",
          active: true,
          createdAt: "2026-10-12T08:30:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    };
  }
  if (path === "/api/account/profile" && method === "GET") {
    return {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      preferredLocale: "en",
    };
  }
  if (path === "/api/account/profile" && method === "PUT") return body;
  if (path === "/api/account/mfa")
    return { available: true, enabled: false, digits: 6 };
  if (path === "/api/account/mfa/recovery-codes")
    return { available: true, remaining: 0 };
  if (path === "/api/account/mfa/setup")
    return { available: true, secret: "test-secret", digits: 6 };
  if (path === "/api/account/social-links")
    return [
      {
        provider: "github",
        displayName: "GitHub",
        configured: true,
        enabled: true,
        linked: false,
      },
    ];
  if (path.startsWith("/api/account/sessions"))
    return {
      content: [
        { id: "current-session", current: true },
        { id: "other-session", current: false },
      ],
    };
  if (path.startsWith("/api/account/applications"))
    return {
      content: [
        {
          clientId: "desktop-client",
          clientName: "Desktop",
          scopes: ["openid"],
        },
      ],
    };
  if (path.startsWith("/api/account/offline-sessions"))
    return { content: [{ id: "offline-session", clientId: "desktop-client" }] };
  if (path === "/api/account/notifications/unread-count") return 1;
  if (path.startsWith("/api/account/notifications"))
    return {
      content: [
        {
          id: "notification-1",
          messageKey: "notificationAccountMfaEnabled",
          createdAt: "2026-10-12T08:30:00Z",
          read: false,
        },
      ],
    };
  if (path.startsWith("/api/admin/") || path.startsWith("/actuator/")) {
    return { content: [], totalElements: 0, totalPages: 0, number: 0 };
  }
  return { content: [] };
}

async function renderConsole(consoleName = "account", options = {}) {
  const dom = new JSDOM('<div id="app"></div>', {
    url: `https://renderer.invalid/native?console=${consoleName}${options.hash ?? ""}`,
    pretendToBeVisual: true,
  });
  const calls = [];
  const callbacks = {};
  const responseHandlers = new Map();
  const setResponse = (path, method, handler) =>
    responseHandlers.set(`${method ?? "GET"} ${path}`, handler);
  const api = {
    api: {
      request: async ({ path: requestPath, method, body }) => {
        const requestMethod = method ?? "GET";
        calls.push({ path: requestPath, method: requestMethod, body });
        const responseHandler = responseHandlers.get(
          `${requestMethod} ${requestPath}`,
        );
        const responseBody = responseHandler
          ? await responseHandler({
              path: requestPath,
              method: requestMethod,
              body,
            })
          : options.response
            ? ((await options.response(requestPath, requestMethod, body)) ??
              makeResponse(requestPath, requestMethod, body))
            : makeResponse(requestPath, requestMethod, body);
        if (
          responseBody &&
          typeof responseBody === "object" &&
          "status" in responseBody
        )
          return responseBody;
        return { status: 200, body: responseBody };
      },
    },
    auth: {
      hasSession: async (requestedConsole) => {
        if (options.hasSessionFailure) throw new Error("session lookup failed");
        if (options.sessionConsole)
          return requestedConsole === options.sessionConsole
            ? { console: requestedConsole }
            : null;
        return options.hasSession === false || requestedConsole !== consoleName
          ? null
          : { console: consoleName };
      },
      startLogin: async (requestedConsole) => {
        calls.push({ path: "start-login", method: requestedConsole });
        return options.startLogin?.(requestedConsole);
      },
      cancelLogin: async (requestedConsole) => {
        calls.push({ path: "cancel-login", method: requestedConsole });
        return options.cancelLogin?.(requestedConsole);
      },
      logout: async () => {
        calls.push({ path: "logout", method: "POST" });
        if (options.logoutFails)
          throw new Error("expected test logout failure");
      },
      clearSession: async (namespace) => {
        calls.push({ path: "clear-session", method: namespace });
      },
      clearAllSessions: async () => {
        calls.push({ path: "clear-all-sessions", method: "POST" });
      },
      socialLink: {
        start: async (provider) => {
          calls.push({ path: "social-link-start", method: provider });
          return { status: 202 };
        },
        onCallback: (listener) => {
          callbacks.socialLink = listener;
        },
      },
    },
    openExternal: async (url) =>
      calls.push({ path: "open-external", method: url }),
    theme: {
      set: async (theme) => calls.push({ path: "theme", method: theme }),
      onChanged: (listener) => {
        callbacks.theme = listener;
      },
    },
    language: {
      set: async (locale) => calls.push({ path: "language", method: locale }),
      onChanged: (listener) => {
        callbacks.language = listener;
      },
    },
    onAuthCallback: (listener) => {
      callbacks.auth = listener;
    },
    onMenuLogout: (listener) => {
      callbacks.logout = listener;
    },
  };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    FormData: dom.window.FormData,
    File: dom.window.File,
    Blob: dom.window.Blob,
    CSS: dom.window.CSS ?? {
      escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    },
    HTMLElement: dom.window.HTMLElement,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    desktopApi: api,
    confirm: options.confirm ?? (() => true),
    __KITEZH_NATIVE_BOOTSTRAP__: {
      locale: options.locale ?? "en",
      theme: options.theme ?? "light",
      icons: options.icons ?? {},
      messages: {
        en: {
          accountTitle: "Account",
          settings: "Settings",
          adminUserActionError: "The user action could not be completed.",
          adminPasskeyCreated: "Added",
          adminPasskeyLastUsed: "Last used",
          adminPasskeySignatureCount: "Signature counter",
          adminPasskeyUserVerification: "User verification",
          adminYes: "Yes",
          adminNo: "No",
          adminUserTemporaryPasswordHelp:
            "Require the user to choose a new password the next time they sign in.",
        },
        tr: {
          accountTitle: "Hesap",
          settings: "Ayarlar",
          adminUserActionError: "Kullanıcı işlemi tamamlanamadı.",
          adminPasskeyCreated: "Eklenme",
          adminPasskeyLastUsed: "Son kullanım",
          adminPasskeySignatureCount: "İmza sayacı",
          adminPasskeyUserVerification: "Kullanıcı doğrulaması",
          adminYes: "Evet",
          adminNo: "Hayır",
          adminUserTemporaryPasswordHelp:
            "Kullanıcının sonraki girişinde yeni bir parola seçmesini zorunlu tutun.",
        },
      },
      ...(options.messages ? { messages: options.messages } : {}),
    },
  };
  const previousGlobals = new Map();
  for (const [name, value] of Object.entries(globals)) {
    previousGlobals.set(
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    );
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  rendererInstance += 1;
  await import(
    `${pathToFileURL(rendererPath).href}?coverage-instance=${rendererInstance}`
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    api,
    calls,
    callbacks,
    setResponse,
    document: dom.window.document,
    dom,
    restore() {
      dom.window.close();
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

async function settle() {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function exerciseVisibleEditorActions(document) {
  const safeAction = document.defaultView.location.search.includes(
    "console=admin",
  )
    ? /(?:toggle|edit|create|cancel|search|page|retry|select|filter|setup|start|refresh|generate|show|hide|copy|delete|revoke|reset|remove|rotate|enable|disable|unlock|mark|read|assign|permission|mapping|rename|upload|open|detail|tab|back|close)/
    : /(?:toggle|edit|create|cancel|search|page|retry|select|filter|setup|start|refresh|generate|show|hide|copy)/;
  const visited = new Set();
  for (let count = 0; count < 30; count += 1) {
    const element = [...document.querySelectorAll("[data-action]")].find(
      (candidate) =>
        !candidate.disabled &&
        safeAction.test(candidate.dataset.action) &&
        !candidate.dataset.action.endsWith("-confirm") &&
        !visited.has(candidate.dataset.action),
    );
    if (!element) break;
    visited.add(element.dataset.action);
    element.click();
    await settle();
  }
  for (const form of document.querySelectorAll("form")) {
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }
}

export { renderConsole, settle, exerciseVisibleEditorActions, rendererPath };
