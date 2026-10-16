import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";

/** Keeps native forms reachable while the on-screen keyboard is visible. */
export function MobileFormScrollView({
  children,
  ...scrollProps
}: ScrollViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" {...scrollProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
