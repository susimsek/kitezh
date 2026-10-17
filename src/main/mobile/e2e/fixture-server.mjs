import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Keep fixture credentials stable between runs because iOS SecureStore survives
// app data resets and can restore an Admin session from an earlier Maestro run.
const fixtureTokens = {
  accessToken: "kitezh-e2e-account-access",
  refreshToken: "kitezh-e2e-account-refresh",
  idToken: "kitezh-e2e-account-id",
};
const fixtureAdminTokens = {
  accessToken: "kitezh-e2e-admin-access",
  refreshToken: "kitezh-e2e-admin-refresh",
  idToken: "kitezh-e2e-admin-id",
};

const fixtureCibaRequests = ["approve", "deny"].map((decision) => ({
  authReqId: `fixture-${decision}`,
  userCode: decision === "approve" ? "ABCD-EFGH" : "JKLM-NPQR",
  bindingMessage: `Fixture ${decision} request`,
  authorizedScopes: "openid profile",
  deliveryMode: "poll",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  status: "pending",
  mfaRequired: false,
  stepUpRequired: false,
}));

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function writeJson(response, status, body) {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(body));
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function authorizePage(url, onAuthorizationCode = () => {}) {
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (!redirectUri || !state) return null;
  const callback = new URL(redirectUri);
  const isAccountCallback =
    callback.protocol === "kitezh:" &&
    callback.host === "oauth" &&
    callback.pathname === "/callback";
  const isAdminCallback =
    callback.protocol === "kitezh:" &&
    callback.host === "admin" &&
    callback.pathname === "/oauth/callback";
  const isSocialLinkCallback =
    callback.protocol === "kitezh:" &&
    callback.host === "social-link" &&
    callback.pathname === "/callback";
  if (!isAccountCallback && !isAdminCallback && !isSocialLinkCallback) {
    return null;
  }
  const code = randomBytes(18).toString("hex");
  onAuthorizationCode(code, state);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);
  const callbackUrl = callback.toString();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Kitezh fixture sign in</title></head>
<body><main><h1>Kitezh fixture account</h1>
<p>This deterministic account is used only by native development-build tests.</p>
<a href="${escapeHtml(callbackUrl)}">Continue with fixture account</a>
</main></body></html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

