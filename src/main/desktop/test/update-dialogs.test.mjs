import assert from "node:assert/strict";
import test from "node:test";

import {
  getUpdateAvailableCopy,
  getUpdateCheckingCopy,
  getUpdateConfirmationCopy,
  getUpdateResultCopy,
  renderUpdateAvailableHtml,
  renderUpdateCheckingHtml,
  renderUpdateConfirmationHtml,
  renderUpdateResultHtml,
} from "../dist/update-dialogs.js";

const common = {
  appName: "Kitezh",
  iconDataUrl: "data:image/png;base64,aW1hZ2U=",
  themeCss: ":root { color-scheme: dark; }",
  actionsScript: "<script>window.close()</script>",
};

test("update checking dialog localizes status, cancel action, and theme", () => {
  for (const language of ["en", "tr"]) {
    const copy = getUpdateCheckingCopy(language);
    const html = renderUpdateCheckingHtml({ ...common, ...copy, language });

    assert.match(html, new RegExp(`<html lang="${language}">`));
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data:image\/png;base64,aW1hZ2U=/);
    assert.match(html, /color-scheme: dark/);
    assert.match(html, /window\.close\(\)/);
    assert.match(html, language === "tr" ? /İptal/ : /Cancel/);
  }
});

test("up-to-date dialog localizes version details and completion action", () => {
  for (const language of ["en", "tr"]) {
    const copy = getUpdateResultCopy(language, "Kitezh", "0.1.4");
    const html = renderUpdateResultHtml({ ...common, ...copy, language });

    assert.match(html, new RegExp(`<html lang="${language}">`));
    assert.match(html, /0\.1\.4/);
    assert.match(html, /id="update-result-title"/);
    assert.match(html, /id="update-result-detail"/);
    assert.match(html, /window\.close\(\)/);
    assert.match(html, language === "tr" ? /Tamam/ : /Done/);
  }
});

test("update confirmation dialog localizes safe install messaging and protocol actions", () => {
  for (const language of ["en", "tr"]) {
    const copy = getUpdateConfirmationCopy(language, "Kitezh");
    const html = renderUpdateConfirmationHtml({
      ...common,
      ...copy,
      language,
      desktopProtocol: "kitezh",
    });

    assert.match(html, new RegExp(`<html lang="${language}">`));
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /active local sessions|etkin yerel oturumları/);
    assert.match(html, /kitezh:\/\/update-confirm\/cancel/);
    assert.match(html, /kitezh:\/\/update-confirm\/update/);
    assert.match(html, language === "tr" ? /Güncelle/ : /Update/);
  }
});

test("available update dialog localizes version actions and preserves action routes", () => {
  for (const language of ["en", "tr"]) {
    const copy = getUpdateAvailableCopy(language, "Kitezh", "0.1.5", "0.1.4");
    const html = renderUpdateAvailableHtml({
      ...common,
      ...copy,
      language,
      desktopProtocol: "kitezh",
    });

    assert.match(html, new RegExp(`<html lang="${language}">`));
    assert.match(html, /0\.1\.5/);
    assert.match(html, /0\.1\.4/);
    assert.match(html, /id="automatic" type="checkbox" checked/);
    assert.match(html, /update-action\/skip/);
    assert.match(html, /update-action\/later/);
    assert.match(html, /update-action\/download/);
    assert.match(
      html,
      language === "tr" ? /Bu sürümü atla/ : /Skip This Version/,
    );
  }
});
