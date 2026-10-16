import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const { nativeDialogActionsScript } = require("../dist/ui/native-styles.js");

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
