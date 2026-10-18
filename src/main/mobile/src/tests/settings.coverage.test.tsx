import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { AppState, Platform, StyleSheet } from "react-native";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

import SettingsScreen from "@/app/settings";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { colors } from "@/theme/tokens";
import type { MobileRelease } from "@/updates/release-check";

const mockStoredPreferences = new Map<string, string>();
const mockAuth = { session: null as { accessToken: string } | null };
const mockUpdateState = {
  checked: false,
  checking: false,
  checkForUpdates: jest.fn(),
  downloadPercent: null as number | null,
  error: null as "download" | "check" | null,
  installOrOpenUpdate: jest.fn(),
  installing: false,
  installedVersion: "0.1.0",
  permissionRequired: false,
  release: null as MobileRelease | null,
};

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStoredPreferences.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStoredPreferences.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStoredPreferences.delete(key);
  }),
}));
jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/AccountTabBar", () => ({ AccountTabBar: () => null }));
jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => mockAuth,
}));
jest.mock("@/updates/MobileUpdateProvider", () => ({
  useMobileUpdates: () => mockUpdateState,
}));

function renderSettings() {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <SettingsScreen />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockStoredPreferences.clear();
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation(() => ({ remove: jest.fn() }));
  mockAuth.session = null;
  Object.assign(mockUpdateState, {
    checked: false,
    checking: false,
    downloadPercent: null,
    error: null,
    installing: false,
    installedVersion: "0.1.0",
    permissionRequired: false,
    release: null,
  });
});

it("routes safely when settings has no back stack", async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  renderSettings();
  fireEvent.press(await screen.findByRole("button", { name: "Back" }));
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("shows signed-in notifications and returns to the account when there is no back stack", async () => {
  mockAuth.session = { accessToken: "access" };
  jest.mocked(router.canGoBack).mockReturnValue(false);
  renderSettings();

  fireEvent.press(await screen.findByRole("button", { name: "Back" }));
  fireEvent.press(screen.getByTestId("settings-notifications"));

  expect(router.replace).toHaveBeenCalledWith("/account");
  expect(router.push).toHaveBeenCalledWith("/notifications");
});

it("updates locale and theme immediately, exposes native radio state, and restores saved preferences", async () => {
  const firstRender = renderSettings();
  expect(await screen.findByText("Settings")).toBeTruthy();
  expect(screen.getByTestId("settings-locale-system").props.accessibilityState)
    .toEqual({ selected: true });

  fireEvent.press(screen.getByTestId("settings-locale-turkish"));
  expect(await screen.findByText("Ayarlar")).toBeTruthy();
  fireEvent.press(screen.getByTestId("settings-theme-dark"));
  await waitFor(() =>
    expect(
      StyleSheet.flatten(screen.getByTestId("settings-screen").props.style)
        .backgroundColor,
    ).toBe(colors.dark.background),
  );

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.locale",
    "tr",
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.theme",
    "dark",
  );
  firstRender.unmount();

  renderSettings();
  expect(await screen.findByText("Ayarlar")).toBeTruthy();
  expect(screen.getByTestId("settings-locale-turkish").props.accessibilityState)
    .toEqual({ selected: true });
  expect(screen.getByTestId("settings-theme-dark").props.accessibilityState)
    .toEqual({ selected: true });
  expect(
    StyleSheet.flatten(screen.getByTestId("settings-screen").props.style)
      .backgroundColor,
  ).toBe(colors.dark.background);
});

it("resets the saved locale and theme back to system preferences", async () => {
  mockStoredPreferences.set("kitezh.mobile.locale", "tr");
  mockStoredPreferences.set("kitezh.mobile.theme", "dark");
  renderSettings();

  expect(await screen.findByText("Ayarlar")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Varsayılanlara dön" }));

  expect(await screen.findByText("Settings")).toBeTruthy();
  await waitFor(() => {
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kitezh.mobile.locale");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kitezh.mobile.theme");
  });
  expect(screen.getByTestId("settings-locale-system").props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByTestId("settings-theme-system").props.accessibilityState).toEqual({ selected: true });
});

