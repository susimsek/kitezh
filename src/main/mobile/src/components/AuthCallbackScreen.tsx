import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  MobileAuthProvider,
  useMobileAuth,
} from "@/auth/MobileAuthProvider";
import { BrandMark } from "@/components/BrandMark";
import type { MobileConsole } from "@/config";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";

type AuthCallbackScreenProps = {
  consoleName?: MobileConsole;
};

function AuthCallbackContent({
  consoleName = "account",
}: AuthCallbackScreenProps) {
  const { status } = useMobileAuth();
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const destination = consoleName === "admin" ? "/admin" : "/account";

  useEffect(() => {
    if (status === "signed-in") {
      router.replace(destination);
      return;
    }
    if (status === "error") {
      router.replace("/sign-in");
      return;
    }
    if (status !== "signed-out") return;

    // The provider first loads SecureStore while the browser callback is
    // being delivered. Do not discard an in-flight PKCE result during that
    // brief signed-out state; only return to sign-in if no exchange completes.
    const timeout = setTimeout(() => {
      router.replace(consoleName === "admin" ? "/admin" : "/sign-in");
    }, 15_000);
    return () => clearTimeout(timeout);
  }, [consoleName, destination, status]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
    >
      <BrandMark size={72} />
      <ActivityIndicator
        color={palette.primary}
        accessibilityLabel={dictionary.loading}
      />
      <Text style={[styles.label, { color: palette.textMuted }]}>
        {dictionary.loading}
      </Text>
    </SafeAreaView>
  );
}

export function AccountAuthCallbackScreen() {
  return <AuthCallbackContent />;
}

export function AdminAuthCallbackScreen() {
  return (
    <MobileAuthProvider consoleName="admin">
      <AuthCallbackContent consoleName="admin" />
    </MobileAuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  label: { fontSize: 14 },
});
