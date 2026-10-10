import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/AppIcon";
import { AccountTabBar } from "@/components/AccountTabBar";
import { useMobileAuth } from "@/auth/MobileAuthProvider";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const { dictionary, locale, reset: resetLocale, setLocale } = useLocale();
  const { mode, palette, reset: resetTheme, setMode } = useTheme();
  const { session } = useMobileAuth();
  const [resetting, setResetting] = useState(false);

  const resetDefaults = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await Promise.all([resetLocale(), resetTheme()]);
    } catch {
      // Keep the native settings screen usable when secure storage is unavailable.
    } finally {
      setResetting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel={dictionary.back}
              accessibilityRole="button"
              onPress={() => router.back()}
              style={[styles.back, { backgroundColor: palette.surfaceMuted }]}
            >
              <AppIcon
                name="arrowRight"
                size={18}
                color={palette.text}
                style={{ transform: [{ rotate: "180deg" }] }}
              />
            </Pressable>
            <Text style={[styles.title, { color: palette.text }]}>
              {dictionary.settingsTitle}
            </Text>
          </View>

          <SectionHeading
            icon="globe"
            label={dictionary.language}
            palette={palette}
          />
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.textMuted }]}>
              {dictionary.systemLanguage}
            </Text>
            <Option
              label={dictionary.system}
              selected={locale === "system"}
              onPress={() => setLocale("system")}
              palette={palette}
            />
            <Option
              label={dictionary.english}
              selected={locale === "en"}
              onPress={() => setLocale("en")}
              palette={palette}
            />
            <Option
              label={dictionary.turkish}
              selected={locale === "tr"}
              onPress={() => setLocale("tr")}
              palette={palette}
            />
          </View>

          <SectionHeading
            icon="sun"
            label={dictionary.appearance}
            palette={palette}
          />
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.textMuted }]}>
              {dictionary.theme}
            </Text>
            <Option
              label={dictionary.system}
              selected={mode === "system"}
              onPress={() => setMode("system")}
              palette={palette}
            />
            <Option
              label={dictionary.light}
              selected={mode === "light"}
              onPress={() => setMode("light")}
              palette={palette}
            />
            <Option
              label={dictionary.dark}
              selected={mode === "dark"}
              onPress={() => setMode("dark")}
              palette={palette}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: resetting }}
            disabled={resetting}
            onPress={() => void resetDefaults()}
            style={[
              styles.reset,
              {
                backgroundColor: palette.surfaceMuted,
                borderColor: palette.border,
                opacity: resetting ? 0.6 : 1,
              },
            ]}
          >
            {resetting ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <AppIcon name="reset" size={16} color={palette.primary} />
            )}
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              {dictionary.resetDefaults}
            </Text>
          </Pressable>
        </ScrollView>
        {session ? <AccountTabBar active="settings" /> : null}
      </View>
    </SafeAreaView>
  );
}

function SectionHeading({
  icon,
  label,
  palette,
}: {
  icon: "globe" | "sun";
  label: string;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View style={styles.sectionHeading}>
      <View
        style={[styles.sectionIcon, { backgroundColor: palette.surfaceMuted }]}
      >
        <AppIcon name={icon} size={15} color={palette.primary} />
      </View>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

function Option({
  label,
  onPress,
  palette,
  selected,
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, { borderTopColor: palette.border }]}
    >
      <Text style={[styles.optionLabel, { color: palette.text }]}>{label}</Text>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? palette.primary : palette.border,
            backgroundColor: selected ? palette.primary : "transparent",
          },
        ]}
      >
        {selected ? (
          <View
            style={[styles.radioDot, { backgroundColor: palette.onPrimary }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  content: { gap: spacing.xs, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  back: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  title: { fontSize: 26, fontWeight: "700" },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionIcon: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  option: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
  },
  optionLabel: { fontSize: 16 },
  radio: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDot: {
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  reset: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
});
