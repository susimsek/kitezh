"use client";

import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/theme-slice";

import { isTheme, resolveTheme, THEME_STORAGE_KEY } from "./theme";

export function ThemeManager() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.value);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(storedTheme) && storedTheme !== theme) {
      dispatch(setTheme(storedTheme));
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      dispatch(setTheme(isTheme(event.newValue) ? event.newValue : "system"));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [dispatch, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.setAttribute(
        "data-bs-theme",
        resolveTheme(theme, mediaQuery.matches),
      );
      if (window.desktopApi) void window.desktopApi.theme.set(theme);
    };

    applyTheme();
    const removeDesktopThemeListener = window.desktopApi?.theme.onChanged((resolvedTheme) => {
      if (theme === "system") {
        document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
      }
    });
    if (theme !== "system") return removeDesktopThemeListener;

    mediaQuery.addEventListener("change", applyTheme);
    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
      removeDesktopThemeListener?.();
    };
  }, [theme]);

  return null;
}
