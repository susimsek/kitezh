"use client";

import { useCallback } from "react";
import { useLocale } from "./client";

/** Use the selected UI language, retaining the browser's local time zone. */
export function useDateTimeFormatter() {
  const locale = useLocale();
  return useCallback((value: string) => new Date(value).toLocaleString(locale), [locale]);
}