it("keeps settings usable when resetting secure preferences fails", async () => {
  jest.mocked(SecureStore.deleteItemAsync)
    .mockRejectedValueOnce(new Error("locale storage unavailable"))
    .mockRejectedValueOnce(new Error("theme storage unavailable"));
  renderSettings();

  fireEvent.press(await screen.findByRole("button", { name: "Reset to defaults" }));

  expect(await screen.findByText("Settings")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeTruthy(),
  );
});

it("falls back to system preferences when secure storage cannot be read", async () => {
  jest.mocked(SecureStore.getItemAsync)
    .mockRejectedValueOnce(new Error("locale storage unavailable"))
    .mockRejectedValueOnce(new Error("theme storage unavailable"));
  renderSettings();

  expect(await screen.findByText("Settings")).toBeTruthy();
  expect(screen.getByTestId("settings-locale-system").props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByTestId("settings-theme-system").props.accessibilityState).toEqual({ selected: true });
});

it("refreshes the system language when the app becomes active", async () => {
  const originalLocale = Localization.getLocales()[0];
  const getLocales = jest.spyOn(Localization, "getLocales").mockReturnValue([
    { ...originalLocale, languageCode: "tr", languageTag: "tr-TR", regionCode: "TR" },
  ]);
  let onChange: ((state: "active" | "background" | "inactive") => void) | undefined;
  const addListener = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    onChange = listener;
    return { remove: jest.fn() };
  });
  const rendered = renderSettings();
  expect(await screen.findByText("Settings")).toBeTruthy();

  act(() => onChange?.("active"));
  expect(await screen.findByText("Ayarlar")).toBeTruthy();

  rendered.unmount();
  addListener.mockRestore();
  getLocales.mockRestore();
});

it.each([
  ["download progress", { installing: true, downloadPercent: 42 }, "Downloading update: 42%"],
  ["installer permission", { permissionRequired: true }, "Allow Kitezh to install updates, then try again."],
  ["download failure", { error: "download" as const }, "The update could not be downloaded. Try again."],
  ["check failure", { error: "check" as const }, "Could not check for updates. Try again."],
  ["new release", { release: { version: "1.2.0", pageUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.2.0", asset: { name: "kitezh-1.2.0-android.apk", url: "https://github.com/susimsek/kitezh/releases/download/v1.2.0/kitezh-1.2.0-android.apk" } } }, "Version 1.2.0 is available."],
  ["up-to-date state", { checked: true }, "You are using the latest version."],
])("shows the update status for %s", async (_name, state, expected) => {
  Object.assign(mockUpdateState, state);

  renderSettings();

  expect(await screen.findByText(expected)).toBeTruthy();
});

it("shows a busy update action and starts the install flow", async () => {
  mockUpdateState.release = {
    version: "1.2.0",
    pageUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.2.0",
    asset: {
      name: "kitezh-1.2.0-android.apk",
      url: "https://github.com/susimsek/kitezh/releases/download/v1.2.0/kitezh-1.2.0-android.apk",
    },
  };
  mockUpdateState.checking = true;
  mockUpdateState.installOrOpenUpdate.mockResolvedValue(undefined);
  renderSettings();

  const checkButton = screen.getByRole("button", { name: "Check for updates" });
  expect(checkButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
  fireEvent.press(screen.getByRole("button", { name: "View release" }));

  expect(mockUpdateState.installOrOpenUpdate).toHaveBeenCalledTimes(1);
});

it.each([
  ["android", true, "Download and install"],
  ["android", false, "View release"],
  ["ios", true, "View release"],
] as const)(
  "selects the release action for %s with an APK asset=%s",
  async (platform, hasAsset, label) => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: platform,
    });
    mockUpdateState.release = {
      version: "1.2.0",
      pageUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.2.0",
      asset: hasAsset
        ? {
            name: "kitezh-1.2.0-android.apk",
            url: "https://github.com/susimsek/kitezh/releases/download/v1.2.0/kitezh-1.2.0-android.apk",
          }
        : null,
    };

    try {
      renderSettings();
      expect(await screen.findByRole("button", { name: label })).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatform,
      });
    }
  },
);
