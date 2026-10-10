import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type AccountTab = "account" | "security" | "applications" | "settings";

const tabs = [
  { icon: "home", route: "/account", key: "account" },
  { icon: "shield", route: "/security", key: "security" },
  { icon: "globe", route: "/applications", key: "applications" },
  { icon: "gear", route: "/settings", key: "settings" },
] as const;

export function AccountTabBar({ active }: { active: AccountTab }) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const labels: Record<AccountTab, string> = {
    account: dictionary.accountTitle,
    security: dictionary.security,
    applications: dictionary.applications,
    settings: dictionary.settings,
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            accessibilityLabel={labels[tab.key]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => {
              if (!selected) router.replace(tab.route);
            }}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: selected
                  ? palette.surfaceMuted
                  : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppIcon
              color={selected ? palette.primary : palette.textMuted}
              name={tab.icon}
              size={17}
            />
            <Text
              numberOfLines={1}
              style={{
                color: selected ? palette.primary : palette.textMuted,
                fontSize: 12,
                fontWeight: selected ? "700" : "500",
              }}
            >
              {labels[tab.key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  tab: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing.xs,
  },
});
