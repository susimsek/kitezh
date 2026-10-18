import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  colors,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "./tokens";
import { createPreferenceStorage } from "../preferences/preference-storage";

const THEME_KEY = "kitezh.mobile.theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  palette: (typeof colors)[ResolvedTheme];
  ready: boolean;
  saving: boolean;
  storageError: boolean;
  setMode: (mode: ThemeMode) => Promise<boolean>;
  reset: () => Promise<boolean>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme: ResolvedTheme =
    useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const modeRef = useRef<ThemeMode>("system");
  const revision = useRef(0);
  const savingRef = useRef(false);
  const preferenceStorage = useMemo(
    () => createPreferenceStorage(SecureStore, THEME_KEY, isThemeMode),
    [],
  );
  const resolvedTheme = resolveTheme(mode, systemTheme);

  useEffect(() => {
    let active = true;
    const readRevision = revision.current;
    void preferenceStorage
      .read()
      .then((stored) => {
        if (active && revision.current === readRevision && stored) {
          modeRef.current = stored;
          setModeState(stored);
        }
      })
      .catch(() => {
        if (active && revision.current === readRevision) {
          setStorageError(true);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [preferenceStorage]);

  const setMode = useCallback(
    async (nextMode: ThemeMode) => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      setStorageError(false);
      const currentRevision = ++revision.current;
      const previousMode = modeRef.current;
      modeRef.current = nextMode;
      setModeState(nextMode);
      try {
        await preferenceStorage.save(nextMode);
        return true;
      } catch {
        if (revision.current === currentRevision) {
          modeRef.current = previousMode;
          setModeState(previousMode);
          setStorageError(true);
        }
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [preferenceStorage],
  );

  const reset = useCallback(async () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setStorageError(false);
    const currentRevision = ++revision.current;
    const previousMode = modeRef.current;
    modeRef.current = "system";
    setModeState("system");
    try {
      await preferenceStorage.reset();
      return true;
    } catch {
      if (revision.current === currentRevision) {
        modeRef.current = previousMode;
        setModeState(previousMode);
        setStorageError(true);
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [preferenceStorage]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      palette: colors[resolvedTheme],
      ready,
      saving,
      storageError,
      setMode,
      reset,
    }),
    [mode, ready, reset, resolvedTheme, saving, setMode, storageError],
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
