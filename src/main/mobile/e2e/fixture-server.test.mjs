import assert from "node:assert/strict";
import test from "node:test";

import { createFixtureServer } from "./fixture-server.mjs";

test("fixture exposes discovery, authorization, protected account, and failure states", async () => {
  const fixture = createFixtureServer();
  const bound = await fixture.listen();
  try {
    const discovery = await fetch(`${bound.issuer}/.well-known/openid-configuration`).then((response) => response.json());
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
    assert.match(callback.headers.get("location") ?? "", /code=[^&]+&state=fixture-state/);

    const tokenResponse = await fetch(`${bound.issuer}/oauth2/token`, { method: "POST" });
    assert.equal(tokenResponse.status, 200);
    const token = await tokenResponse.json();
    assert.equal(typeof token.access_token, "string");
    assert.equal((await fetch(`${bound.issuer}/api/account/profile`)).status, 401);

    const profile = await fetch(`${bound.issuer}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((response) => response.json());
    assert.equal(profile.username, "fixture-user");
    assert.equal((await fetch(`${bound.issuer}/fixture/forbidden`)).status, 403);
  } finally {
    await fixture.close();
  }
});
