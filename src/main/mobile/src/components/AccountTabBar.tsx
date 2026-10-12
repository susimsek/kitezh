import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "@/components/AppIcon";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { controlSizes, radii, spacing } from "@/theme/tokens";

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
                backgroundColor: selected && Platform.OS === "android"
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
              allowFontScaling
              style={{
                color: selected ? palette.primary : palette.textMuted,
                fontSize: Platform.OS === "ios" ? 11 : 12,
                fontWeight: selected ? "700" : "500",
                textAlign: "center",
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
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  tab: {
    alignItems: "center",
    borderRadius: Platform.OS === "android" ? radii.pill : radii.sm,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: controlSizes.mobile,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
