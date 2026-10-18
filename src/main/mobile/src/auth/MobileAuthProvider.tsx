import {
  AuthRequest as ExpoAuthRequest,
  type AuthRequest as ExpoAuthRequestType,
  type AuthSessionResult,
  type DiscoveryDocument,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
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
import {
  fetchNativeAuthorizationDiscovery,
  NativeDiscoveryError,
} from "./discovery";
import { withTimeout } from "./timeout";
import {
  startMobileGoogleLogin,
  registerMobileLoginPasskey,
  startMobilePasskeyLogin,
  startMobileLogin,
  submitMobileLoginAction,
  submitMobileLoginMfa,
  verifyMobilePasskeyLogin,
  type MobileLoginAction,
  type MobileLoginResponse,
} from "@/api/public-api";
import {
  isNativeSocialProviderConfigured,
  requestNativeGoogleIdToken,
} from "@/auth/native-social-login";
import {
  getNativePasskey,
  type NativePasskeyCredential,
} from "@/auth/native-passkey";

WebBrowser.maybeCompleteAuthSession();

const AUTH_BROWSER_TIMEOUT_MS = 5 * 60_000;
const AUTH_CODE_EXCHANGE_TIMEOUT_MS = 30_000;

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
  discovery: DiscoveryDocument,
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

type DiscoveryStatus = "loading" | "ready" | "unavailable" | "timeout";

type LoginChallenge =
  | { kind: "mfa"; transactionId: string }
  | {
      kind: "actions";
      transactionId: string;
      actions: MobileLoginAction[];
    };

type MobileAuthContextValue = {
  readonly session: MobileSession | null;
  readonly status: AuthStatus;
  readonly error: string | null;
  readonly discoveryStatus: DiscoveryStatus;
  readonly retryDiscovery: () => Promise<void>;
  readonly loginChallenge: LoginChallenge | null;
  readonly signIn: (provider?: string) => Promise<void>;
  readonly nativeLogin: (
    username: string,
    password: string,
    captchaToken?: string | null,
  ) => Promise<void>;
  readonly nativePasskeyLogin: (username: string) => Promise<void>;
  readonly submitLoginMfa: (code: string) => Promise<void>;
  readonly submitLoginAction: (
    values: Record<string, unknown>,
  ) => Promise<void>;
  readonly submitLoginPasskeyRegistration: (
    actionKey: string,
    credential: NativePasskeyCredential,
    label: string,
  ) => Promise<void>;
  readonly cancelNativeLogin: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refreshSession: (force?: boolean) => Promise<MobileSession | null>;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

function expiresAtFromToken(expiresIn = 300, issuedAt = Date.now()) {
  return issuedAt + Math.max(expiresIn, 0) * 1000;
}

function authorizationErrorCode(cause: unknown) {
  if (!(cause instanceof Error)) return "authorization-failed";
  if (cause.message === "authorization_timeout") return "authorization-timeout";
  if (
    cause.message === "authorization_cancelled" ||
    cause.message === "authorization-cancelled"
  ) {
    return "authorization-cancelled";
  }
  return "authorization-failed";
}

function nativeSocialLoginErrorCode(cause: unknown) {
  if (
    cause &&
    typeof cause === "object" &&
    "status" in cause &&
    cause.status === 409
  ) {
    return "google-account-link-required";
  }
  return authorizationErrorCode(cause);
}

function nativeLoginErrorCode(cause: unknown) {
  if (
    cause &&
    typeof cause === "object" &&
    "status" in cause &&
    cause.status === 401
  ) {
    return "login-credentials-invalid";
  }
  return authorizationErrorCode(cause);
}

function promptAndroidAuthSession(
  request: ExpoAuthRequestType,
  discovery: DiscoveryDocument,
): Promise<AuthSessionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let returnedToApp = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTimer = setTimeout(() => {
      finish(authorizationTimeoutResult());
      void WebBrowser.dismissBrowser().catch(() => {
        // Keep the timeout result even if the platform cannot dismiss its tab.
      });
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
  const [discovery, setDiscovery] = useState<DiscoveryDocument | null>(null);
  const [discoveryStatus, setDiscoveryStatus] =
    useState<DiscoveryStatus>("loading");
  const discoveryAttempt = useRef(0);
  const discoveryRetryInFlight = useRef(false);
  const redirectUri = makeRedirectUri({ native: consoleConfig.redirectUri });
  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loginChallenge, setLoginChallenge] = useState<LoginChallenge | null>(
    null,
  );
  const refreshCoordinator = useMemo(
    () => createSingleFlight<MobileSession | null>(),
    [],
  );
  const sessionRevision = useRef(0);
  const processingAuthorizationResult = useRef(false);
  const initialCallbackHandled = useRef(false);
  const signInInFlight = useRef(false);
  const nativeLoginInFlight = useRef(false);
  const signOutInFlight = useRef(false);

  const retryDiscovery = useCallback(async () => {
    if (discoveryRetryInFlight.current) return;
    discoveryRetryInFlight.current = true;
    const attempt = ++discoveryAttempt.current;
    setDiscovery(null);
    setDiscoveryStatus("loading");
    try {
      const result = await fetchNativeAuthorizationDiscovery(
        authorizationServerIssuer,
      );
      if (discoveryAttempt.current !== attempt) return;
      if (!hasTrustedDiscovery(result, consoleConfig.clientId, redirectUri)) {
        throw new NativeDiscoveryError("invalid");
      }
      setDiscovery(result);
      setDiscoveryStatus("ready");
    } catch (cause) {
      if (discoveryAttempt.current !== attempt) return;
      setDiscovery(null);
      setDiscoveryStatus(
        cause instanceof NativeDiscoveryError && cause.kind === "timeout"
          ? "timeout"
          : "unavailable",
      );
    } finally {
      discoveryRetryInFlight.current = false;
    }
  }, [consoleConfig.clientId, redirectUri]);

  const handleNativeLoginResponse = useCallback(
    async (result: MobileLoginResponse, expectedRevision: number) => {
      if (sessionRevision.current !== expectedRevision) return;
      if (result.status === "mfa_required") {
        setLoginChallenge({
          kind: "mfa",
          transactionId: result.transactionId,
        });
        setStatus("signed-out");
        return;
      }
      if (result.status === "required_actions") {
        setLoginChallenge({
          kind: "actions",
          transactionId: result.transactionId,
          actions: result.actions,
        });
        setStatus("signed-out");
        return;
      }
      if (result.status === "passkey_required") {
        throw new Error("native-passkey-challenge-unverified");
      }

      const transaction = await consumeOAuthTransaction(
        consoleConfig.namespace,
        { clientId: consoleConfig.clientId, redirectUri },
      );
      if (!transaction || result.redirectUri !== redirectUri) {
        throw new Error("authorization_transaction_expired");
      }
      const callback = validateAuthorizationCallback(
        { code: result.code, state: result.state },
        transaction.state,
      );
      if (sessionRevision.current !== expectedRevision) return;
      const token = await withTimeout(
        exchangeCodeAsync(
          {
            clientId: consoleConfig.clientId,
            code: callback.code,
            redirectUri,
            extraParams: { code_verifier: transaction.codeVerifier },
          },
          discovery!,
        ),
        AUTH_CODE_EXCHANGE_TIMEOUT_MS,
        "authorization_timeout",
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
      setLoginChallenge(null);
      setSession(nextSession);
      setStatus("signed-in");
    },
    [consoleConfig, discovery, redirectUri],
  );

  const nativeLogin = useCallback(
    async (
      username: string,
      password: string,
      captchaToken: string | null = null,
    ) => {
      if (nativeLoginInFlight.current || !username.trim() || !password) return;
      if (
        !discovery ||
        !hasTrustedDiscovery(discovery, consoleConfig.clientId, redirectUri)
      ) {
        setError("authorization-failed");
        return;
      }
      nativeLoginInFlight.current = true;
      sessionRevision.current += 1;
      const revision = sessionRevision.current;
      setStatus("signing-in");
      setError(null);
      setLoginChallenge(null);
      try {
        const nonceRequest = new ExpoAuthRequest({
          clientId: consoleConfig.clientId,
          redirectUri,
          usePKCE: false,
        });
        const request = new ExpoAuthRequest({
          clientId: consoleConfig.clientId,
          redirectUri,
          responseType: "code",
          scopes: consoleConfig.scopes,
          usePKCE: true,
          extraParams: {
            nonce: nonceRequest.state,
            ui_locales: resolvedLocale,
          },
        });
        await request.makeAuthUrlAsync(discovery);
        if (
          !request.codeVerifier ||
          !request.codeChallenge ||
          !request.state ||
          !nonceRequest.state
        ) {
          throw new Error("authorization_request_invalid");
        }
        await saveOAuthTransaction(consoleConfig.namespace, {
          clientId: consoleConfig.clientId,
          codeVerifier: request.codeVerifier,
          createdAt: Date.now(),
          redirectUri,
          state: request.state,
        });
        const result = await startMobileLogin(
          {
            platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
            clientId: consoleConfig.clientId,
            redirectUri,
            scope: consoleConfig.scopes.join(" "),
            state: request.state,
            codeChallenge: request.codeChallenge,
            codeChallengeMethod: "S256",
            nonce: nonceRequest.state,
            username: username.trim(),
            password,
            captchaToken,
          },
          { locale: resolvedLocale },
        );
        await handleNativeLoginResponse(result, revision);
      } catch (cause) {
        await clearOAuthTransaction(consoleConfig.namespace);
        if (sessionRevision.current === revision) {
          setLoginChallenge(null);
          setStatus("signed-out");
          setError(nativeLoginErrorCode(cause));
        }
      } finally {
        nativeLoginInFlight.current = false;
      }
    },
    [
      consoleConfig,
      discovery,
      handleNativeLoginResponse,
      redirectUri,
      resolvedLocale,
    ],
  );

  const nativePasskeyLogin = useCallback(
    async (username: string) => {
      if (nativeLoginInFlight.current || !username.trim()) return;
      if (
        !discovery ||
        !hasTrustedDiscovery(discovery, consoleConfig.clientId, redirectUri)
      ) {
        setError("authorization-failed");
        return;
      }
      nativeLoginInFlight.current = true;
      sessionRevision.current += 1;
      const revision = sessionRevision.current;
      setStatus("signing-in");
      setError(null);
      setLoginChallenge(null);
      try {
        const nonceRequest = new ExpoAuthRequest({
          clientId: consoleConfig.clientId,
          redirectUri,
          usePKCE: false,
        });
        const request = new ExpoAuthRequest({
          clientId: consoleConfig.clientId,
          redirectUri,
          responseType: "code",
          scopes: consoleConfig.scopes,
          usePKCE: true,
          extraParams: {
            nonce: nonceRequest.state,
            ui_locales: resolvedLocale,
          },
        });
        await request.makeAuthUrlAsync(discovery);
        if (
          !request.codeVerifier ||
          !request.codeChallenge ||
          !request.state ||
          !nonceRequest.state
        ) {
          throw new Error("authorization_request_invalid");
        }
        await saveOAuthTransaction(consoleConfig.namespace, {
          clientId: consoleConfig.clientId,
          codeVerifier: request.codeVerifier,
          createdAt: Date.now(),
          redirectUri,
          state: request.state,
        });
        const challenge = await startMobilePasskeyLogin(
          {
            platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
            clientId: consoleConfig.clientId,
            redirectUri,
            scope: consoleConfig.scopes.join(" "),
            state: request.state,
            codeChallenge: request.codeChallenge,
            codeChallengeMethod: "S256",
            nonce: nonceRequest.state,
            username: username.trim(),
          },
          { locale: resolvedLocale },
        );
        if (challenge.status !== "passkey_required") {
          await handleNativeLoginResponse(challenge, revision);
          return;
        }
        const credential = await getNativePasskey(challenge.publicKey);
        await handleNativeLoginResponse(
          await verifyMobilePasskeyLogin(challenge.transactionId, credential, {
            locale: resolvedLocale,
          }),
          revision,
        );
      } catch {
        await clearOAuthTransaction(consoleConfig.namespace);
        if (sessionRevision.current === revision) {
          setLoginChallenge(null);
          setStatus("signed-out");
          setError("passkey-authentication-failed");
        }
      } finally {
        nativeLoginInFlight.current = false;
      }
    },
    [
      consoleConfig,
      discovery,
      handleNativeLoginResponse,
      redirectUri,
      resolvedLocale,
    ],
  );

  const continueNativeChallenge = useCallback(
    async (submit: () => Promise<MobileLoginResponse>) => {
      if (!loginChallenge || nativeLoginInFlight.current) return;
      nativeLoginInFlight.current = true;
      const revision = sessionRevision.current;
      setStatus("signing-in");
      setError(null);
      try {
        await handleNativeLoginResponse(await submit(), revision);
      } catch (cause) {
        if (sessionRevision.current === revision) {
          setStatus("signed-out");
          setError(authorizationErrorCode(cause));
        }
      } finally {
        nativeLoginInFlight.current = false;
      }
    },
    [handleNativeLoginResponse, loginChallenge],
  );

  const submitLoginMfa = useCallback(
    async (code: string) => {
      if (loginChallenge?.kind !== "mfa" || !/^\d{6,8}$/.test(code)) return;
      await continueNativeChallenge(() =>
        submitMobileLoginMfa(loginChallenge.transactionId, code, {
          locale: resolvedLocale,
        }),
      );
    },
    [continueNativeChallenge, loginChallenge, resolvedLocale],
  );

  const submitLoginAction = useCallback(
    async (values: Record<string, unknown>) => {
      if (loginChallenge?.kind !== "actions") return;
      const action = loginChallenge.actions[0];
      if (!action) return;
      await continueNativeChallenge(() =>
        submitMobileLoginAction(
          loginChallenge.transactionId,
          action.key,
          values,
          { locale: resolvedLocale },
        ),
      );
    },
    [continueNativeChallenge, loginChallenge, resolvedLocale],
  );

  const submitLoginPasskeyRegistration = useCallback(
    async (
      actionKey: string,
      credential: NativePasskeyCredential,
      label: string,
    ) => {
      if (loginChallenge?.kind !== "actions") return;
      await continueNativeChallenge(() =>
        registerMobileLoginPasskey(
          loginChallenge.transactionId,
          actionKey,
          credential,
          label,
          { locale: resolvedLocale },
        ),
      );
    },
    [continueNativeChallenge, loginChallenge, resolvedLocale],
  );

  const cancelNativeLogin = useCallback(async () => {
    sessionRevision.current += 1;
    nativeLoginInFlight.current = false;
    setLoginChallenge(null);
    setError(null);
    setStatus("signed-out");
    await clearOAuthTransaction(consoleConfig.namespace);
  }, [consoleConfig.namespace]);

  useEffect(() => {
    const timer = setTimeout(() => void retryDiscovery(), 0);
    return () => {
      clearTimeout(timer);
      discoveryAttempt.current += 1;
    };
  }, [retryDiscovery]);

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
            setError("authorization-cancelled");
          }
          return;
        }
        if (
          result.type === "error" &&
          result.params.error === "authorization_timeout"
        ) {
          throw new Error("authorization_timeout");
        }
        if (
          result.type === "error" &&
          result.params.error === "access_denied"
        ) {
          throw new Error("authorization_cancelled");
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
        const token = await withTimeout(
          exchangeCodeAsync(
            {
              clientId: consoleConfig.clientId,
              code: callback.code,
              redirectUri,
              extraParams: { code_verifier: transaction.codeVerifier },
            },
            discovery!,
          ),
          AUTH_CODE_EXCHANGE_TIMEOUT_MS,
          "authorization_timeout",
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
          setError(authorizationErrorCode(cause));
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
          setStatus("error");
          setError("authorization-failed");
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

  const signIn = useCallback(
    async (provider?: string) => {
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
      setLoginChallenge(null);
      try {
        if (refreshCoordinator.pending()) {
          await refreshCoordinator.run(() => Promise.resolve(null));
          if (sessionRevision.current !== revision) return;
        }
        if (
          provider === "google" &&
          isNativeSocialProviderConfigured("google")
        ) {
          const nonceRequest = new ExpoAuthRequest({
            clientId: consoleConfig.clientId,
            redirectUri,
            usePKCE: false,
          });
          const request = new ExpoAuthRequest({
            clientId: consoleConfig.clientId,
            redirectUri,
            responseType: "code",
            scopes: consoleConfig.scopes,
            usePKCE: true,
            extraParams: {
              nonce: nonceRequest.state,
              ui_locales: resolvedLocale,
            },
          });
          await request.makeAuthUrlAsync(discovery);
          if (
            !request.codeVerifier ||
            !request.codeChallenge ||
            !request.state ||
            !nonceRequest.state
          ) {
            throw new Error("authorization_request_invalid");
          }
          await saveOAuthTransaction(consoleConfig.namespace, {
            clientId: consoleConfig.clientId,
            codeVerifier: request.codeVerifier,
            createdAt: Date.now(),
            redirectUri,
            state: request.state,
          });
          const idToken = await requestNativeGoogleIdToken();
          if (sessionRevision.current !== revision) return;
          const result = await startMobileGoogleLogin(
            {
              platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
              clientId: consoleConfig.clientId,
              redirectUri,
              scope: consoleConfig.scopes.join(" "),
              state: request.state,
              codeChallenge: request.codeChallenge,
              codeChallengeMethod: "S256",
              nonce: nonceRequest.state,
              idToken,
            },
            { locale: resolvedLocale },
          );
          await handleNativeLoginResponse(result, revision);
          return;
        }
        const request = new ExpoAuthRequest({
          clientId: consoleConfig.clientId,
          redirectUri,
          responseType: "code",
          scopes: consoleConfig.scopes,
          usePKCE: true,
          extraParams: { ui_locales: resolvedLocale },
        });
        const requestDiscovery = provider
          ? {
              ...discovery,
              authorizationEndpoint: new URL(
                `/api/auth/mobile-social-login/${encodeURIComponent(provider)}`,
                authorizationServerIssuer,
              ).toString(),
            }
          : discovery;
        await request.makeAuthUrlAsync(requestDiscovery);
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
            ? await promptAndroidAuthSession(request, requestDiscovery)
            : await promptWithAuthorizationTimeout(() =>
                request.promptAsync(requestDiscovery),
              );
        if (sessionRevision.current !== revision) return;
        await processAuthorizationResult(result, revision);
      } catch (cause) {
        await clearOAuthTransaction(consoleConfig.namespace);
        if (sessionRevision.current !== revision) return;
        setStatus("error");
        setError(
          provider === "google" &&
          isNativeSocialProviderConfigured("google")
            ? nativeSocialLoginErrorCode(cause)
            : authorizationErrorCode(cause),
        );
      } finally {
        signInInFlight.current = false;
      }
    },
    [
      consoleConfig,
      dictionary.authError,
      discovery,
      processAuthorizationResult,
      resolvedLocale,
      redirectUri,
      refreshCoordinator,
      status,
    ],
  );

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
    () => ({
      session,
      status,
      error,
      discoveryStatus,
      retryDiscovery,
      loginChallenge,
      signIn,
      nativeLogin,
      nativePasskeyLogin,
      submitLoginMfa,
      submitLoginAction,
      submitLoginPasskeyRegistration,
      cancelNativeLogin,
      signOut,
      refreshSession,
    }),
    [
      discoveryStatus,
      error,
      loginChallenge,
      nativeLogin,
      nativePasskeyLogin,
      submitLoginAction,
      submitLoginPasskeyRegistration,
      submitLoginMfa,
      cancelNativeLogin,
      refreshSession,
      retryDiscovery,
      session,
      signIn,
      signOut,
      status,
    ],
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
