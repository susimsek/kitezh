import assert from "node:assert/strict";
import test from "node:test";

import { getMobileApiLocale, setMobileApiLocale } from "./api-locale.ts";

test("native API locale follows the active English or Turkish UI locale", () => {
  setMobileApiLocale("tr");
  assert.equal(getMobileApiLocale(), "tr");
  setMobileApiLocale("en");
  assert.equal(getMobileApiLocale(), "en");
});
