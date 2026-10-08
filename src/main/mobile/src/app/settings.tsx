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
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const { dictionary, locale, reset: resetLocale, setLocale } = useLocale();
  const { mode, palette, reset: resetTheme, setMode } = useTheme();
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={dictionary.back}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}
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

        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {dictionary.language}
        </Text>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
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

        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {dictionary.appearance}
        </Text>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
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
            { borderColor: palette.border, opacity: resetting ? 0.6 : 1 },
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
    </SafeAreaView>
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
  content: { padding: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", minHeight: 48 },
  back: { padding: spacing.sm },
  title: { fontSize: 28, fontWeight: "800", marginLeft: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: spacing.xl },
  card: {
    borderRadius: radii.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", paddingVertical: spacing.md },
  option: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
  },
  optionLabel: { fontSize: 16 },
  radio: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioDot: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  reset: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xl,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
});
