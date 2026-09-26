import axios from "axios";
import { useCallback, useEffect, useRef } from "react";

import type { Locale } from "@/i18n/config";
import type { TokenHandlers } from "@/lib/authenticated-api-client";

type ConsoleSessionLifecycleOptions = {
  accessToken: string | null;
  beginAuthorization: (locale: Locale, returnTo: string) => Promise<void>;
  expiresAt: number | null;
  isAuthorizationCallback: boolean;
  locale: Locale;
  refreshAccessToken: (minValidity?: number) => Promise<string | null>;
  registerTokenHandlers: (handlers: TokenHandlers | undefined) => void;
};

export function useConsoleSessionLifecycle({
  accessToken,
  beginAuthorization,
  expiresAt,
  isAuthorizationCallback,
  locale,
  refreshAccessToken,
  registerTokenHandlers,
}: ConsoleSessionLifecycleOptions) {
  const authorizationStarted = useRef(false);

  const startAuthorization = useCallback(() => {
    if (authorizationStarted.current) return;
    authorizationStarted.current = true;
    void beginAuthorization(locale, `${window.location.pathname}${window.location.search}`).catch(
      () => {
        authorizationStarted.current = false;
      },
    );
  }, [beginAuthorization, locale]);

  useEffect(() => {
    if (accessToken) authorizationStarted.current = false;
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || isAuthorizationCallback) return;
    registerTokenHandlers({ refresh: refreshAccessToken, unauthorized: startAuthorization });
    return () => registerTokenHandlers(undefined);
  }, [
    accessToken,
    isAuthorizationCallback,
    refreshAccessToken,
    registerTokenHandlers,
    startAuthorization,
  ]);

  useEffect(() => {
    if (!expiresAt || isAuthorizationCallback) return;
    const timer = window.setTimeout(
      () => {
        void refreshAccessToken().then((token) => {
          if (!token) startAuthorization();
        });
      },
      Math.max(expiresAt - Date.now() - 30_000, 0),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, isAuthorizationCallback, refreshAccessToken, startAuthorization]);

  return startAuthorization;
}

export function isCanceledRequest(error: unknown) {
  return (
    axios.isCancel(error) ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ERR_CANCELED")
  );
}
