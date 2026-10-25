import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import type { AdminEventSettings as EventSettings } from "@/api/admin-api";
import { useLocale } from "@/i18n/LocaleProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

export function AdminEventSettings({
  canManage,
  errorKind,
  loading,
  onRetry,
  onSave,
  saving,
  settings,
}: Readonly<{
  canManage: boolean;
  errorKind: "offline" | "timeout" | "forbidden" | "other" | null;
  loading: boolean;
  onRetry: () => void;
  onSave: (settings: EventSettings) => void;
  saving: boolean;
  settings: EventSettings | null;
}>) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const [draft, setDraft] = useState<EventSettings | null>(settings);
  const [retentionText, setRetentionText] = useState("");
  const [retentionTouched, setRetentionTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const currentDraft = draft ?? settings;
  const visibleRetention = retentionTouched
    ? retentionText
    : String(settings?.eventsExpirationDays ?? "");
  const retention = Number(visibleRetention);
  const retentionValid =
    visibleRetention.trim() !== "" &&
    Number.isInteger(retention) &&
    retention >= 0 &&
    retention <= 3650;

  const updateDraft = (changes: Partial<EventSettings>) => {
    if (!canManage) return;
    setDraft((current) =>
      currentDraft ? { ...currentDraft, ...changes } : current,
    );
  };
  const save = () => {
    setSubmitted(true);
    if (!currentDraft || !canManage || !retentionValid || saving) return;
    const nextSettings = {
      ...currentDraft,
      eventsExpirationDays: retention,
    };
    setDraft(nextSettings);
    onSave(nextSettings);
  };

  const errorMessage =
    errorKind === "forbidden"
      ? dictionary.adminForbidden
      : errorKind === "offline"
        ? dictionary.adminEventSettingsOfflineError
        : errorKind === "timeout"
          ? dictionary.adminEventSettingsTimeoutError
          : dictionary.adminEventSettingsLoadError;

  if (loading && !settings) {
    return (
      <View style={{ alignItems: "center", padding: spacing.xl }}>
        <ActivityIndicator
          accessibilityLabel={dictionary.loading}
          color={palette.primary}
        />
      </View>
    );
  }

  if (errorKind && !settings) {
    return (
      <View
        style={{
          alignSelf: "center",
          borderColor: palette.border,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.md,
          marginTop: spacing.lg,
          maxWidth: 720,
          padding: spacing.lg,
          width: "100%",
        }}
      >
        <Text accessibilityRole="alert" style={{ color: palette.danger }}>
          {errorMessage}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={onRetry}
          testID="admin-event-settings-retry"
          style={{
            alignItems: "center",
            backgroundColor: palette.surfaceMuted,
            borderColor: palette.border,
            borderRadius: radii.md,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
        >
          {loading ? (
            <ActivityIndicator
              accessibilityLabel={dictionary.loading}
              color={palette.primary}
            />
          ) : null}
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {dictionary.adminRetry}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!currentDraft) return null;

  const toggleRow = (
    label: string,
    value: boolean,
    onValueChange: (next: boolean) => void,
  ) => (
    <View
      style={{
        alignItems: "center",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        justifyContent: "space-between",
        minHeight: 64,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: palette.text, flex: 1, fontSize: 16 }}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: saving || !canManage }}
        disabled={saving || !canManage}
        onValueChange={onValueChange}
        value={value}
        trackColor={{ false: palette.border, true: palette.primary }}
      />
    </View>
  );

  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.md,
        marginTop: spacing.lg,
        maxWidth: 720,
        padding: spacing.lg,
        width: "100%",
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={{ color: palette.text, fontSize: 20, fontWeight: "700" }}
        >
          {dictionary.adminEventSettingsTitle}
        </Text>
        <Text
          style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21 }}
        >
          {dictionary.adminEventSettingsDescription}
        </Text>
      </View>
      {errorKind ? (
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={onRetry}
            testID="admin-event-settings-retry"
            style={{
              alignItems: "center",
              backgroundColor: palette.surfaceMuted,
              borderColor: palette.border,
              borderRadius: radii.md,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing.sm,
              justifyContent: "center",
              minHeight: 48,
              paddingHorizontal: spacing.md,
            }}
          >
            {loading ? (
              <ActivityIndicator
                accessibilityLabel={dictionary.loading}
                color={palette.primary}
              />
            ) : null}
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              {dictionary.adminRetry}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {toggleRow(
        dictionary.adminEventRecordingEnabled,
        currentDraft.eventsEnabled,
        (eventsEnabled) => updateDraft({ eventsEnabled }),
      )}
      {toggleRow(
        dictionary.adminAdminEventRecordingEnabled,
        currentDraft.adminEventsEnabled,
        (adminEventsEnabled) => updateDraft({ adminEventsEnabled }),
      )}
      {toggleRow(
        dictionary.adminEventDetailsEnabled,
        currentDraft.adminEventsDetailsEnabled,
        (adminEventsDetailsEnabled) =>
          updateDraft({ adminEventsDetailsEnabled }),
      )}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: "600" }}>
          {dictionary.adminEventRetentionDays}
        </Text>
        <TextInput
          accessibilityLabel={dictionary.adminEventRetentionDays}
          editable={!saving && canManage}
          keyboardType="number-pad"
          onChangeText={(value) => {
            setRetentionText(value);
            setRetentionTouched(true);
            setSubmitted(false);
          }}
          placeholder="30"
          placeholderTextColor={palette.textMuted}
          testID="admin-event-retention-days"
          style={{
            borderColor:
              submitted && !retentionValid ? palette.danger : palette.border,
            borderRadius: radii.sm,
            borderWidth: 1,
            color: palette.text,
            fontSize: 16,
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
          value={visibleRetention}
        />
        <Text
          style={{ color: palette.textMuted, fontSize: 13, lineHeight: 19 }}
        >
          {dictionary.adminEventRetentionHint}
        </Text>
        {submitted && !retentionValid ? (
          <Text accessibilityRole="alert" style={{ color: palette.danger }}>
            {dictionary.adminEventRetentionValidation}
          </Text>
        ) : null}
      </View>
      {canManage ? <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !draft }}
        disabled={saving}
        onPress={save}
        testID="admin-event-settings-save"
        style={{
          alignItems: "center",
          backgroundColor: palette.primary,
          borderRadius: radii.md,
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "center",
          minHeight: 50,
          paddingHorizontal: spacing.lg,
        }}
      >
        {saving ? (
          <ActivityIndicator
            accessibilityLabel={dictionary.loading}
            color={palette.onPrimary}
          />
        ) : null}
        <Text style={{ color: palette.onPrimary, fontWeight: "700" }}>
          {dictionary.adminSave}
        </Text>
      </Pressable> : null}
    </View>
  );
}
