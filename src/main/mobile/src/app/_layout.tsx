import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function AppNavigator() {
  const { resolvedTheme } = useTheme();
  return (
    <>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppNavigator />
      </LocaleProvider>
    </ThemeProvider>
  );
}
