import { ActivityIndicator } from "react-native";

import { render, screen } from "@/testing/native-testing-library";
import RootLayout from "@/app/_layout";

let mockThemeReady = true;
let mockThemeName: "light" | "dark" = "light";
let mockLocaleReady = true;

jest.mock("expo-router", () => ({
  Stack: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "route-stack" });
  },
}));
jest.mock("expo-status-bar", () => ({
  StatusBar: ({ style }: { style: string }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: `status-bar-${style}` });
  },
}));
jest.mock("@/theme/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    ready: mockThemeReady,
    resolvedTheme: mockThemeName,
    palette: { background: "background", primary: "primary" },
  }),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  useLocale: () => ({ ready: mockLocaleReady }),
}));
jest.mock("@/components/MobileNoticeProvider", () => ({
  MobileNoticeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/updates/MobileUpdateProvider", () => ({
  MobileUpdateProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/auth/MobileAuthProvider", () => ({
  MobileAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  mockThemeReady = true;
  mockThemeName = "light";
  mockLocaleReady = true;
});

test("shows the loading surface until theme and locale are ready", () => {
  mockThemeReady = false;

  render(<RootLayout />);

  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByTestId("route-stack")).toBeNull();
});

test.each([
  ["light", "dark"],
  ["dark", "light"],
] as const)("configures status bar for %s theme", (theme, statusBarStyle) => {
  mockThemeName = theme;

  render(<RootLayout />);

  expect(screen.getByTestId(`status-bar-${statusBarStyle}`)).toBeTruthy();
  expect(screen.getByTestId("route-stack")).toBeTruthy();
});
