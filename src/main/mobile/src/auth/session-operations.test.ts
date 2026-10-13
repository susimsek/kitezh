import assert from "node:assert/strict";
import test from "node:test";

import {
  invalidateSessionOperations,
  isSessionOperationCurrent,
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
  assert.notEqual(sessionRefreshCoordinator("account"), sessionRefreshCoordinator("admin"));
});

test("logout invalidates pending session mutations", () => {
  const generation = sessionOperationGeneration("admin");
  assert.equal(isSessionOperationCurrent("admin", generation), true);
  invalidateSessionOperations("admin");
  assert.equal(isSessionOperationCurrent("admin", generation), false);
  assert.equal(isSessionOperationCurrent("account", generation), true);
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
