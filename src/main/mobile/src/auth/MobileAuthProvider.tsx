import {
  AuthRequest as ExpoAuthRequest,
  type AuthRequest as ExpoAuthRequestType,
  type AuthSessionResult,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  useAutoDiscovery,
} from "expo-auth-session";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState, Linking, Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocale } from "@/i18n/LocaleProvider";
import {
  isAllowedNativeRedirect,
  validateNativeAuthorizationConfig,
  validateAuthorizationCallback,
} from "../../../shared/src/auth.ts";
import {
  createSingleFlight,
  NATIVE_REFRESH_EXPIRY_SKEW_MS,
} from "../../../shared/src/session.ts";
import {
  authorizationServerIssuer,
  getMobileConsoleConfig,
  type MobileConsole,
} from "@/config";
import {
  clearSession,
  clearOAuthTransaction,
  consumeOAuthTransaction,
  readSession,
  saveOAuthTransaction,
  type MobileSession,
  writeSession,
} from "./storage";

WebBrowser.maybeCompleteAuthSession();

const AUTH_BROWSER_TIMEOUT_MS = 5 * 60_000;

function authorizationTimeoutResult(): AuthSessionResult {
  return {
    authentication: null,
    errorCode: "authorization_timeout",
    params: { error: "authorization_timeout" },
    type: "error",
    url: "",
  };
}

async function promptWithAuthorizationTimeout(
  prompt: () => Promise<AuthSessionResult>,
): Promise<AuthSessionResult> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;
  const result = await Promise.race([
    prompt(),
    new Promise<AuthSessionResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        didTimeout = true;
        resolve(authorizationTimeoutResult());
      }, AUTH_BROWSER_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
  if (didTimeout && Platform.OS === "ios") {
    try {
      WebBrowser.dismissAuthSession();
    } catch {
      // The native timeout is still enforced if iOS cannot dismiss the sheet.
    }
  }
  return result;
}

function hasTrustedDiscovery(
  discovery: NonNullable<ReturnType<typeof useAutoDiscovery>>,
  clientId: string,
  redirectUri: string,
) {
  return validateNativeAuthorizationConfig(
    authorizationServerIssuer,
    clientId,
    redirectUri,
    {
      issuer: discovery.discoveryDocument?.issuer,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      endSessionEndpoint: discovery.endSessionEndpoint,
    },
    typeof __DEV__ !== "undefined" && __DEV__ && Platform.OS === "android",
  );
}

type AuthStatus =
  | "loading"
  | "signed-out"
  | "signing-in"
  | "signing-out"
  | "signed-in"
  | "error";

