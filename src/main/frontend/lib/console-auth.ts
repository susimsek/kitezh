import axios from "axios";
import { useCallback, useEffect, useRef } from "react";

import type { Locale } from "@/i18n/config";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { codeChallenge, decodeJwt, ensureOpenIdScope, randomValue } from "./console-auth-crypto";
import {
  clearStoredTransactions,
  readAndRemoveTransaction,
  readPersistedTokens,
  removeAllPersistedTokens,
  removePersistedTokens,
  persistTokens,
  storeTransaction,
} from "./console-auth-storage";
import type {
  AuthorizationTransaction,
  ConsoleAuthConfig,
  ConsoleKind,
  ConsoleTokenResponse,
} from "./console-auth-types";
import { applyConsoleToken, clearConsoleAuth, setConsoleInitialized } from "@/store/auth-slice";
import { apiUrl, isDesktopRuntime } from "./desktop-api";

export { CONSOLE_TRANSACTION_KEYS } from "./console-auth-storage";
export type { ConsoleTokenResponse, JwtPayload } from "./console-auth-types";

const CALLBACK_TTL_MS = 5 * 60 * 1000;

function isPermanentRefreshFailure(error: unknown) {
  return (
    axios.isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 401)
  );
}

export function useConsoleAuth(config: ConsoleAuthConfig, consoleKind: ConsoleKind) {
  const clientId = isDesktopRuntime()
    ? (config.desktopClientId ?? config.clientId)
    : config.clientId;
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth[consoleKind]);
  const {
    accessToken,
    idToken,
    expiresAt,
    authenticated,
    initialized,
    subject,
    tokenParsed,
    idTokenParsed,
    refreshTokenParsed,
    isLoggingOut,
  } = auth;
  const accessTokenRef = useRef<string | null>(null);
  const idTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const timeSkewRef = useRef<number | null>(null);
  const authorizationInProgress = useRef<Promise<void> | null>(null);
  const refreshInProgress = useRef<Promise<string | null> | null>(null);
  const tokenGeneration = useRef(0);

  const releaseAuthorization = useCallback(() => {
    authorizationInProgress.current = null;
  }, []);

  const clearTransactionState = useCallback(() => {
    if (config.postLoginReturnToKey) sessionStorage.removeItem(config.postLoginReturnToKey);
    releaseAuthorization();
  }, [config.postLoginReturnToKey, releaseAuthorization]);

  const clearAuthentication = useCallback(
    (loggingOut = false, removeStoredToken = true) => {
      tokenGeneration.current += 1;
      accessTokenRef.current = null;
      idTokenRef.current = null;
      refreshTokenRef.current = null;
      expiresAtRef.current = null;
      timeSkewRef.current = null;
      refreshInProgress.current = null;
      if (removeStoredToken) void removePersistedTokens(consoleKind).catch(() => undefined);
      dispatch(clearConsoleAuth({ console: consoleKind, loggingOut }));
      clearTransactionState();
    },
    [clearTransactionState, consoleKind, dispatch],
  );

  const applyToken = useCallback(
    (token: ConsoleTokenResponse, timeLocal?: number, expectedNonce?: string) => {
      const accessPayload = decodeJwt(token.access_token);
      // A refresh response may omit id_token and refresh_token. Keep the prior values in that
      // case; RFC 6749 permits refresh-token reuse when a replacement is not returned.
      const nextIdToken = token.id_token ?? idTokenRef.current;
      const nextRefreshToken = token.refresh_token ?? refreshTokenRef.current;
      const idPayload = decodeJwt(nextIdToken ?? undefined);
      const refreshPayload = decodeJwt(nextRefreshToken ?? undefined);

      if (expectedNonce && (!idPayload || idPayload.nonce !== expectedNonce)) {
        clearAuthentication(false);
        throw new Error("Invalid nonce");
      }

      if (timeLocal && typeof accessPayload?.iat === "number") {
        timeSkewRef.current = Math.floor(timeLocal / 1000) - accessPayload.iat;
      }

      const responseExpiresAt = Date.now() + Math.max(token.expires_in, 0) * 1000;
      const jwtExpiresAt =
        typeof accessPayload?.exp === "number"
          ? (accessPayload.exp + (timeSkewRef.current ?? 0)) * 1000
          : null;
      const nextExpiresAt = jwtExpiresAt
        ? Math.min(responseExpiresAt, jwtExpiresAt)
        : responseExpiresAt;

      accessTokenRef.current = token.access_token;
      idTokenRef.current = nextIdToken;
      refreshTokenRef.current = nextRefreshToken;
      expiresAtRef.current = nextExpiresAt;
      void persistTokens(consoleKind, {
        accessToken: token.access_token,
        expiresAt: nextExpiresAt,
        idToken: nextIdToken,
        refreshToken: nextRefreshToken,
        version: 1,
      }).catch(() => undefined);
      dispatch(
        applyConsoleToken({
          console: consoleKind,
          accessToken: token.access_token,
          idToken: nextIdToken,
          expiresAt: nextExpiresAt,
          subject: accessPayload?.sub ?? null,
          tokenParsed: accessPayload,
          idTokenParsed: idPayload,
          refreshTokenParsed: refreshPayload,
        }),
      );
    },
    [clearAuthentication, consoleKind, dispatch],
  );

  useEffect(() => {
    return () => {
      authorizationInProgress.current = null;
      refreshInProgress.current = null;
    };
  }, []);

  const refreshAccessToken = useCallback(
    async (minValidity = 5) => {
      const currentRefreshToken = refreshTokenRef.current;
      if (!currentRefreshToken) return null;
      if (refreshInProgress.current) return refreshInProgress.current;

      const expiresAt = expiresAtRef.current;
      const shouldRefresh =
        minValidity === -1 || !expiresAt || expiresAt <= Date.now() + minValidity * 1000;
      if (!shouldRefresh) return accessTokenRef.current;

      const generation = tokenGeneration.current;
      let timeLocal = Date.now();
      const request = axios
        .post<ConsoleTokenResponse>(
          apiUrl("/oauth2/token"),
          new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: currentRefreshToken,
          }),
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        )
        .then((response) => {
          if (generation !== tokenGeneration.current) return null;
          timeLocal = (timeLocal + Date.now()) / 2;
          applyToken(response.data, timeLocal);
          return response.data.access_token;
        })
        .catch((error: unknown) => {
          // Same as Keycloak updateToken(): an invalid refresh token clears the in-memory set.
          if (isPermanentRefreshFailure(error)) {
            clearAuthentication(false);
            return null;
          }
          const currentAccessToken = accessTokenRef.current;
          const currentExpiresAt = expiresAtRef.current;
          return currentAccessToken && currentExpiresAt && currentExpiresAt > Date.now()
            ? currentAccessToken
            : null;
        })
        .finally(() => {
          if (refreshInProgress.current === request) refreshInProgress.current = null;
        });

      refreshInProgress.current = request;
      return request;
    },
    [applyToken, clearAuthentication, clientId],
  );

  useEffect(() => {
    let cancelled = false;
    void readPersistedTokens(consoleKind)
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          applyToken({
            access_token: stored.accessToken,
            expires_in: Math.max(0, Math.ceil((stored.expiresAt - Date.now()) / 1000)),
            id_token: stored.idToken ?? undefined,
            refresh_token: stored.refreshToken ?? undefined,
          });
          return;
        }
        dispatch(setConsoleInitialized({ console: consoleKind, initialized: true }));
      })
      .catch(() => {
        if (!cancelled)
          dispatch(setConsoleInitialized({ console: consoleKind, initialized: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [applyToken, consoleKind, dispatch]);

  const beginAuthorization = useCallback(
    async (locale: Locale, returnTo: string) => {
      if (authorizationInProgress.current) return authorizationInProgress.current;

      const request = (async () => {
        if (
          isDesktopRuntime() &&
          window.desktopApi &&
          (await window.desktopApi.auth.getStorageStatus()) !== "available"
        ) {
          throw new Error("Secure desktop storage is unavailable");
        }
        const codeVerifier = randomValue();
        const state = randomValue();
        const nonce = randomValue();
        const redirectUri = isDesktopRuntime()
          ? "kitezh://oauth/callback"
          : `${window.location.origin}${config.redirectPath(locale)}`;
        const transaction: AuthorizationTransaction = {
          codeVerifier,
          expires: Date.now() + CALLBACK_TTL_MS,
          nonce,
          redirectUri,
          returnTo,
          state,
        };
        storeTransaction(config, transaction);
        if (config.postLoginReturnToKey)
          sessionStorage.setItem(config.postLoginReturnToKey, returnTo);

        try {
          const parameters = new URLSearchParams({
            client_id: clientId,
            code_challenge: await codeChallenge(codeVerifier),
            code_challenge_method: "S256",
            nonce,
            redirect_uri: redirectUri,
            response_mode: "fragment",
            response_type: "code",
            scope: ensureOpenIdScope(config.scope),
            state,
            ui_locales: locale,
          });
          const authorizationUrl = new URL(
            "/oauth2/authorize",
            isDesktopRuntime() && window.desktopApi
              ? window.desktopApi.apiBaseUrl
              : window.location.origin,
          );
          authorizationUrl.search = parameters.toString();
          if (isDesktopRuntime() && window.desktopApi) {
            await window.desktopApi.auth.startLogin({
              console: consoleKind,
              authorizationUrl: authorizationUrl.toString(),
              state,
              codeVerifier,
              clientId,
              redirectUri,
            });
          } else {
            window.location.assign(authorizationUrl);
          }
        } catch (error) {
          readAndRemoveTransaction(config, state);
          clearTransactionState();
          throw error;
        }
      })();

      authorizationInProgress.current = request;
      return request;
    },
    [clearTransactionState, clientId, config, consoleKind],
  );

  const completeAuthorization = useCallback(
    async (code: string, state: string) => {
      const transaction = readAndRemoveTransaction(config, state);
      if (!transaction) {
        clearTransactionState();
        throw new Error("Missing authorization transaction");
      }

      if (isDesktopRuntime()) {
        try {
          const stored = await readPersistedTokens(consoleKind);
          if (!stored) throw new Error("Missing desktop session");
          applyToken(
            {
              access_token: stored.accessToken,
              expires_in: Math.max(0, Math.ceil((stored.expiresAt - Date.now()) / 1000)),
              id_token: stored.idToken ?? undefined,
              refresh_token: stored.refreshToken ?? undefined,
            },
            Date.now(),
            transaction.nonce,
          );
          return transaction.returnTo;
        } finally {
          clearTransactionState();
        }
      }

      const generation = tokenGeneration.current;
      let timeLocal = Date.now();
      try {
        const response = await axios.post<ConsoleTokenResponse>(
          apiUrl("/oauth2/token"),
          new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: transaction.codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: transaction.redirectUri,
          }),
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        );
        if (generation !== tokenGeneration.current) {
          throw new Error("Authorization was cancelled");
        }
        timeLocal = (timeLocal + Date.now()) / 2;
        applyToken(response.data, timeLocal, transaction.nonce);
        return transaction.returnTo;
      } finally {
        clearTransactionState();
      }
    },
    [applyToken, clearTransactionState, clientId, config, consoleKind],
  );

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    return window.desktopApi.onAuthCallback(
      ({ console: callbackConsole, url: callbackUrl, error }) => {
        if (callbackConsole !== consoleKind) return;
        if (error) {
          window.location.replace("/login?error=authorization");
          return;
        }
        const callback = new URL(callbackUrl);
        const fragment = new URLSearchParams(callback.hash.replace(/^#/, ""));
        const code = callback.searchParams.get("code") ?? fragment.get("code");
        const state = callback.searchParams.get("state") ?? fragment.get("state");
        if (!state || (!isDesktopRuntime() && !code)) return;
        void completeAuthorization(isDesktopRuntime() ? "" : (code ?? ""), state)
          .then((returnTo) => window.location.replace(returnTo))
          .catch(() => window.location.replace("/login?error=authorization"));
      },
    );
  }, [completeAuthorization, consoleKind]);

  const logout = useCallback(
    async (locale: Locale) => {
      const idTokenHint = idTokenRef.current;
      clearStoredTransactions();
      clearAuthentication(true, false);
      // OIDC logout ends the shared browser session. Clear both console token sets so a later
      // navigation cannot hydrate a token issued before that shared logout.
      void removeAllPersistedTokens().catch(() => undefined);

      const postLogoutRedirectUri = isDesktopRuntime()
        ? "kitezh://logout/callback"
        : `${window.location.origin}${config.postLogoutRedirectPath(locale)}`;
      if (!idTokenHint) {
        await axios.post(apiUrl("/logout")).catch(() => undefined);
        window.location.replace("/login?logout");
        return;
      }

      const parameters = new URLSearchParams({
        client_id: clientId,
        post_logout_redirect_uri: postLogoutRedirectUri,
      });
      parameters.set("id_token_hint", idTokenHint);

      const logoutUrl = new URL(
        "/connect/logout",
        isDesktopRuntime() && window.desktopApi
          ? window.desktopApi.apiBaseUrl
          : window.location.origin,
      );
      logoutUrl.search = parameters.toString();
      if (isDesktopRuntime() && window.desktopApi) {
        await window.desktopApi.openExternal(logoutUrl.toString());
        window.location.replace("/login?logout");
      } else {
        window.location.replace(logoutUrl);
      }
    },
    [clearAuthentication, clientId, config],
  );

  const clearLocalSession = useCallback(() => {
    clearStoredTransactions();
    clearAuthentication(false);
  }, [clearAuthentication]);

  return {
    accessToken,
    idToken,
    expiresAt,
    authenticated,
    initialized,
    subject,
    tokenParsed,
    idTokenParsed,
    refreshTokenParsed,
    isLoggingOut,
    refreshAccessToken,
    logout,
    clearLocalSession,
    beginAuthorization,
    completeAuthorization,
  };
}
