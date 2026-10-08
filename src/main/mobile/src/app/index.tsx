import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function HomeScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <View style={[styles.logo, { backgroundColor: palette.primary }]}>
          <AppIcon name="shield" size={44} color={palette.onPrimary} />
        </View>
        <Text style={[styles.brand, { color: palette.text }]}>Kitezh</Text>
        <Text style={[styles.tagline, { color: palette.textMuted }]}>{dictionary.appTagline}</Text>
        <Text style={[styles.preview, { color: palette.primary }]}>{dictionary.mobilePreview}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dictionary.continue}
          onPress={() => router.push("/sign-in")}
          style={[styles.action, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>{dictionary.continue}</Text>
          <AppIcon name="arrowRight" size={16} color={palette.onPrimary} />
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
  logo: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  brand: { fontSize: 36, fontWeight: "800", marginTop: spacing.lg },
  tagline: { fontSize: 17, lineHeight: 25, marginTop: spacing.sm, maxWidth: 320, textAlign: "center" },
  preview: { fontSize: 14, fontWeight: "700", marginTop: spacing.xl, textTransform: "uppercase" },
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
});
