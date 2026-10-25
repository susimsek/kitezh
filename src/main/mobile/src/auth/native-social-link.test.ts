import assert from "node:assert/strict";
import test from "node:test";

import {
  isTrustedSocialLinkAuthorizationUrl,
  NATIVE_SOCIAL_LINK_REDIRECT_URI,
  parseNativeSocialLinkCallback,
} from "./native-social-link.ts";

const state = "state-value-that-is-long-enough";
const code = "completion_code-value-012345678901234567890";

test("accepts authorization URLs only from the configured issuer", () => {
  assert.equal(
    isTrustedSocialLinkAuthorizationUrl(
      "https://kitezh.onrender.com/account/social-links/github/desktop/authorize?transaction=opaque",
      "https://kitezh.onrender.com",
    ),
    true,
  );
  assert.equal(
    isTrustedSocialLinkAuthorizationUrl(
      "https://attacker.example/authorize",
      "https://kitezh.onrender.com",
    ),
    false,
  );
  assert.equal(
    isTrustedSocialLinkAuthorizationUrl(
      "http://kitezh.onrender.com/authorize",
      "https://kitezh.onrender.com",
    ),
    false,
  );
});

test("accepts a matching native callback and rejects malformed or mismatched callbacks", () => {
  assert.deepEqual(
    parseNativeSocialLinkCallback(
      `${NATIVE_SOCIAL_LINK_REDIRECT_URI}?state=${state}&code=${code}`,
      state,
    ),
    { state, code, error: null },
  );
  assert.equal(
    parseNativeSocialLinkCallback(
      `${NATIVE_SOCIAL_LINK_REDIRECT_URI}?state=other&code=${code}`,
      state,
    ),
    null,
  );
  assert.equal(
    parseNativeSocialLinkCallback(
      `${NATIVE_SOCIAL_LINK_REDIRECT_URI}?state=${state}&code=${code}&error=failed`,
      state,
    ),
    null,
  );
  assert.equal(
    parseNativeSocialLinkCallback(
      `${NATIVE_SOCIAL_LINK_REDIRECT_URI}?state=${state}&code=${code}#fragment`,
      state,
    ),
    null,
  );
});
