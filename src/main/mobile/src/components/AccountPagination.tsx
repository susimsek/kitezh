import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";

export function AccountPagination({
  loading,
  loadingDirection,
  onNext,
  onPrevious,
  page,
}: {
  loading: boolean;
  loadingDirection?: "next" | "previous" | null;
  onNext: () => void;
  onPrevious: () => void;
  page: { number: number; totalPages: number };
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();

  if (page.totalPages <= 1) return null;

  return (
    <View style={styles.container} accessibilityRole="summary">
      <PageButton
        disabled={page.number <= 0}
        label={dictionary.accountPreviousPage}
        loading={loadingDirection === "previous"}
        onPress={onPrevious}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.page, { color: palette.textMuted }]}
      >
        {dictionary.accountPage} {page.number + 1} / {page.totalPages}
      </Text>
      <PageButton
        disabled={page.number + 1 >= page.totalPages}
        label={dictionary.accountNextPage}
        loading={loadingDirection === "next"}
        onPress={onNext}
      />
    </View>
  );
}

function PageButton({
  disabled,
  label,
  loading,
  onPress,
}: {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
          size="small"
        />
      ) : null}
      <Text style={[styles.buttonText, { color: palette.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  page: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
