import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocale } from "@/i18n/LocaleProvider";
import {
  normalizeNoticeDuration,
  type NoticeKind,
} from "@/notifications/notice";
import { useTheme } from "@/theme/ThemeProvider";
import { radii, spacing } from "@/theme/tokens";

type Notice = {
  id: number;
  kind: NoticeKind;
  message: string;
};

type NoticeContextValue = {
  showNotice: (request: {
    kind: NoticeKind;
    message: string;
    durationMs?: number;
  }) => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function MobileNoticeProvider({ children }: PropsWithChildren) {
  const { dictionary } = useLocale();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    setNotice(null);
  }, []);

  const showNotice = useCallback(
    ({
      kind,
      message,
      durationMs,
    }: Parameters<NoticeContextValue["showNotice"]>[0]) => {
      if (!message.trim()) return;
      if (timeout.current) clearTimeout(timeout.current);
      const id = ++nextId.current;
      setNotice({ id, kind, message });
      timeout.current = setTimeout(() => {
        setNotice((current) => (current?.id === id ? null : current));
        timeout.current = null;
      }, normalizeNoticeDuration(durationMs));
    },
    [],
  );

  useEffect(() => dismiss, [dismiss]);

  const value = useMemo(() => ({ showNotice }), [showNotice]);
  const tone =
    notice?.kind === "error"
      ? palette.danger
      : notice?.kind === "success"
        ? palette.success
        : palette.primary;

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {notice ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.container,
            {
              backgroundColor: palette.surface,
              borderColor: tone,
              shadowColor: palette.text,
              top: insets.top + spacing.sm,
            },
          ]}
        >
          <View style={styles.messageContainer}>
            <View style={[styles.indicator, { backgroundColor: tone }]} />
            <Text style={[styles.message, { color: palette.text }]}>
              {notice.message}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={dictionary.close}
            accessibilityRole="button"
            hitSlop={spacing.sm}
            onPress={dismiss}
            style={styles.close}
          >
            <Text style={[styles.closeText, { color: palette.textMuted }]}>
              ×
            </Text>
          </Pressable>
        </View>
      ) : null}
    </NoticeContext.Provider>
  );
}

export function useMobileNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useMobileNotice must be used inside MobileNoticeProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    elevation: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    left: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: spacing.md,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 100,
  },
  messageContainer: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  indicator: { borderRadius: radii.pill, height: 8, width: 8 },
  message: { flex: 1, fontSize: 14, lineHeight: 20 },
  close: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
    minHeight: 36,
    minWidth: 36,
  },
  closeText: { fontSize: 24, lineHeight: 28 },
});
