import assert from "node:assert/strict";
import test from "node:test";

import { renderDesktopCompanionHtml } from "../dist/companion-window.js";

function render(language) {
  return renderDesktopCompanionHtml({
    appName: "Kitezh",
    iconDataUrl: "data:image/png;base64,aW1hZ2U=",
    language,
    themeCss: ":root { color-scheme: dark; }",
  });
}

test("companion window renders English console actions with theme and logo", () => {
  const html = render("en");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Kitezh<\/title>/);
  assert.match(html, /CONTINUE SECURELY/);
  assert.match(html, /Account Console/);
  assert.match(html, /Admin Console/);
  assert.match(html, /data:image\/png;base64,aW1hZ2U=/);
  assert.match(html, /color-scheme: dark/);
  assert.match(html, /window\.desktopApi\.companion\.openConsole/);
  assert.match(html, /event\.key === "Escape"/);
});

test("companion window localizes console actions and async state in Turkish", () => {
  const html = render("tr");

  assert.match(html, /<html lang="tr">/);
  assert.match(html, /GÜVENLİ ERİŞİM/);
  assert.match(html, /Hesap Konsolu/);
  assert.match(html, /Yönetim Konsolu/);
  assert.match(html, /Açılıyor/);
  assert.match(html, /aria-busy/);
});
