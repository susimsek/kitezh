import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import {
  colors,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "./tokens";

const THEME_KEY = "kitezh.mobile.theme";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: (typeof colors)[ResolvedTheme];
  ready: boolean;
  setMode: (mode: ThemeMode) => void;
  reset: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme: ResolvedTheme =
    useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);
  const resolvedTheme = resolveTheme(mode, systemTheme);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(THEME_KEY)
      .then((stored) => {
        if (
          active &&
          (stored === "system" || stored === "light" || stored === "dark")
        ) {
          setModeState(stored);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      palette: colors[resolvedTheme],
      ready,
      setMode: (nextMode) => {
        setModeState(nextMode);
        void SecureStore.setItemAsync(THEME_KEY, nextMode);
      },
      reset: async () => {
        setModeState("system");
        await SecureStore.deleteItemAsync(THEME_KEY);
      },
    }),
    [mode, ready, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
