import { render, screen } from "@/testing/native-testing-library";
import { StyleSheet, Text } from "react-native";

import { AccountTabBar } from "@/components/AccountTabBar";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/components/AppIcon", () => ({ AppIcon: () => null }));

it("exposes labeled, selected native tabs with readable labels and touch targets", async () => {
  render(
    <ThemeProvider>
      <LocaleProvider>
        <AccountTabBar active="account" />
      </LocaleProvider>
    </ThemeProvider>,
  );

  const tabs = await screen.findAllByRole("tab");
  expect(tabs).toHaveLength(4);
  expect(tabs[0].props.accessibilityState).toEqual({ selected: true });

  for (const tab of tabs) {
    expect(tab.props.accessibilityLabel).toBeTruthy();
    const style = StyleSheet.flatten(
      typeof tab.props.style === "function"
        ? tab.props.style({ pressed: false })
        : tab.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    const label = tab.findByType(Text);
    const labelStyle = StyleSheet.flatten(label.props.style);
    expect(label.props.allowFontScaling).toBe(true);
    expect(labelStyle.fontSize).toBeGreaterThanOrEqual(13);
  }
});
