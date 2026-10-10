import {
  type AuthRequest,
  type AuthSessionResult,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  useAuthRequest,
  useAutoDiscovery,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { AppState, Linking, Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useLocale } from "@/i18n/LocaleProvider";
import {
  isAllowedNativeRedirect,
  validateAuthorizationCallback,
} from "../../../shared/src/auth.ts";
import { createSingleFlight } from "../../../shared/src/session.ts";
import {
  authorizationServerIssuer,
  getMobileConsoleConfig,
  type MobileConsole,
} from "@/config";
import {
  clearSession,
  readSession,
  type MobileSession,
  writeSession,
} from "./storage";

WebBrowser.maybeCompleteAuthSession();

type AuthStatus =
  | "loading"
  | "signed-out"
  | "signing-in"
  | "signing-out"
  | "signed-in"
  | "error";

type MobileAuthContextValue = {
  session: MobileSession | null;
  status: AuthStatus;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: (force?: boolean) => Promise<MobileSession | null>;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

function expiresAtFromToken(expiresIn = 300, issuedAt = Date.now()) {
  return issuedAt + Math.max(expiresIn, 0) * 1000;
}

function promptAndroidAuthSession(
  request: AuthRequest,
  discovery: NonNullable<ReturnType<typeof useAutoDiscovery>>,
): Promise<AuthSessionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let returnedToApp = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: AuthSessionResult) => {
      if (settled) return;
      settled = true;
      if (returnTimer) clearTimeout(returnTimer);
      urlSubscription.remove();
      appStateSubscription.remove();
      resolve(result);
    };

    const urlSubscription = Linking.addEventListener("url", ({ url }) => {
      if (!isAllowedNativeRedirect(url, request.redirectUri)) return;
      finish(request.parseReturnUrl(url));
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState !== "active") {
          returnedToApp = true;
          return;
        }
        if (!returnedToApp || settled) return;
        returnTimer = setTimeout(() => {
          finish({ type: "cancel" });
        }, 750);
      },
    );

    void request
      .makeAuthUrlAsync(discovery)
      .then((url) => WebBrowser.openBrowserAsync(url))
      .then((result) => {
        if (result.type !== "opened") finish({ type: "cancel" });
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        if (returnTimer) clearTimeout(returnTimer);
        urlSubscription.remove();
        appStateSubscription.remove();
        reject(error);
      });
  });
}

export function MobileAuthProvider({
  children,
  consoleName = "account",
}: {
  children: React.ReactNode;
  consoleName?: MobileConsole;
}) {
  const { resolvedLocale } = useLocale();
  const consoleConfig = useMemo(
    () => getMobileConsoleConfig(consoleName),
    [consoleName],
  );
  const discovery = useAutoDiscovery(authorizationServerIssuer);
  const redirectUri = makeRedirectUri({ native: consoleConfig.redirectUri });
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: consoleConfig.clientId,
      redirectUri,
      responseType: "code",
      scopes: consoleConfig.scopes,
      usePKCE: true,
      extraParams: { ui_locales: resolvedLocale },
    },
    discovery,
  );
  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const refreshCoordinator = useMemo(
    () => createSingleFlight<MobileSession | null>(),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void readSession(consoleConfig.namespace)
      .then((stored) => {
        if (cancelled) return;
        setSession(stored);
        setStatus(stored ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!cancelled) setStatus("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, [consoleConfig.namespace]);

  const signIn = useCallback(async () => {
    if (status === "signing-in" || status === "signing-out") return;
    if (!request || !discovery) {
      setStatus("error");
      setError("Authorization service is unavailable");
      return;
    }
    setStatus("signing-in");
    setError(null);
    try {
      const result =
        Platform.OS === "android"
          ? await promptAndroidAuthSession(request, discovery)
          : await promptAsync();
      if (result.type !== "success") {
        if (result.type === "cancel" || result.type === "dismiss") {
          setStatus("signed-out");
          return;
        }
        throw new Error("Authorization was not completed");
      }
      if (!request.codeVerifier) {
        throw new Error("Authorization was not completed");
      }
      const callback = validateAuthorizationCallback(
        result.params,
        request.state,
      );
      const token = await exchangeCodeAsync(
        {
          clientId: consoleConfig.clientId,
          code: callback.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery,
      );
      const nextSession: MobileSession = {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? null,
        idToken: token.idToken ?? null,
        expiresAt: expiresAtFromToken(token.expiresIn, token.issuedAt * 1000),
      };
      await writeSession(nextSession, consoleConfig.namespace);
      setSession(nextSession);
      setStatus("signed-in");
    } catch {
      setStatus("error");
      setError("authorization-failed");
    }
  }, [consoleConfig, discovery, promptAsync, redirectUri, request, status]);

  const refreshSession = useCallback(
    async (force = false) => {
      if (!session?.refreshToken || !discovery) return session;
      if (!force && session.expiresAt > Date.now() + 60_000) return session;
      return refreshCoordinator.run(async () => {
        try {
          const token = await refreshAsync(
            {
              clientId: consoleConfig.clientId,
              refreshToken: session.refreshToken ?? undefined,
            },
            discovery,
          );
          const nextSession: MobileSession = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken ?? session.refreshToken,
            idToken: token.idToken ?? session.idToken,
            expiresAt: expiresAtFromToken(
              token.expiresIn,
              token.issuedAt * 1000,
            ),
          };
          await writeSession(nextSession, consoleConfig.namespace);
          setSession(nextSession);
          setStatus("signed-in");
          return nextSession;
        } catch {
          await clearSession(consoleConfig.namespace);
          setSession(null);
          setStatus("signed-out");
          return null;
        }
      });
    },
    [consoleConfig, discovery, refreshCoordinator, session],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshSession();
    });
    return () => subscription.remove();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    if (status === "signing-out") return;
    const currentSession = session;
    setStatus("signing-out");
    try {
      if (currentSession?.idToken && discovery?.endSessionEndpoint) {
        const url = new URL(discovery.endSessionEndpoint);
        url.searchParams.set("id_token_hint", currentSession.idToken);
        url.searchParams.set(
          "post_logout_redirect_uri",
          consoleConfig.postLogoutRedirectUri,
        );
        url.searchParams.set("client_id", consoleConfig.clientId);
        await WebBrowser.openAuthSessionAsync(
          url.toString(),
          consoleConfig.postLogoutRedirectUri,
        );
      }
    } finally {
      await clearSession(consoleConfig.namespace);
      setSession(null);
      setStatus("signed-out");
      setError(null);
    }
  }, [consoleConfig, discovery, session, status]);

  const value = useMemo(
    () => ({ session, status, error, signIn, signOut, refreshSession }),
    [error, refreshSession, session, signIn, signOut, status],
  );

  return (
    <MobileAuthContext.Provider value={value}>
      {children}
    </MobileAuthContext.Provider>
  );
}

export function useMobileAuth() {
  const context = useContext(MobileAuthContext);
  if (!context)
    throw new Error("useMobileAuth must be used inside MobileAuthProvider");
  return context;
}

export type { AuthStatus };
