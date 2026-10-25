import assert from "node:assert/strict";
import test from "node:test";

import { renderDesktopLoginHtml } from "../dist/login-window.js";

function render(language) {
  return renderDesktopLoginHtml({
    appName: "Kitezh",
    iconDataUrl: "data:image/png;base64,aW1hZ2U=",
    language,
    themeCss: ":root { color-scheme: dark; }",
  });
}

test("login window renders the English secure console choice flow", () => {
  const html = render("en");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Kitezh<\/title>/);
  assert.match(html, /data:image\/png;base64,aW1hZ2U=/);
  assert.match(html, /Continue securely/);
  assert.match(html, /Sign in to Admin Console/);
  assert.match(html, /Sign in to Account Console/);
  assert.match(html, /Your password stays in the browser/);
  assert.match(html, /color-scheme: dark/);
  assert.match(html, /window\.desktopApi\.auth\.openConsole/);
});

test("login window localizes safe sign-in and failure states in Turkish", () => {
  const html = render("tr");

  assert.match(html, /<html lang="tr">/);
  assert.match(html, /Güvenli şekilde devam edin/);
  assert.match(html, /Bir konsol seçin/);
  assert.match(html, /Admin Console’a giriş yap/);
  assert.match(html, /Account Console’a giriş yap/);
  assert.match(html, /Parolanız tarayıcıda kalır/);
  assert.match(html, /Güvenli oturum açma başlatılamadı/);
  assert.match(html, /Tarayıcı açılıyor/);
});
