import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
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
    assert.equal(
      (await fetch(`${bound.issuer}/api/account/profile/attributes`)).status,
      401,
    );
    assert.equal(
      (await fetch(`${bound.issuer}/api/account/notifications`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${bound.issuer}/api/account/notifications/unread-count`)
      ).status,
      401,
    );

    const profile = await fetch(`${bound.issuer}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((response) => response.json());
    assert.equal(profile.username, "fixture-user");
    const accountHeaders = {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    };
    const profileAttributesResponse = await fetch(
      `${bound.issuer}/api/account/profile/attributes`,
      { headers: accountHeaders },
    );
    assert.equal(profileAttributesResponse.status, 200);
    assert.deepEqual(await profileAttributesResponse.json(), {
      attributes: { department: ["Engineering"] },
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
    });
    const updatedAttributesResponse = await fetch(
      `${bound.issuer}/api/account/profile/attributes`,
      {
        method: "PUT",
        headers: accountHeaders,
        body: JSON.stringify({
          attributes: { department: ["Native Platform"] },
        }),
      },
    );
    assert.equal(updatedAttributesResponse.status, 200);
    assert.deepEqual(await updatedAttributesResponse.json(), {
      attributes: { department: ["Native Platform"] },
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
    });
    const persistedAttributes = await fetch(
      `${bound.issuer}/api/account/profile/attributes`,
      { headers: accountHeaders },
    ).then((response) => response.json());
    assert.deepEqual(persistedAttributes.attributes, {
      department: ["Native Platform"],
    });
    assert.equal(
      (
        await fetch(`${bound.issuer}/api/account/notifications`, {
          headers: accountHeaders,
        })
      ).status,
      200,
    );
    const notifications = await fetch(
      `${bound.issuer}/api/account/notifications?page=0&size=20&sort=createdAt%2Cdesc`,
      { headers: accountHeaders },
    ).then((response) => response.json());
    assert.equal(notifications.content[0].messageKey, "notificationAccountMfaEnabled");
    assert.equal(notifications.content[0].read, false);
    assert.equal(
      await fetch(`${bound.issuer}/api/account/notifications/unread-count`, {
        headers: accountHeaders,
      }).then((response) => response.json()),
      1,
    );
    const markedRead = await fetch(
      `${bound.issuer}/api/account/notifications/notice-1/read`,
      { method: "PUT", headers: accountHeaders },
    );
    assert.equal(markedRead.status, 204);
    assert.equal(
      await fetch(`${bound.issuer}/api/account/notifications/unread-count`, {
        headers: accountHeaders,
      }).then((response) => response.json()),
      0,
    );
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

test("fixture isolates admin access and supports native event/group flows", async () => {
  const fixture = createFixtureServer();
  const bound = await fixture.listen();
  try {
    const tokenFor = async (clientId) =>
      fetch(`${bound.issuer}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId }),
      }).then((response) => response.json());
    const accountToken = await tokenFor("mobile-account-console");
    const adminToken = await tokenFor("mobile-admin-console");
    const adminHeaders = {
      Authorization: `Bearer ${adminToken.access_token}`,
      "Content-Type": "application/json",
    };
    const adminIdentity = await fetch(`${bound.issuer}/api/admin/whoami`, {
      headers: adminHeaders,
    }).then((response) => response.json());
    assert.equal(adminIdentity.username, "fixture-admin");
    assert.equal(adminIdentity.access.isAdmin, true);
    assert.equal(adminIdentity.access.manageUsers, true);
    const serverInfoResponse = await fetch(
      `${bound.issuer}/api/admin/server-info`,
      { headers: adminHeaders },
    );
    assert.equal(serverInfoResponse.status, 200);
    const serverInfo = await serverInfoResponse.json();
    assert.equal(serverInfo.issuer, bound.issuer);
    assert.equal(serverInfo.activeSigningKey.kid, "fixture-active-key");
    assert.equal(
      (
        await fetch(`${bound.issuer}/api/admin/whoami`, {
          headers: { Authorization: `Bearer ${accountToken.access_token}` },
        })
      ).status,
      403,
    );

    const adminAuthorization = await fetch(
      `${bound.issuer}/oauth2/authorize?redirect_uri=kitezh%3A%2F%2Fadmin%2Foauth%2Fcallback&state=admin-state`,
    );
    assert.equal(adminAuthorization.status, 200);
    assert.match(
      await adminAuthorization.text(),
      /Continue with fixture account/,
    );

    assert.equal(
      (
        await fetch(`${bound.issuer}/api/admin/events/config`, {
          headers: { Authorization: `Bearer ${accountToken.access_token}` },
        })
      ).status,
      403,
    );
    const initialSettings = await fetch(
      `${bound.issuer}/api/admin/events/config`,
      { headers: adminHeaders },
    ).then((response) => response.json());
    assert.equal(initialSettings.eventsEnabled, true);
    const updatedSettings = await fetch(
      `${bound.issuer}/api/admin/events/config`,
      {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ ...initialSettings, eventsExpirationDays: 90 }),
      },
    ).then((response) => response.json());
    assert.equal(updatedSettings.eventsExpirationDays, 90);

    const initialLocalizationSettings = await fetch(
      `${bound.issuer}/api/admin/settings/localization`,
      { headers: adminHeaders },
    ).then((response) => response.json());
    assert.deepEqual(initialLocalizationSettings.supportedLocales, ["en", "tr"]);
    const updatedLocalizationSettings = await fetch(
      `${bound.issuer}/api/admin/settings/localization`,
      {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          internationalizationEnabled: true,
          defaultLocale: "tr",
          supportedLocales: ["tr", "en"],
        }),
      },
    ).then((response) => response.json());
    assert.equal(updatedLocalizationSettings.defaultLocale, "tr");
    assert.deepEqual(updatedLocalizationSettings.availableLocales, ["en", "tr"]);

    const initialEmailSettings = await fetch(
      `${bound.issuer}/api/admin/settings/email`,
      { headers: adminHeaders },
    ).then((response) => response.json());
    assert.equal(initialEmailSettings.passwordConfigured, true);
    assert.equal("password" in initialEmailSettings, false);
    const updatedEmailSettings = await fetch(
      `${bound.issuer}/api/admin/settings/email`,
      {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ ...initialEmailSettings, password: "" }),
      },
    ).then((response) => response.json());
    assert.equal(updatedEmailSettings.passwordConfigured, true);
    assert.equal("password" in updatedEmailSettings, false);

    const groups = await fetch(
      `${bound.issuer}/api/admin/groups?page=0&size=10`,
      {
        headers: adminHeaders,
      },
    ).then((response) => response.json());
    assert.equal(groups.content[0].id, 3);
    const candidates = await fetch(
      `${bound.issuer}/api/admin/groups/3/available-users?q=&page=0&size=10&sort=username%2Casc`,
      { headers: adminHeaders },
    ).then((response) => response.json());
    assert.equal(candidates.content[0].username, "fixture-candidate");
    const added = await fetch(`${bound.issuer}/api/admin/groups/3/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ userId: 42 }),
    });
    assert.equal(added.status, 200);
    const members = await fetch(
      `${bound.issuer}/api/admin/groups/3/users?q=&page=0&size=10&sort=username%2Casc`,
      { headers: adminHeaders },
    ).then((response) => response.json());
    assert.equal(
      members.content.some((user) => user.username === "fixture-candidate"),
      true,
    );
  } finally {
    await fixture.close();
  }
});

