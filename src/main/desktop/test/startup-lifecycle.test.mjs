import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDesktopLifecycle } from "../dist/startup-lifecycle.js";

function createLifecycleHarness({ lockGranted = true, ready = Promise.resolve() } = {}) {
  const appHandlers = new Map();
  const processHandlers = new Map();
  const calls = [];
  const app = {
    requestSingleInstanceLock() {
      calls.push("lock");
      return lockGranted;
    },
    quit() {
      calls.push("quit");
    },
    on(event, handler) {
      appHandlers.set(event, handler);
      calls.push(`app:${event}`);
    },
    whenReady() {
      calls.push("ready");
      return ready;
    },
  };
  const process = {
    on(event, handler) {
      processHandlers.set(event, handler);
      calls.push(`process:${event}`);
    },
  };
  const handlers = Object.fromEntries(
    [
      "onSecondInstance",
      "onOpenUrl",
      "onUncaughtException",
      "onUnhandledRejection",
      "onBeforeQuit",
      "onWindowAllClosed",
      "onReady",
      "onStartupFailure",
    ].map((name) => [name, (...args) => calls.push([name, ...args])]),
  );

  return { app, appHandlers, calls, handlers, process, processHandlers };
}

test("quits without registering lifecycle callbacks when the single-instance lock is unavailable", () => {
  const harness = createLifecycleHarness({ lockGranted: false });

  const registered = registerDesktopLifecycle(
    harness.app,
    harness.process,
    harness.handlers,
  );

  assert.equal(registered, false);
  assert.deepEqual(harness.calls, ["lock", "quit"]);
  assert.equal(harness.appHandlers.size, 0);
  assert.equal(harness.processHandlers.size, 0);
});

test("registers desktop lifecycle callbacks and starts once Electron is ready", async () => {
  const harness = createLifecycleHarness();

  const registered = registerDesktopLifecycle(
    harness.app,
    harness.process,
    harness.handlers,
  );
  await Promise.resolve();

  assert.equal(registered, true);
  assert.deepEqual(harness.calls.slice(0, 9), [
    "lock",
    "app:second-instance",
    "app:open-url",
    "ready",
    "process:uncaughtExceptionMonitor",
    "process:unhandledRejection",
    "app:before-quit",
    "app:window-all-closed",
    ["onReady", undefined],
  ]);
});

test("routes ready failures to the startup failure handler", async () => {
  const error = new Error("startup failed");
  const harness = createLifecycleHarness({ ready: Promise.reject(error) });

  registerDesktopLifecycle(harness.app, harness.process, harness.handlers);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(harness.calls.at(-1), ["onStartupFailure", error]);
});

test("keeps registered process and app handlers connected to their injected callbacks", () => {
  const harness = createLifecycleHarness();
  registerDesktopLifecycle(harness.app, harness.process, harness.handlers);

  const secondInstance = [ {}, ["kitezh", "kitezh://callback"] ];
  harness.appHandlers.get("second-instance")(...secondInstance);
  const uncaught = new Error("uncaught");
  harness.processHandlers.get("uncaughtExceptionMonitor")(uncaught);
  harness.appHandlers.get("before-quit")();

  assert.deepEqual(harness.calls.slice(-3), [
    ["onSecondInstance", ...secondInstance],
    ["onUncaughtException", uncaught],
    ["onBeforeQuit"],
  ]);
});
