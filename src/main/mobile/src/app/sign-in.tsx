import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";

export default function SignInScreen() {
  const { dictionary } = useLocale();
  const { palette } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <AppIcon name="arrowRight" size={18} color={palette.text} style={{ transform: [{ rotate: "180deg" }] }} />
        </Pressable>
        <AppIcon name="shield" size={48} color={palette.primary} />
        <Text style={[styles.title, { color: palette.text }]}>Kitezh</Text>
        <Text style={[styles.message, { color: palette.textMuted }]}>{dictionary.appTagline}</Text>
        <Text style={[styles.note, { color: palette.textMuted }]}>OAuth/PKCE mobile sign-in will be connected after the mobile client is registered.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  back: { alignSelf: "flex-start", padding: spacing.sm, position: "absolute", top: spacing.sm, left: spacing.md },
  title: { fontSize: 30, fontWeight: "800", marginTop: spacing.md },
  message: { fontSize: 16, lineHeight: 24, marginTop: spacing.sm, textAlign: "center" },
  note: { fontSize: 13, lineHeight: 20, marginTop: spacing.xl, maxWidth: 320, textAlign: "center" },
});
