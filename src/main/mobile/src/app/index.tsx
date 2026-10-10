import { router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";
import { useMobileAuth } from "@/auth/MobileAuthProvider";

export default function HomeScreen() {
  const { dictionary, locale, setLocale } = useLocale();
  const { mode, palette, setMode } = useTheme();
  const { status } = useMobileAuth();

  useEffect(() => {
    if (status === "signed-in") router.replace("/account");
  }, [status]);

  if (status === "loading") {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <ActivityIndicator
          color={palette.primary}
          accessibilityLabel={dictionary.loading}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.content}>
        <BrandMark size={96} />
        <Text style={[styles.brand, { color: palette.text }]}>Kitezh</Text>
        <Text style={[styles.tagline, { color: palette.textMuted }]}>
          {dictionary.appTagline}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dictionary.continue}
          testID="continue-to-sign-in"
          onPress={() => router.push("/sign-in")}
          style={[styles.action, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
            {dictionary.continue}
          </Text>
          <AppIcon name="arrowRight" size={16} color={palette.onPrimary} />
        </Pressable>
        <View style={styles.preferences}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dictionary.language}
            onPress={() => setLocale(locale === "tr" ? "en" : "tr")}
            style={[styles.preference, { borderColor: palette.border }]}
          >
            <AppIcon name="globe" size={14} color={palette.textMuted} />
            <Text style={{ color: palette.text }}>
              {locale === "tr" ? "TR" : "EN"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dictionary.theme}
            onPress={() => setMode(mode === "dark" ? "light" : "dark")}
            style={[styles.preference, { borderColor: palette.border }]}
          >
            <AppIcon
              name={mode === "dark" ? "sun" : "moon"}
              size={14}
              color={palette.textMuted}
            />
            <Text style={{ color: palette.text }}>
              {mode === "dark" ? dictionary.light : dictionary.dark}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dictionary.settings}
          onPress={() => router.push("/settings")}
          style={styles.settings}
        >
          <AppIcon name="gear" size={14} color={palette.textMuted} />
          <Text style={{ color: palette.textMuted }}>
            {dictionary.settings}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  brand: { fontSize: 36, fontWeight: "800", marginTop: spacing.lg },
  tagline: {
    fontSize: 17,
    lineHeight: 25,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: "center",
  },
  action: {
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  preferences: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  preference: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  settings: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
