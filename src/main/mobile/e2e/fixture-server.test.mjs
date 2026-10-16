import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createTcpServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createFixtureServer } from "./fixture-server.mjs";

test("fixture CLI starts and exposes health when executed directly", async () => {
  const portProbe = createTcpServer();
  await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
  const address = portProbe.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) =>
    portProbe.close((error) => (error ? reject(error) : resolve())),
  );

  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./fixture-server.mjs", import.meta.url)),
      "--host",
      "127.0.0.1",
      "--port",
      String(address.port),
    ],
    { stdio: "ignore" },
  );

  try {
    let response;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        response = await fetch(`http://127.0.0.1:${address.port}/health`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.equal(response?.status, 200);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
  }
});

test("fixture exposes discovery, authorization, protected account, and failure states", async () => {
  const fixture = createFixtureServer();
  const bound = await fixture.listen();
  try {
    const discovery = await fetch(
      `${bound.issuer}/.well-known/openid-configuration`,
    ).then((response) => response.json());
    assert.equal(discovery.issuer, bound.issuer);
    assert.match(discovery.authorization_endpoint, /\/oauth2\/authorize$/);

    const authorization = await fetch(
      `${bound.issuer}/oauth2/authorize?redirect_uri=kitezh%3A%2F%2Foauth%2Fcallback&state=fixture-state`,
    );
    assert.equal(authorization.status, 200);
    assert.match(await authorization.text(), /Continue with fixture account/);
    const callback = await fetch(`${bound.issuer}/oauth2/authorize`, {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({
        redirect_uri: "kitezh://oauth/callback",
        state: "fixture-state",
      }),
    });
    assert.equal(callback.status, 302);
    assert.match(
      callback.headers.get("location") ?? "",
      /code=[^&]+&state=fixture-state/,
    );

    const tokenResponse = await fetch(`${bound.issuer}/oauth2/token`, {
      method: "POST",
    });
    assert.equal(tokenResponse.status, 200);
    const token = await tokenResponse.json();
    assert.equal(typeof token.access_token, "string");
    assert.equal(
      (await fetch(`${bound.issuer}/api/account/profile`)).status,
      401,
    );

    const profile = await fetch(`${bound.issuer}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((response) => response.json());
    assert.equal(profile.username, "fixture-user");
    const cibaRequests = await fetch(`${bound.issuer}/api/ciba/requests`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((response) => response.json());
    assert.equal(cibaRequests.content.length, 2);
    const cibaDecision = await fetch(
      `${bound.issuer}/api/ciba/requests/fixture-approve/approve?user_code=ABCD-EFGH`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}` },
      },
    );
    assert.equal(cibaDecision.status, 204);
    const mfaStatus = await fetch(`${bound.issuer}/api/account/mfa`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((response) => response.json());
    assert.equal(mfaStatus.available, true);
    assert.equal(
      (await fetch(`${bound.issuer}/fixture/forbidden`)).status,
      403,
    );
    const timeoutController = new AbortController();
    const timeoutRequest = fetch(`${bound.issuer}/fixture/timeout?delay=50`, {
      signal: timeoutController.signal,
    });
    setTimeout(() => timeoutController.abort(), 5);
    await assert.rejects(
      timeoutRequest,
      (error) => error?.name === "AbortError",
    );
  } finally {
    await fixture.close();
  }
});
