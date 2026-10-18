import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native notifications normalize unknown messages, malformed dates, and unread counts", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path === "/api/admin/notifications/unread-count") return "invalid-count";
      if (path === "/api/admin/notifications?page=0&size=20")
        return {
          content: [
            {
              id: "read-notification",
              messageKey: "unrecognized-message",
              createdAt: 42,
              read: true,
            },
            {
              id: "unread-notification",
              messageKey: "notificationAdminUserRegistered",
              createdAt: "not-a-date",
              read: false,
            },
          ],
          totalElements: 2,
          totalPages: 1,
          number: 0,
        };
      return null;
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="notifications"]').click();
    await settle();

    const feed = document.querySelector('section[aria-label="notificationsTitle"]');
    assert.ok(feed);
    assert.match(feed.textContent, /notificationsUnknown/);
    assert.match(feed.textContent, /notificationRead/);
    assert.match(feed.textContent, /notificationUnread/);
    assert.match(feed.textContent, /: 0/);
    assert.equal(feed.querySelectorAll('[data-action="notification-read"]').length, 1);
    assert.equal(feed.querySelectorAll(".muted")[0].textContent, "");
  } finally {
    harness.restore();
  }
});
