"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { usePathname, useRouter, useSearchParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import { useDictionary } from "@/i18n/client";
import { accountRequest, registerAccountTokenHandlers } from "@/lib/account-api";
import {
  isCanceledRequest,
  useConsoleSessionLifecycle,
} from "@/components/auth/useConsoleSessionLifecycle";
import { DesktopSignInScreen } from "@/components/shared/DesktopSignInScreen";
import { isDesktopRuntime } from "@/lib/desktop-api";
import { useAccountAuth } from "./AccountAuthProvider";

type Profile = { username: string };

export function AccountAuthGuard({
  locale,
  children,
  callbackContent,
}: {
  locale: Locale;
  children: React.ReactNode;
  callbackContent?: React.ReactNode;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [desktopSignInPending, setDesktopSignInPending] = useState(false);
  const dictionary = useDictionary();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    accessToken,
    beginAuthorization,
    expiresAt,
    initialized,
    isLoggingOut,
    refreshAccessToken,
    setUsername,
  } = useAccountAuth();
  const callback = pathname.replace(/\/+$/, "").endsWith("/callback");
  const desktopSignInRequested = searchParams.get("desktopSignIn") === "1";

  const { startAuthorization: startLogin, authorizationError } = useConsoleSessionLifecycle({
    accessToken,
    beginAuthorization,
    expiresAt,
    isAuthorizationCallback: callback,
    locale,
    refreshAccessToken,
    registerTokenHandlers: registerAccountTokenHandlers,
  });
  const isDesktopSignInPending =
    desktopSignInPending || (desktopSignInRequested && !accessToken && !authorizationError);

  useEffect(() => {
    if (!initialized || isLoggingOut || callback) return;
    if (!accessToken) {
      if (isDesktopRuntime()) {
        if (desktopSignInRequested) {
          void startLogin(true);
        }
        return;
      }
      startLogin();
      return;
    }
    const controller = new AbortController();
    accountRequest<Profile>(accessToken, { url: "/api/account/profile", signal: controller.signal })
      .then((response) => {
        if (response.status === 401) return null;
        if (response.status >= 300) throw new Error("Account profile could not be loaded");
        return response.data;
      })
      .then((profile) => {
        if (!profile) return;
        setUsername(profile.username);
        setAuthorized(true);
      })
      .catch((error: unknown) => {
        if (isCanceledRequest(error)) return;
        router.replace(`/auth-error?type=server_error`);
      });
    return () => controller.abort();
  }, [
    accessToken,
    callback,
    initialized,
    isLoggingOut,
    locale,
    refreshAccessToken,
    router,
    startLogin,
    setUsername,
    desktopSignInRequested,
  ]);

  const signInWithBrowser = useCallback(async () => {
    setDesktopSignInPending(true);
    await startLogin(true);
    setDesktopSignInPending(false);
  }, [startLogin]);

  if (callback) return callbackContent ?? children;
  if (!initialized || isLoggingOut) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{dictionary.account.common.loading}</span>
        </div>
      </div>
    );
  }

  if (isDesktopRuntime() && !authorized && !accessToken) {
    return (
      <DesktopSignInScreen
        dictionary={dictionary}
        error={authorizationError}
        onSignIn={signInWithBrowser}
        pending={isDesktopSignInPending}
      />
    );
  }

  if (!authorized || !accessToken) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        {authorizationError ? (
          <Alert variant="danger" className="m-3">
            {dictionary.desktop.signInUnavailable}
          </Alert>
        ) : (
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{dictionary.account.common.loading}</span>
          </div>
        )}
      </div>
    );
  }
  return children;
}
