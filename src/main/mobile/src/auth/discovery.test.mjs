import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchNativeAuthorizationDiscovery,
  NativeDiscoveryError,
} from "./discovery.ts";

const validMetadata = {
  issuer: "https://issuer.example.test",
  authorization_endpoint: "https://issuer.example.test/authorize",
  token_endpoint: "https://issuer.example.test/token",
  end_session_endpoint: "https://issuer.example.test/logout",
};

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

test("maps OIDC discovery metadata to the native auth session contract", async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return response(validMetadata);
  };
  const discovery = await fetchNativeAuthorizationDiscovery(
    "https://issuer.example.test",
    { fetchImpl },
  );

  assert.equal(
    calls[0][0],
    "https://issuer.example.test/.well-known/openid-configuration",
  );
  assert.deepEqual(calls[0][1].headers, { Accept: "application/json" });
  assert.equal(
    discovery.authorizationEndpoint,
    validMetadata.authorization_endpoint,
  );
  assert.equal(discovery.tokenEndpoint, validMetadata.token_endpoint);
  assert.equal(discovery.endSessionEndpoint, validMetadata.end_session_endpoint);
  assert.equal(discovery["discoveryDocument"].issuer, validMetadata.issuer);
});

test("rejects non-success discovery responses without exposing response data", async () => {
  await assert.rejects(
    fetchNativeAuthorizationDiscovery("https://issuer.example.test", {
      fetchImpl: async () => response({ token: "do-not-leak" }, 503),
    }),
    (error) =>
      error instanceof NativeDiscoveryError &&
      error.kind === "unavailable" &&
      error.message === "unavailable",
  );
});

test("rejects malformed discovery metadata", async () => {
  await assert.rejects(
    fetchNativeAuthorizationDiscovery("https://issuer.example.test", {
      fetchImpl: async () => response({ issuer: validMetadata.issuer }),
    }),
    (error) => error instanceof NativeDiscoveryError && error.kind === "invalid",
  );
});

test("bounds discovery time even when the transport ignores abort", async () => {
  await assert.rejects(
    fetchNativeAuthorizationDiscovery("https://issuer.example.test", {
      timeoutMs: 5,
      fetchImpl: () => new Promise(() => undefined),
    }),
    (error) => error instanceof NativeDiscoveryError && error.kind === "timeout",
  );
});

test("bounds discovery time while the response body is still being read", async () => {
  await assert.rejects(
    fetchNativeAuthorizationDiscovery("https://issuer.example.test", {
      timeoutMs: 5,
      fetchImpl: async () => ({
        ok: true,
        json: () => new Promise(() => undefined),
      }),
    }),
    (error) => error instanceof NativeDiscoveryError && error.kind === "timeout",
  );
});
