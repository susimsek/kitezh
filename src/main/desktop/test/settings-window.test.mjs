import assert from "node:assert/strict";
import test from "node:test";

import { renderDesktopSettingsHtml } from "../dist/settings-window.js";

const themeCss = ":root { color-scheme: light; }";

function render(language, platform = "linux", themeSource = "system") {
  return renderDesktopSettingsHtml({
    language,
    platform,
    themeSource,
    themeCss,
  });
}

test("settings window renders English controls and injects the active theme", () => {
  const html = render("en", "linux", "dark");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Settings<\/title>/);
  assert.match(html, /Show in the menu bar/);
  assert.match(html, /value='dark'/);
  assert.match(html, /:root \{ color-scheme: light; \}/);
  assert.doesNotMatch(
    html,
    /<label class="setting-row"><span>Show in the Dock<\/span>/,
  );
});

test("settings window renders Turkish labels and the macOS Dock preference", () => {
  const html = render("tr", "darwin", "light");

  assert.match(html, /<html lang="tr">/);
  assert.match(html, /<title>Ayarlar<\/title>/);
  assert.match(html, /<span>Görünüm<\/span>/);
  assert.match(html, /<label class="setting-row"><span>Dock’ta göster<\/span>/);
  assert.match(html, /value='light'/);
  assert.match(html, /Güncellemeleri denetle/);
});

test("settings window keeps the Dock preference hidden on non-macOS systems", () => {
  const html = render("en", "win32");

  assert.match(html, /Launch Kitezh at login/);
  assert.match(html, /Reset to defaults/);
  assert.doesNotMatch(
    html,
    /<label class="setting-row"><span>Show in the Dock<\/span>/,
  );
});
