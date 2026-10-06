import assert from "node:assert/strict";
import test from "node:test";

import { showDesktopNotification } from "../dist/notifications.js";

test("opens the update dialog when a desktop notification is clicked", () => {
  let clickListener;
  let shown = false;
  let options;
  let clickCount = 0;
  const notification = {
    on(event, listener) {
      assert.equal(event, "click");
      clickListener = listener;
    },
    show() {
      shown = true;
    },
  };

  showDesktopNotification(
    (nextOptions) => {
      options = nextOptions;
      return notification;
    },
    "Kitezh update available",
    "Version 0.1.1 is ready to download.",
    () => {
      clickCount += 1;
    },
  );

  assert.deepEqual(options, {
    title: "Kitezh update available",
    body: "Version 0.1.1 is ready to download.",
  });
  assert.equal(shown, true);
  clickListener();
  assert.equal(clickCount, 1);
});
