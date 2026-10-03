"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { usePathname, useRouter, useSearchParams } from "@/routing/navigation";

import type { Locale } from "@/i18n/config";
import { useDictionary } from "@/i18n/client";
import { adminRequest, registerAdminTokenHandlers } from "@/lib/admin-api";
import {
  isCanceledRequest,
  useConsoleSessionLifecycle,
} from "@/components/auth/useConsoleSessionLifecycle";
import { DesktopSignInScreen } from "@/components/shared/DesktopSignInScreen";
import { isDesktopRuntime } from "@/lib/desktop-api";

import { type AdminAccess, useAdminAuth } from "./AdminAuthProvider";

type AdminWhoAmI = {
  username: string;
  authorities: string[];
  access: AdminAccess;
};

export function AdminAuthGuard({
  locale,
  children,
  callbackContent,
}: {
  locale: Locale;
  children: React.ReactNode;
  callbackContent?: React.ReactNode;
}) {
  const dictionary = useDictionary();
  const [authorized, setAuthorized] = useState(false);
  const [desktopSignInPending, setDesktopSignInPending] = useState(false);
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
    setAccess,
    setUsername,
  } = useAdminAuth();
  const isAuthorizationCallback = pathname.replace(/\/+$/, "").endsWith("/callback");
  const desktopSignInRequested = searchParams.get("desktopSignIn") === "1";

  const { startAuthorization: startLogin, authorizationError } = useConsoleSessionLifecycle({
    accessToken,
    beginAuthorization,
    expiresAt,
    isAuthorizationCallback,
    locale,
    refreshAccessToken,
    registerTokenHandlers: registerAdminTokenHandlers,
  });
  const isDesktopSignInPending =
    desktopSignInPending || (desktopSignInRequested && !accessToken && !authorizationError);

  useEffect(() => {
    if (!initialized || isLoggingOut || isAuthorizationCallback) return;

    if (!accessToken) {
      if (isDesktopRuntime()) {
        if (desktopSignInRequested) {
          void startLogin(true);
        }
        return;
      }
      // A normal authorization request reuses the server's browser SSO session when it
      // exists, and displays the login page only when it does not. A separate silent
      // probe would start a second authorization transaction.
      startLogin();
      return;
    }
    const controller = new AbortController();

    adminRequest<AdminWhoAmI>(accessToken, {
      url: "/api/admin/whoami",
      signal: controller.signal,
    })
      .then((response) => {
        // admin-api already attempts a single refresh and invokes the registered
        // unauthorized handler when the refresh cannot recover the request.
        if (response.status === 401) return null;

        if (response.status === 403) {
          router.replace(`/auth-error?type=access_denied`);
          return null;
        }

        if (response.status >= 300) {
          throw new Error("Admin identity could not be loaded");
        }

        return response.data;
      })
      .then((admin) => {
        if (!admin) return;

        const hasAdminAccess = Object.values(admin.access).some(Boolean);
        if (!hasAdminAccess) {
          router.replace(`/auth-error?type=access_denied`);
          return;
        }

        setAccess(admin.access);
        setUsername(admin.username);
        setAuthorized(true);
      })
      .catch((error: unknown) => {
        // Route transitions abort the in-flight whoami request. Axios reports
        // this as CanceledError/ERR_CANCELED, not DOMException AbortError.
        // Treating it as a server failure caused the Clients/Scopes error page.
        if (isCanceledRequest(error)) return;
        router.replace(`/auth-error?type=server_error`);
      });

    return () => controller.abort();
  }, [
    accessToken,
    initialized,
    isAuthorizationCallback,
    isLoggingOut,
    locale,
    refreshAccessToken,
    router,
    startLogin,
    setAccess,
    setUsername,
    desktopSignInRequested,
  ]);

  const signInWithBrowser = useCallback(async () => {
    setDesktopSignInPending(true);
    await startLogin(true);
    setDesktopSignInPending(false);
  }, [startLogin]);

  if (isAuthorizationCallback) return callbackContent ?? children;

  if (!initialized || isLoggingOut) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{dictionary.admin.common.loading}</span>
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
            <span className="visually-hidden">{dictionary.admin.common.loading}</span>
          </div>
        )}
      </div>
    );
  }

  return children;
}
