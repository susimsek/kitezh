import assert from "node:assert/strict";
import test from "node:test";

import { createApplicationMenuTemplate } from "../dist/application-menu.js";

function createMenu({
  language = "en",
  platform = "linux",
  devToolsEnabled = false,
} = {}) {
  const calls = [];
  const actions = Object.fromEntries(
    [
      "about",
      "settings",
      "checkForUpdates",
      "logout",
      "quickAccess",
      "toggleDeveloperTools",
    ].map((name) => [name, () => calls.push(name)]),
  );
  return {
    calls,
    menu: createApplicationMenuTemplate({
      appName: "Kitezh",
      language,
      platform,
      devToolsEnabled,
      actions,
    }),
  };
}

function findMenu(menu, label) {
  return menu.find((item) => item.label === label);
}

test("application menu localizes user actions and routes each callback", () => {
  const { menu, calls } = createMenu({ language: "tr" });
  const appMenu = findMenu(menu, "Kitezh");
  const appItems = appMenu.submenu.filter((item) => item.label);
  const settingsItem = appItems.find((item) => item.label === "Ayarlar…");
  const updateItem = appItems.find(
    (item) => item.label === "Güncellemeleri denetle…",
  );
  const logoutItem = appItems.find((item) => item.id === "desktop-logout");
  const viewMenu = findMenu(menu, "Görünüm");
  const quickAccessItem = viewMenu.submenu.find(
    (item) => item.label === "Hızlı erişim…",
  );

  assert.equal(appItems[0].label, "Kitezh hakkında");
  assert.equal(findMenu(menu, "Düzenle").label, "Düzenle");
  assert.equal(findMenu(menu, "Pencere").label, "Pencere");
  settingsItem.click();
  updateItem.click();
  logoutItem.click();
  quickAccessItem.click();
  assert.deepEqual(calls, [
    "settings",
    "checkForUpdates",
    "logout",
    "quickAccess",
  ]);
});

test("macOS adds bring-all-to-front while other platforms omit it", () => {
  const mac = createMenu({ language: "en", platform: "darwin" }).menu;
  const turkishMac = createMenu({ language: "tr", platform: "darwin" }).menu;
  const windows = createMenu({ language: "en", platform: "win32" }).menu;

  assert.ok(
    findMenu(mac, "Window").submenu.some((item) => item.role === "front"),
  );
  assert.equal(
    findMenu(turkishMac, "Pencere").submenu.at(-1).label,
    "Tümünü öne getir",
  );
  assert.ok(
    !findMenu(windows, "Window").submenu.some((item) => item.role === "front"),
  );
  assert.equal(
    findMenu(mac, "Window").submenu.at(-1).label,
    "Bring All to Front",
  );
});

test("developer tools menu entry is present only when explicitly enabled", () => {
  const enabled = createMenu({ devToolsEnabled: true });
  const turkish = createMenu({ language: "tr", devToolsEnabled: true });
  const disabled = createMenu({ devToolsEnabled: false });
  const enabledView = findMenu(enabled.menu, "View").submenu;
  const turkishView = findMenu(turkish.menu, "Görünüm").submenu;
  const disabledView = findMenu(disabled.menu, "View").submenu;

  const developerToolsItem = enabledView.find(
    (item) => item.label === "Toggle Developer Tools",
  );
  assert.ok(developerToolsItem);
  assert.ok(
    !disabledView.some((item) => item.label === "Toggle Developer Tools"),
  );
  assert.ok(
    turkishView.some(
      (item) => item.label === "Geliştirici araçlarını aç/kapat",
    ),
  );
  developerToolsItem.click();
  assert.deepEqual(enabled.calls, ["toggleDeveloperTools"]);
});