type MobileAuthContextValue = {
  readonly session: MobileSession | null;
  readonly status: AuthStatus;
  readonly error: string | null;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refreshSession: (force?: boolean) => Promise<MobileSession | null>;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

function expiresAtFromToken(expiresIn = 300, issuedAt = Date.now()) {
  return issuedAt + Math.max(expiresIn, 0) * 1000;
}

function promptAndroidAuthSession(
  request: ExpoAuthRequestType,
  discovery: NonNullable<ReturnType<typeof useAutoDiscovery>>,
): Promise<AuthSessionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let returnedToApp = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTimer = setTimeout(() => {
      finish(authorizationTimeoutResult());
    }, AUTH_BROWSER_TIMEOUT_MS);

    const finish = (result: AuthSessionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
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
        clearTimeout(timeoutTimer);
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
}: Readonly<{
  children: React.ReactNode;
  consoleName?: MobileConsole;
}>) {
  const { dictionary, resolvedLocale } = useLocale();
  const consoleConfig = useMemo(
    () => getMobileConsoleConfig(consoleName),
    [consoleName],
  );
  const discovery = useAutoDiscovery(authorizationServerIssuer);
  const redirectUri = makeRedirectUri({ native: consoleConfig.redirectUri });
  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const refreshCoordinator = useMemo(
    () => createSingleFlight<MobileSession | null>(),
    [],
  );
  const sessionRevision = useRef(0);
  const processingAuthorizationResult = useRef(false);
  const initialCallbackHandled = useRef(false);
  const signInInFlight = useRef(false);
  const signOutInFlight = useRef(false);

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

  const processAuthorizationResult = useCallback(
    async (result: AuthSessionResult | null, expectedRevision: number) => {
      if (!result || processingAuthorizationResult.current) return;
      processingAuthorizationResult.current = true;
      setStatus("signing-in");
      setError(null);
      try {
        if (sessionRevision.current !== expectedRevision) return;
        if (result.type === "cancel" || result.type === "dismiss") {
          await clearOAuthTransaction(consoleConfig.namespace);
          if (sessionRevision.current === expectedRevision) {
            setStatus("signed-out");
          }
          return;
        }
        if (
          result.type === "error" &&
          result.params.error === "authorization_timeout"
        ) {
          throw new Error("authorization_timeout");
        }
        if (result.type !== "success") {
          throw new Error("authorization_callback_failed");
        }
        const transaction = await consumeOAuthTransaction(
          consoleConfig.namespace,
          { clientId: consoleConfig.clientId, redirectUri },
        );
        if (!transaction) {
          throw new Error("authorization_transaction_expired");
        }
        const callback = validateAuthorizationCallback(
          result.params,
          transaction.state,
        );
        if (sessionRevision.current !== expectedRevision) return;
        const token = await exchangeCodeAsync(
          {
            clientId: consoleConfig.clientId,
            code: callback.code,
            redirectUri,
            extraParams: { code_verifier: transaction.codeVerifier },
          },
          discovery!,
        );
        if (sessionRevision.current !== expectedRevision) return;
        const nextSession: MobileSession = {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken ?? null,
          idToken: token.idToken ?? null,
          expiresAt: expiresAtFromToken(token.expiresIn, token.issuedAt * 1000),
        };
        await writeSession(nextSession, consoleConfig.namespace);
        if (sessionRevision.current !== expectedRevision) {
          await clearSession(consoleConfig.namespace);
          return;
        }
        setSession(nextSession);
        setStatus("signed-in");
      } catch (cause) {
        await clearOAuthTransaction(consoleConfig.namespace);
        if (sessionRevision.current === expectedRevision) {
          setStatus("error");
          setError(
            cause instanceof Error && cause.message === "authorization_timeout"
              ? "authorization-timeout"
              : "authorization-failed",
          );
        }
      } finally {
        processingAuthorizationResult.current = false;
      }
    },
    [consoleConfig, discovery, redirectUri],
  );

  useEffect(() => {
    if (!discovery || initialCallbackHandled.current) return;
    initialCallbackHandled.current = true;
    if (!hasTrustedDiscovery(discovery, consoleConfig.clientId, redirectUri)) {
      return;
    }
    void Linking.getInitialURL()
      .then(async (url) => {
        if (!url || !isAllowedNativeRedirect(url, redirectUri)) return;
        const queryParams = ExpoLinking.parse(url).queryParams ?? {};
        const params = Object.fromEntries(
          Object.entries(queryParams).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        );
        if (!params.state) {
          await clearOAuthTransaction(consoleConfig.namespace);
          return;
        }
        void processAuthorizationResult(
          { type: "success", params } as AuthSessionResult,
          sessionRevision.current,
        );
      })
      .catch(() => {
        setError(dictionary.authError);
        setStatus("error");
      });
  }, [
    consoleConfig,
    dictionary.authError,
    discovery,
    processAuthorizationResult,
    redirectUri,
  ]);

  const signIn = useCallback(async () => {
    if (
      signInInFlight.current ||
      status === "signing-in" ||
      status === "signing-out"
    ) {
      return;
    }
    signInInFlight.current = true;
    if (
      !discovery ||
      !hasTrustedDiscovery(discovery, consoleConfig.clientId, redirectUri)
    ) {
      setStatus("error");
      setError(dictionary.authError);
      signInInFlight.current = false;
      return;
    }
    sessionRevision.current += 1;
    const revision = sessionRevision.current;
    setStatus("signing-in");
    setError(null);
    try {
      if (refreshCoordinator.pending()) {
        await refreshCoordinator.run(() => Promise.resolve(null));
        if (sessionRevision.current !== revision) return;
      }
      const request = new ExpoAuthRequest({
        clientId: consoleConfig.clientId,
        redirectUri,
        responseType: "code",
        scopes: consoleConfig.scopes,
        usePKCE: true,
        extraParams: { ui_locales: resolvedLocale },
      });
      await request.makeAuthUrlAsync(discovery);
      if (!request.codeVerifier || !request.state) {
        throw new Error("authorization_request_invalid");
      }
      await saveOAuthTransaction(consoleConfig.namespace, {
        clientId: consoleConfig.clientId,
        codeVerifier: request.codeVerifier,
        createdAt: Date.now(),
        redirectUri,
        state: request.state,
      });
      const result =
        Platform.OS === "android"
          ? await promptAndroidAuthSession(request, discovery)
          : await promptWithAuthorizationTimeout(() =>
              request.promptAsync(discovery),
            );
      if (sessionRevision.current !== revision) return;
      await processAuthorizationResult(result, revision);
    } catch (cause) {
      await clearOAuthTransaction(consoleConfig.namespace);
      if (sessionRevision.current !== revision) return;
      setStatus("error");
      setError(
        cause instanceof Error && cause.message === "authorization_timeout"
          ? "authorization-timeout"
          : "authorization-failed",
      );
    } finally {
      signInInFlight.current = false;
    }
  }, [
    consoleConfig,
    dictionary.authError,
    discovery,
    processAuthorizationResult,
    resolvedLocale,
    redirectUri,
    refreshCoordinator,
    status,
  ]);

  const refreshSession = useCallback(
    async (force = false) => {
      if (!session?.refreshToken || !discovery) return session;
      if (
        !force &&
        session.expiresAt > Date.now() + NATIVE_REFRESH_EXPIRY_SKEW_MS
      ) {
        return session;
      }
      const revision = sessionRevision.current;
      return refreshCoordinator.run(async () => {
        try {
          const token = await refreshAsync(
            {
              clientId: consoleConfig.clientId,
              refreshToken: session.refreshToken ?? undefined,
            },
            discovery,
          );
          if (sessionRevision.current !== revision) return null;
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
          if (sessionRevision.current !== revision) {
            await clearSession(consoleConfig.namespace);
            return null;
          }
          setSession(nextSession);
          setStatus("signed-in");
          return nextSession;
        } catch {
          if (sessionRevision.current !== revision) return null;
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
    if (signOutInFlight.current || status === "signing-out") return;
    signOutInFlight.current = true;
    sessionRevision.current += 1;
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
      try {
        await clearOAuthTransaction(consoleConfig.namespace);
        if (refreshCoordinator.pending()) {
          await refreshCoordinator.run(() => Promise.resolve(null));
        }
      } finally {
        try {
          await clearSession(consoleConfig.namespace);
        } finally {
          setSession(null);
          setStatus("signed-out");
          setError(null);
          signOutInFlight.current = false;
        }
      }
    }
  }, [consoleConfig, discovery, refreshCoordinator, session, status]);

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