test("fixture completes a state- and PKCE-bound native social-link callback", async () => {
  const fixture = createFixtureServer();
  const bound = await fixture.listen();
  try {
    const accountToken = await fetch(`${bound.issuer}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: "mobile-account-console" }),
    }).then((response) => response.json());
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const state = randomBytes(24).toString("base64url");
    const start = await fetch(
      `${bound.issuer}/api/account/social-links/google/mobile/start`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accountToken.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state, codeChallenge }),
      },
    ).then((response) => response.json());
    assert.equal(start.state, state);
    const authorization = await fetch(start.authorizationUrl);
    assert.equal(authorization.status, 200);
    const callbackPage = await authorization.text();
    assert.match(callbackPage, /Continue with fixture account/);
    const linkedCallback = callbackPage.match(/href="([^"]+)"/);
    assert.ok(linkedCallback);
    const callbackTarget = new URL(linkedCallback[1].replaceAll("&amp;", "&"));
    assert.equal(callbackTarget.searchParams.get("state"), state);
    const completed = await fetch(
      `${bound.issuer}/api/account/social-links/mobile/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accountToken.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: callbackTarget.searchParams.get("code"),
          codeVerifier,
        }),
      },
    );
    assert.equal(completed.status, 200);
    assert.deepEqual(await completed.json(), { provider: "google", linked: true });
    const links = await fetch(`${bound.issuer}/api/account/social-links`, {
      headers: { Authorization: `Bearer ${accountToken.access_token}` },
    }).then((response) => response.json());
    assert.equal(links[0].linked, true);
  } finally {
    await fixture.close();
  }
});