export function createFixtureServer({ host = "127.0.0.1", port = 0 } = {}) {
  const fixtureEventSettings = {
    eventsEnabled: true,
    adminEventsEnabled: true,
    adminEventsDetailsEnabled: false,
    eventsExpirationDays: 30,
  };
  const fixtureLoginSettings = {
    userRegistration: true,
    forgotPassword: true,
    rememberMe: false,
    loginWithEmail: false,
    verifyEmail: false,
    sessionTimeoutMinutes: 30,
    passwordMinimumLength: 12,
    bruteForceEnabled: true,
    bruteForceMaxFailures: 5,
    otpEnabled: true,
    otpRequired: false,
    passkeys: false,
  };
  const fixtureLocalizationSettings = {
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
    availableLocales: ["en", "tr"],
    availableBundles: ["backend", "common"],
  };
  const fixtureEmailSettings = {
    enabled: false,
    fromAddress: "kitezh@example.test",
    baseUrl: "http://127.0.0.1:9090",
    host: "mail.example.test",
    port: 587,
    username: "fixture-user",
    passwordConfigured: true,
    smtpAuth: true,
    starttls: true,
    ssl: false,
  };
  const fixtureCibaPolicy = {
    requestLifespanSeconds: 300,
    pollingIntervalSeconds: 5,
    deliveryMode: "poll",
    userVerification: "required",
    mfaRequired: false,
    stepUpRequired: false,
    stepUpAcr: null,
  };
  const fixtureOfflineAccessPolicy = {
    idleTimeout: "P30D",
    maxLifespan: null,
    maxLimited: false,
    revokedBefore: null,
  };
  const fixtureGroupUsers = new Map([
    [5, { id: 5, username: "fixture-member", enabled: true }],
  ]);
  const fixtureAvailableGroupUsers = new Map([
    [42, { id: 42, username: "fixture-candidate", enabled: true }],
  ]);
  const fixtureProfileAttributes = {
    definitions: [
      {
        id: 1,
        name: "department",
        displayName: "Department",
        description: "Your team or department.",
        type: "STRING",
        required: false,
        multivalued: false,
        minLength: 1,
        maxLength: 80,
        pattern: null,
        enabled: true,
        displayOrder: 10,
        builtIn: false,
      },
    ],
    attributes: { department: ["Engineering"] },
  };
  const fixtureNotifications = [
    {
      id: "notice-1",
      messageKey: "notificationAccountMfaEnabled",
      createdAt: "2026-10-17T10:00:00Z",
      read: false,
    },
  ];
  const fixtureSocialLinks = [
    {
      provider: "google",
      displayName: "Google",
      iconKey: "google",
      linked: false,
      configured: true,
      enabled: true,
    },
  ];
  const fixtureSocialTransactions = new Map();
  const fixtureSocialCodes = new Map();
  const routes = new Map([
    [
      "GET /health",
      (_request, response) => writeJson(response, 200, { status: "ok" }),
    ],
    [
      "GET /.well-known/openid-configuration",
      (_request, response, url) => {
        const issuer = `http://${url.host}`;
        writeJson(response, 200, {
          issuer,
          authorization_endpoint: `${issuer}/oauth2/authorize`,
          token_endpoint: `${issuer}/oauth2/token`,
          end_session_endpoint: `${issuer}/connect/logout`,
        });
      },
    ],
    [
      "GET /oauth2/authorize",
      (_request, response, url) => {
        const page = authorizePage(url, (code, state) => {
          const transaction = fixtureSocialTransactions.get(state);
          if (transaction) fixtureSocialCodes.set(code, transaction);
        });
        if (!page) {
          writeJson(response, 400, { title: "Invalid authorization request" });
          return;
        }
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        });
        response.end(page);
      },
    ],
    [
      "POST /oauth2/authorize",
      async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const form = new URLSearchParams(
          Buffer.concat(chunks).toString("utf8"),
        );
        const redirectUri = form.get("redirect_uri");
        const state = form.get("state");
        if (!redirectUri || !state) {
          writeJson(response, 400, { title: "Invalid authorization request" });
          return;
        }
        const callback = new URL(redirectUri);
        callback.searchParams.set("code", randomBytes(18).toString("hex"));
        callback.searchParams.set("state", state);
        redirect(response, callback.toString());
      },
    ],
    [
      "POST /oauth2/token",
      async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const form = new URLSearchParams(
          Buffer.concat(chunks).toString("utf8"),
        );
        const tokens =
          form.get("client_id") === "mobile-admin-console"
            ? fixtureAdminTokens
            : fixtureTokens;
        writeJson(response, 200, {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          id_token: tokens.idToken,
          token_type: "Bearer",
          expires_in: 300,
        });
      },
    ],
    [
      "GET /connect/logout",
      (_request, response, url) => {
        const redirectUri = url.searchParams.get("post_logout_redirect_uri");
        if (redirectUri) redirect(response, redirectUri);
        else writeJson(response, 204, {});
      },
    ],
    [
      "/api/account/profile",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          username: "fixture-user",
          firstName: "Fixture",
          lastName: "User",
          email: "fixture@example.test",
          pendingEmail: null,
          emailVerified: true,
          preferredLocale: "en",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        });
      },
    ],
    [
      "/api/account/profile/attributes",
      async (request, response) => {
        if (!bearerIsValid(request, fixtureTokens)) {
          writeJson(response, 401, { title: "Unauthorized", status: 401 });
          return;
        }
        if (request.method === "GET") {
          writeJson(response, 200, fixtureProfileAttributes);
          return;
        }
        if (request.method !== "PUT") {
          writeJson(response, 405, {
            title: "Method Not Allowed",
            status: 405,
          });
          return;
        }
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        fixtureProfileAttributes.attributes = body.attributes ?? {};
        writeJson(response, 200, fixtureProfileAttributes);
      },
    ],
    [
      "/api/account/profile/avatar",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          avatarUrl: null,
        });
      },
    ],
    [
      "/api/account/sessions",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 20,
        });
      },
    ],
    [
      "/api/account/applications",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 20,
        });
      },
    ],
    [
      "/api/account/offline-sessions",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 20,
        });
      },
    ],
    [
      "GET /api/account/notifications",
      (request, response, url) => {
        if (!bearerIsValid(request, fixtureTokens)) {
          writeJson(response, 401, { title: "Unauthorized", status: 401 });
          return;
        }
        const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
        const size = Math.max(1, Number(url.searchParams.get("size") ?? 20));
        const totalPages = Math.ceil(fixtureNotifications.length / size);
        const content = fixtureNotifications.slice(page * size, (page + 1) * size);
        writeJson(response, 200, {
          content,
          totalElements: fixtureNotifications.length,
          totalPages,
          number: page,
          size,
        });
      },
    ],
    [
      "GET /api/account/notifications/unread-count",
      (request, response) => {
        if (!bearerIsValid(request, fixtureTokens)) {
          writeJson(response, 401, { title: "Unauthorized", status: 401 });
          return;
        }
        writeJson(
          response,
          200,
          fixtureNotifications.filter((notification) => !notification.read)
            .length,
        );
      },
    ],
    [
      "GET /api/ciba/requests",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          content: fixtureCibaRequests,
          totalElements: fixtureCibaRequests.length,
          totalPages: fixtureCibaRequests.length > 0 ? 1 : 0,
          number: 0,
          size: 20,
        });
      },
    ],
    [
      "GET /api/account/mfa",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          enabled: false,
          available: true,
          required: false,
          issuer: "Kitezh Fixture",
          algorithm: "SHA1",
          digits: 6,
          periodSeconds: 30,
        });
      },
    ],
    [
      "POST /api/account/mfa/setup",
      (request, response) => {
        writeAuthorizedJson(request, response, fixtureTokens, {
          secret: "JBSWY3DPEHPK3PXP",
          qrCode:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=",
          algorithm: "SHA1",
          digits: 6,
          periodSeconds: 30,
        });
      },
    ],
    [
      "/fixture/forbidden",
      (_request, response) => {
        writeJson(response, 403, { title: "Forbidden", status: 403 });
      },
    ],
    [
      "/fixture/timeout",
      async (_request, response, url) => {
        await timeoutResponse(url, response);
      },
    ],
  ]);

  const server = createServer(async (request, response) => {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? host}`,
    );
    const cibaDecision = url.pathname.match(
      /^\/api\/ciba\/requests\/([^/]+)\/(approve|deny)$/,
    );
    const notificationRead = url.pathname.match(
      /^\/api\/account\/notifications\/([^/]+)\/read$/,
    );
    if (notificationRead && request.method === "PUT") {
      if (!bearerIsValid(request, fixtureTokens)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      const notification = fixtureNotifications.find(
        (item) => item.id === decodeURIComponent(notificationRead[1]),
      );
      if (!notification) {
        writeJson(response, 404, { title: "Not Found", status: 404 });
        return;
      }
      notification.read = true;
      response.writeHead(204);
      response.end();
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/account/social-links"
    ) {
      writeAuthorizedJson(request, response, fixtureTokens, fixtureSocialLinks);
      return;
    }
    const socialLinkStart = url.pathname.match(
      /^\/api\/account\/social-links\/([^/]+)\/mobile\/start$/,
    );
    if (socialLinkStart && request.method === "POST") {
      if (!bearerIsValid(request, fixtureTokens)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      const provider = decodeURIComponent(socialLinkStart[1]);
      const link = fixtureSocialLinks.find((item) => item.provider === provider);
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        !link?.configured ||
        !link.enabled ||
        typeof body.state !== "string" ||
        typeof body.codeChallenge !== "string"
      ) {
        writeJson(response, 400, {
          title: "Invalid social-link request",
          status: 400,
        });
        return;
      }
      const expiresAt = Date.now() + 5 * 60_000;
      fixtureSocialTransactions.set(body.state, {
        provider,
        codeChallenge: body.codeChallenge,
        expiresAt,
      });
      const authorizationUrl = new URL(
        "/oauth2/authorize",
        `http://${url.host}`,
      );
      authorizationUrl.searchParams.set("client_id", "mobile-account-console");
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set(
        "redirect_uri",
        "kitezh://social-link/callback",
      );
      authorizationUrl.searchParams.set("scope", "openid profile");
      authorizationUrl.searchParams.set("state", body.state);
      authorizationUrl.searchParams.set("code_challenge", body.codeChallenge);
      authorizationUrl.searchParams.set("code_challenge_method", "S256");
      writeJson(response, 200, {
        authorizationUrl: authorizationUrl.toString(),
        state: body.state,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/account/social-links/mobile/complete"
    ) {
      if (!bearerIsValid(request, fixtureTokens)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const transaction = fixtureSocialCodes.get(body.code);
      const challenge = createHash("sha256")
        .update(body.codeVerifier ?? "")
        .digest("base64url");
      if (
        !transaction ||
        transaction.expiresAt <= Date.now() ||
        transaction.codeChallenge !== challenge
      ) {
        writeJson(response, 400, {
          title: "Invalid social-link callback",
          status: 400,
        });
        return;
      }
      fixtureSocialCodes.delete(body.code);
      const link = fixtureSocialLinks.find(
        (item) => item.provider === transaction.provider,
      );
      if (!link) {
        writeJson(response, 404, { title: "Provider not found", status: 404 });
        return;
      }
      link.linked = true;
      writeJson(response, 200, { provider: transaction.provider, linked: true });
      return;
    }
    const socialLinkDelete = url.pathname.match(
      /^\/api\/account\/social-links\/([^/]+)$/,
    );
    if (socialLinkDelete && request.method === "DELETE") {
      if (!bearerIsValid(request, fixtureTokens)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      const link = fixtureSocialLinks.find(
        (item) => item.provider === decodeURIComponent(socialLinkDelete[1]),
      );
      if (!link) {
        writeJson(response, 404, { title: "Provider not found", status: 404 });
        return;
      }
      link.linked = false;
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (
        request.headers.authorization !==
        `Bearer ${fixtureAdminTokens.accessToken}`
      ) {
        const status =
          request.headers.authorization ===
          `Bearer ${fixtureTokens.accessToken}`
            ? 403
            : 401;
        writeJson(response, status, {
          title: status === 403 ? "Forbidden" : "Unauthorized",
          status,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/admin/dashboard") {
        writeJson(response, 200, {
          clients: 1,
          users: 2,
          sessions: 1,
          consents: 0,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/admin/server-info") {
        const issuer = `http://${url.host}`;
        writeJson(response, 200, {
          issuer,
          discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
          authorizationEndpoint: `${issuer}/oauth2/authorize`,
          tokenEndpoint: `${issuer}/oauth2/token`,
          introspectionEndpoint: `${issuer}/oauth2/introspect`,
          revocationEndpoint: `${issuer}/oauth2/revoke`,
          jwksEndpoint: `${issuer}/oauth2/jwks`,
          userInfoEndpoint: `${issuer}/userinfo`,
          endSessionEndpoint: `${issuer}/connect/logout`,
          sessionTimeout: "PT30M",
          activeSigningKey: {
            kid: "fixture-active-key",
            type: "RSA",
            algorithm: "RS256",
            use: "sig",
            createdAt: "2026-10-17T00:00:00Z",
          },
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/admin/whoami") {
        writeJson(response, 200, {
          username: "fixture-admin",
          avatarUrl: null,
          authorities: ["ROLE_ADMIN"],
          access: {
            isAdmin: true,
            queryClients: true,
            viewClients: true,
            manageClients: true,
            queryUsers: true,
            viewUsers: true,
            manageUsers: true,
            impersonateUsers: true,
            queryGroups: true,
            viewGroups: true,
            manageGroups: true,
            queryOrganizations: true,
            viewOrganizations: true,
            manageOrganizations: true,
            viewRoles: true,
            manageRoles: true,
            viewSessions: true,
            manageSessions: true,
            viewConsents: true,
            manageConsents: true,
            viewEvents: true,
            manageEvents: true,
            viewKeys: true,
            manageKeys: true,
          },
        });
        return;
      }
      if (
        url.pathname === "/api/admin/settings/login/native" &&
        (request.method === "GET" || request.method === "PUT")
      ) {
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          Object.assign(
            fixtureLoginSettings,
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
        }
        writeJson(response, 200, fixtureLoginSettings);
        return;
      }
      if (
        url.pathname === "/api/admin/settings/localization" &&
        (request.method === "GET" || request.method === "PUT")
      ) {
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          Object.assign(
            fixtureLocalizationSettings,
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
        }
        writeJson(response, 200, fixtureLocalizationSettings);
        return;
      }
      if (
        url.pathname === "/api/admin/settings/email" &&
        (request.method === "GET" || request.method === "PUT")
      ) {
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const updated = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          Object.assign(fixtureEmailSettings, updated, {
            passwordConfigured:
              updated.password?.length > 0 || fixtureEmailSettings.passwordConfigured,
          });
          delete fixtureEmailSettings.password;
        }
        writeJson(response, 200, fixtureEmailSettings);
        return;
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/admin/settings/email/test"
      ) {
        writeJson(response, 200, { accepted: true });
        return;
      }
      if (
        url.pathname === "/api/admin/settings/ciba-policy" &&
        (request.method === "GET" || request.method === "PUT")
      ) {
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          Object.assign(
            fixtureCibaPolicy,
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
        }
        writeJson(response, 200, fixtureCibaPolicy);
        return;
      }
      if (url.pathname === "/api/admin/settings/offline-access") {
        if (request.method === "POST") {
          fixtureOfflineAccessPolicy.revokedBefore = new Date().toISOString();
          writeJson(response, 200, fixtureOfflineAccessPolicy);
          return;
        }
        if (request.method === "GET" || request.method === "PUT") {
          if (request.method === "PUT") {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            Object.assign(
              fixtureOfflineAccessPolicy,
              JSON.parse(Buffer.concat(chunks).toString("utf8")),
            );
          }
          writeJson(response, 200, fixtureOfflineAccessPolicy);
          return;
        }
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/admin/settings/offline-access/revoke-all"
      ) {
        fixtureOfflineAccessPolicy.revokedBefore = new Date().toISOString();
        writeJson(response, 200, fixtureOfflineAccessPolicy);
        return;
      }
      if (url.pathname === "/api/admin/events/config") {
        if (request.method === "GET") {
          writeJson(response, 200, fixtureEventSettings);
          return;
        }
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          Object.assign(
            fixtureEventSettings,
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
          writeJson(response, 200, fixtureEventSettings);
          return;
        }
      }
      if (request.method === "GET" && url.pathname === "/api/admin/groups") {
        writeJson(response, 200, {
          content: [
            {
              id: 3,
              name: "Fixture operators",
              path: "/Fixture operators",
              parentId: null,
              roles: [],
              effectiveRoles: [],
              defaultGroup: false,
              userCount: fixtureGroupUsers.size,
            },
          ],
          number: Number(url.searchParams.get("page") ?? 0),
          size: Number(url.searchParams.get("size") ?? 10),
          totalElements: 1,
          totalPages: 1,
        });
        return;
      }
      const groupUsersRoute = url.pathname.match(
        /^\/api\/admin\/groups\/3\/(users|available-users)(?:\/(\d+))?$/,
      );
      if (groupUsersRoute) {
        const [, collection, userId] = groupUsersRoute;
        if (request.method === "GET" && !userId) {
          const users =
            collection === "users"
              ? fixtureGroupUsers
              : fixtureAvailableGroupUsers;
          const content = [...users.values()].filter((user) =>
            user.username.includes(url.searchParams.get("q") ?? ""),
          );
          writeJson(response, 200, {
            content,
            number: Number(url.searchParams.get("page") ?? 0),
            size: Number(url.searchParams.get("size") ?? 10),
            totalElements: content.length,
            totalPages: content.length ? 1 : 0,
          });
          return;
        }
        if (request.method === "POST" && collection === "users" && !userId) {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const { userId: addedUserId } = JSON.parse(
            Buffer.concat(chunks).toString("utf8"),
          );
          const user = fixtureAvailableGroupUsers.get(addedUserId);
          if (!user) {
            writeJson(response, 404, { title: "Not Found", status: 404 });
            return;
          }
          fixtureAvailableGroupUsers.delete(addedUserId);
          fixtureGroupUsers.set(addedUserId, user);
          writeJson(response, 200, {
            id: 3,
            name: "Fixture operators",
            path: "/Fixture operators",
            parentId: null,
            roles: [],
            effectiveRoles: [],
            defaultGroup: false,
            userCount: fixtureGroupUsers.size,
          });
          return;
        }
        if (request.method === "DELETE" && collection === "users" && userId) {
          const user = fixtureGroupUsers.get(Number(userId));
          if (!user) {
            writeJson(response, 404, { title: "Not Found", status: 404 });
            return;
          }
          fixtureGroupUsers.delete(Number(userId));
          fixtureAvailableGroupUsers.set(Number(userId), user);
          writeJson(response, 200, {
            id: 3,
            name: "Fixture operators",
            path: "/Fixture operators",
            parentId: null,
            roles: [],
            effectiveRoles: [],
            defaultGroup: false,
            userCount: fixtureGroupUsers.size,
          });
          return;
        }
      }
      writeJson(response, 404, { title: "Not Found", status: 404 });
      return;
    }
    if (cibaDecision && request.method === "POST") {
      if (!bearerIsValid(request, fixtureTokens)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      const requestIndex = fixtureCibaRequests.findIndex(
        (item) =>
          item.authReqId === cibaDecision[1] &&
          item.userCode === url.searchParams.get("user_code"),
      );
      if (requestIndex < 0) {
        writeJson(response, 404, { title: "Not Found", status: 404 });
        return;
      }
      fixtureCibaRequests.splice(requestIndex, 1);
      response.writeHead(204);
      response.end();
      return;
    }
    const handler =
      routes.get(`${request.method} ${url.pathname}`) ??
      routes.get(url.pathname);
    if (!handler) {
      writeJson(response, 404, { title: "Not Found", status: 404 });
      return;
    }
    await Promise.resolve(handler(request, response, url));
  });

  return {
    server,
    async listen() {
      await new Promise((resolve) => server.listen(port, host, resolve));
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Fixture server did not bind");
      return {
        host,
        port: address.port,
        issuer: `http://${host}:${address.port}`,
      };
    },
    close() {
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function writeAuthorizedJson(request, response, tokens, body) {
  if (!bearerIsValid(request, tokens)) {
    writeJson(response, 401, { title: "Unauthorized", status: 401 });
    return;
  }
  writeJson(response, 200, body);
}

function bearerIsValid(request, tokens) {
  return request.headers.authorization === `Bearer ${tokens.accessToken}`;
}

async function timeoutResponse(url, response) {
  const delayMs = Number(url.searchParams.get("delay") ?? 30_000);
  await new Promise((resolve) =>
    setTimeout(resolve, Number.isFinite(delayMs) ? delayMs : 30_000),
  );
  writeJson(response, 504, { title: "Gateway Timeout", status: 504 });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2)
    args.set(process.argv[index], process.argv[index + 1]);
  const fixture = createFixtureServer({
    host: args.get("--host") ?? "127.0.0.1",
    port: Number(args.get("--port") ?? 8081),
  });
  const bound = await fixture.listen();
  console.log(`Native fixture listening at ${bound.issuer}`);
  process.on("SIGTERM", () => void fixture.close());
  process.on("SIGINT", () => void fixture.close());
}
