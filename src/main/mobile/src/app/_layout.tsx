import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LocaleProvider, useLocale } from "@/i18n/LocaleProvider";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { MobileAuthProvider } from "@/auth/MobileAuthProvider";
import { MobileNoticeProvider } from "@/components/MobileNoticeProvider";

function AppNavigator() {
  const { ready: themeReady, resolvedTheme, palette } = useTheme();
  const { ready: localeReady } = useLocale();
  if (!themeReady || !localeReady) {
    return (
      <SafeAreaView
        style={[styles.loading, { backgroundColor: palette.background }]}
      >
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }
  return (
    <>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <MobileNoticeProvider>
          <MobileAuthProvider>
            <AppNavigator />
          </MobileAuthProvider>
        </MobileNoticeProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
