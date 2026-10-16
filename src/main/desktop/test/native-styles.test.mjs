import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const {
  nativeDialogActionsScript,
  nativeDialogCss,
  nativeDialogVariables,
} = require("../dist/ui/native-styles.js");

test("native dialog variables use the semantic light and dark palettes", () => {
  const light = nativeDialogVariables(false);
  const dark = nativeDialogVariables(true);

  assert.equal(light["--dialog-background"], "#f8f9fa");
  assert.equal(dark["--dialog-background"], "#212529");
  assert.notEqual(light["--dialog-danger"], dark["--dialog-danger"]);
  assert.equal(light["--dialog-on-danger"], "#ffffff");
  assert.equal(dark["--dialog-on-danger"], "#212529");
  assert.match(light["--dialog-control-default"], /^\d+px$/);
  assert.match(dark["--dialog-page-title"], /^\d+px$/);
});

test("native dialog CSS includes accessible responsive and reduced-motion states", () => {
  const lightCss = nativeDialogCss(false);
  const darkCss = nativeDialogCss(true);

  assert.match(lightCss, /color-scheme: light/);
  assert.match(darkCss, /color-scheme: dark/);
  assert.match(lightCss, /:focus-visible/);
  assert.match(lightCss, /@media \(max-width: 520px\)/);
  assert.match(lightCss, /@media \(forced-colors: active\)/);
  assert.match(lightCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(lightCss, /button:disabled/);
  assert.match(lightCss, /\.spinner/);
});

test("native dialog actions preserve labels and block repeated pending actions", () => {
  const dom = new JSDOM(
    `<button data-async onclick="window.requests += 1">Install Update</button>
     <button>Cancel</button>${nativeDialogActionsScript()}`,
    { runScripts: "dangerously" },
  );
  try {
    dom.window.requests = 0;
    const button = dom.window.document.querySelector("button");
    button.click();
    assert.equal(button.textContent, "Install Update");
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(
      button.querySelector(".spinner").getAttribute("aria-hidden"),
      "true",
    );
    assert.ok(
      [...dom.window.document.querySelectorAll("button")].every(
        (action) => action.disabled,
      ),
    );
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(dom.window.requests, 1);
    assert.equal(button.querySelectorAll(".spinner").length, 1);
  } finally {
    dom.window.close();
  }
});
