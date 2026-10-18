import assert from "node:assert/strict";
import test from "node:test";

import {
  invalidateSessionOperations,
  isSessionOperationCurrent,
  runSessionStorageMutation,
  sessionOperationGeneration,
  sessionRefreshCoordinator,
} from "./session-operations.ts";
import { parseSessionRecord } from "./session-record.ts";

test("refreshes are single-flight per session namespace", async () => {
  const coordinator = sessionRefreshCoordinator("account");
  let calls = 0;
  let finish: ((value: null) => void) | undefined;
  const operation = () => {
    calls += 1;
    return new Promise<null>((resolve) => {
      finish = resolve;
    });
  };

  const first = coordinator.run(operation);
  const second = coordinator.run(operation);
  assert.equal(calls, 1);
  finish?.(null);
  assert.equal(await first, null);
  assert.equal(await second, null);
  assert.equal(sessionRefreshCoordinator("account"), coordinator);
  assert.notEqual(coordinator, sessionRefreshCoordinator("admin"));
});

test("queued SecureStore writes skip stale session generations", async () => {
  const generation = sessionOperationGeneration("account");
  let release: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const first = runSessionStorageMutation("account", () => {
    markStarted?.();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const staleMutation = runSessionStorageMutation(
    "account",
    async () => "stale-write",
    generation,
  );
  await started;
  invalidateSessionOperations("account");
  release?.();
  await first;
  assert.equal(await staleMutation, undefined);
});

test("session mutations stay isolated across console namespaces", async () => {
  const generation = sessionOperationGeneration("admin");
  const results = await Promise.all([
    runSessionStorageMutation("account", async () => "account"),
    runSessionStorageMutation("admin", async () => "admin", generation),
  ]);
  assert.deepEqual(results, ["account", "admin"]);
});

test("logout invalidates pending session mutations", () => {
  const generation = sessionOperationGeneration("admin");
  const accountGeneration = sessionOperationGeneration("account");
  assert.equal(isSessionOperationCurrent("admin", generation), true);
  invalidateSessionOperations("admin");
  assert.equal(isSessionOperationCurrent("admin", generation), false);
  assert.equal(isSessionOperationCurrent("account", accountGeneration), true);
});

test("SecureStore records migrate legacy sessions and reject cross-console records", () => {
  const legacy = JSON.stringify({
    accessToken: "access",
    refreshToken: "refresh",
    idToken: null,
    expiresAt: 1000,
  });
  const current = JSON.stringify({
    version: 1,
    namespace: "account",
    accessToken: "access",
    refreshToken: null,
    idToken: null,
    expiresAt: 1000,
  });
  const wrongNamespace = JSON.stringify({
    version: 1,
    namespace: "admin",
    accessToken: "access",
    expiresAt: 1000,
  });

  assert.deepEqual(parseSessionRecord(legacy, "account"), {
    accessToken: "access",
    refreshToken: "refresh",
    idToken: null,
    expiresAt: 1000,
  });
  assert.deepEqual(parseSessionRecord(current, "account"), {
    accessToken: "access",
    refreshToken: null,
    idToken: null,
    expiresAt: 1000,
  });
  assert.equal(parseSessionRecord(wrongNamespace, "account"), null);
  assert.equal(parseSessionRecord("{bad", "account"), null);
});
