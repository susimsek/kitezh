import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import { StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

import SettingsScreen from "@/app/settings";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { colors } from "@/theme/tokens";

const mockStoredPreferences = new Map<string, string>();

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
    replace: jest.fn(),
  },
}));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/AccountTabBar", () => ({ AccountTabBar: () => null }));
jest.mock("@/auth/MobileAuthProvider", () => ({
  useMobileAuth: () => ({ session: null }),
}));
jest.mock("@/updates/MobileUpdateProvider", () => ({
  useMobileUpdates: () => ({
    checked: false,
    checking: false,
    checkForUpdates: jest.fn(),
    downloadPercent: null,
    error: null,
    installOrOpenUpdate: jest.fn(),
    installing: false,
    installedVersion: "0.1.0",
    permissionRequired: false,
    release: null,
  }),
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
});

it("routes safely when settings has no back stack", async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  renderSettings();
  fireEvent.press(await screen.findByRole("button", { name: "Back" }));
  expect(router.replace).toHaveBeenCalledWith("/");
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
