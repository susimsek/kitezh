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

function bearerIsValid(request) {
  return request.headers.authorization === `Bearer ${fixtureTokens.accessToken}`;
}

function authorizePage(url) {
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (!redirectUri || !state) return null;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Kitezh fixture sign in</title></head>
<body><main><h1>Kitezh fixture account</h1>
<p>This deterministic account is used only by native development-build tests.</p>
<form method="post">
<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
<input type="hidden" name="state" value="${escapeHtml(state)}">
<button type="submit">Continue with fixture account</button>
</form></main></body></html>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

export function createFixtureServer({ host = "127.0.0.1", port = 0 } = {}) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
      const issuer = `http://${url.host}`;
      writeJson(response, 200, {
        issuer,
        authorization_endpoint: `${issuer}/oauth2/authorize`,
        token_endpoint: `${issuer}/oauth2/token`,
        end_session_endpoint: `${issuer}/connect/logout`,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/oauth2/authorize") {
      const page = authorizePage(url);
      if (!page) {
        writeJson(response, 400, { title: "Invalid authorization request" });
        return;
      }
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8" });
      response.end(page);
      return;
    }
    if (request.method === "POST" && url.pathname === "/oauth2/authorize") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
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
      return;
    }
    if (request.method === "POST" && url.pathname === "/oauth2/token") {
      writeJson(response, 200, {
        access_token: fixtureTokens.accessToken,
        refresh_token: fixtureTokens.refreshToken,
        id_token: fixtureTokens.idToken,
        token_type: "Bearer",
        expires_in: 300,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/connect/logout") {
      const redirectUri = url.searchParams.get("post_logout_redirect_uri");
      if (redirectUri) redirect(response, redirectUri);
      else writeJson(response, 204, {});
      return;
    }
    if (url.pathname === "/api/account/profile") {
      if (!bearerIsValid(request)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      writeJson(response, 200, {
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
      return;
    }
    if (url.pathname === "/api/account/sessions") {
      if (!bearerIsValid(request)) {
        writeJson(response, 401, { title: "Unauthorized", status: 401 });
        return;
      }
      writeJson(response, 200, { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
      return;
    }
    if (url.pathname === "/fixture/forbidden") {
      writeJson(response, 403, { title: "Forbidden", status: 403 });
      return;
    }
    if (url.pathname === "/fixture/timeout") {
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      writeJson(response, 504, { title: "Gateway Timeout", status: 504 });
      return;
    }
    writeJson(response, 404, { title: "Not Found", status: 404 });
  });

  return {
    server,
    async listen() {
      await new Promise((resolve) => server.listen(port, host, resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
      return { host, port: address.port, issuer: `http://${host}:${address.port}` };
    },
    close() {
      return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
  const fixture = createFixtureServer({ host: args.get("--host") ?? "127.0.0.1", port: Number(args.get("--port") ?? 8081) });
  const bound = await fixture.listen();
  console.log(`Native fixture listening at ${bound.issuer}`);
  process.on("SIGTERM", () => void fixture.close());
  process.on("SIGINT", () => void fixture.close());
}
