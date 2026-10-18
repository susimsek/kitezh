import assert from "node:assert/strict";
import test from "node:test";

import { createNativeCaptchaToken } from "./native-captcha.ts";

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
