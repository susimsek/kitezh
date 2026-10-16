import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const fixtureTokens = {
  accessToken: randomBytes(24).toString("hex"),
  refreshToken: randomBytes(24).toString("hex"),
  idToken: randomBytes(24).toString("hex"),
};

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

function authorizePage(url) {
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (!redirectUri || !state) return null;
  const callback = new URL(redirectUri);
  if (
    callback.protocol !== "kitezh:" ||
    callback.host !== "oauth" ||
    callback.pathname !== "/callback"
  ) {
    return null;
  }
  callback.searchParams.set("code", randomBytes(18).toString("hex"));
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
        const page = authorizePage(url);
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
      (_request, response) => {
        writeJson(response, 200, {
          access_token: fixtureTokens.accessToken,
          refresh_token: fixtureTokens.refreshToken,
          id_token: fixtureTokens.idToken,
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
