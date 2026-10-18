import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeCaptchaToken,
  NATIVE_CAPTCHA_TIMEOUT_MS,
} from "./native-captcha.ts";

test("native CAPTCHA executes the configured action with the platform key", async () => {
  const requests: { siteKey: string; action: string }[] = [];
  const sdk = {
    Recaptcha: {
      async fetchClient(siteKey: string) {
        return {
          async execute(action: { action: string }) {
            requests.push({ siteKey, action: action.action });
            return "short-lived-token";
          },
        };
      },
    },
    RecaptchaAction: { custom: (action: string) => ({ action }) },
  };

  assert.equal(
    await createNativeCaptchaToken("android-mobile-key", "login", sdk),
    "short-lived-token",
  );
  assert.deepEqual(requests, [
    { siteKey: "android-mobile-key", action: "login" },
  ]);
});

test("native CAPTCHA rejects invalid action and empty token", async () => {
  const sdk = {
    Recaptcha: {
      async fetchClient() {
        return { execute: async () => "" };
      },
    },
    RecaptchaAction: { custom: (action: string) => ({ action }) },
  };

  await assert.rejects(createNativeCaptchaToken("site-key", "invalid action", sdk));
  await assert.rejects(createNativeCaptchaToken("site-key", "login", sdk));
});

test("native CAPTCHA times out and drops the cached client for a retry", async () => {
  let fetchCount = 0;
  const sdk = {
    Recaptcha: {
      async fetchClient() {
        fetchCount += 1;
        return {
          execute: async () =>
            fetchCount === 1 ? new Promise<string>(() => {}) : "retry-token",
        };
      },
    },
    RecaptchaAction: { custom: (action: string) => ({ action }) },
  };

  assert.equal(NATIVE_CAPTCHA_TIMEOUT_MS, 20_000);
  await assert.rejects(
    createNativeCaptchaToken("timeout-retry-key", "login", sdk, 5),
    { message: "native_captcha_timeout" },
  );
  assert.equal(
    await createNativeCaptchaToken("timeout-retry-key", "login", sdk),
    "retry-token",
  );
  assert.equal(fetchCount, 2);
});
