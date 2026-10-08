import assert from "node:assert/strict";
import test from "node:test";

import { messages, resolveLocale } from "../../shared/src/i18n.ts";
import { colors, resolveTheme } from "../../shared/src/theme.ts";
import {
  DEFAULT_NOTICE_DURATION_MS,
  normalizeNoticeDuration,
} from "./notifications/notice.ts";
import type {
  ConsoleName,
  DesktopLanguageMode,
  SocialProviderAvailability,
} from "../../shared/src/contracts.ts";

test("system locale resolves to the device language when supported", () => {
  assert.equal(resolveLocale("system", "tr-TR"), "tr");
  assert.equal(resolveLocale("system", "en-US"), "en");
  assert.equal(resolveLocale("en", "tr-TR"), "en");
});

test("theme resolver returns semantic palettes for every mode", () => {
  assert.equal(resolveTheme("dark", "light"), "dark");
  assert.equal(resolveTheme("system", "dark"), "dark");
  assert.ok(colors.light.primary);
  assert.ok(colors.dark.primary);
  assert.equal(messages.tr.signIn, "Giriş yap");
});

test("native contracts stay platform-neutral", () => {
  const consoleName: ConsoleName = "account";
  const languageMode: DesktopLanguageMode = "system";
  const provider: SocialProviderAvailability = {
    configured: true,
    iconKey: "google",
    provider: "google",
    providerType: "google",
  };

  assert.equal(consoleName, "account");
  assert.equal(languageMode, "system");
  assert.equal(provider.configured, true);
});

test("mobile notices use a bounded auto-dismiss duration", () => {
  assert.equal(normalizeNoticeDuration(), DEFAULT_NOTICE_DURATION_MS);
  assert.equal(normalizeNoticeDuration(500), 1_000);
  assert.equal(normalizeNoticeDuration(60_000), 10_000);
});
