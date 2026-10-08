import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  useAuthRequest,
  useAutoDiscovery,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { useLocale } from "@/i18n/LocaleProvider";
import {
  authorizationServerIssuer,
  mobileClientId,
  mobilePostLogoutRedirectUri,
  mobileRedirectUri,
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

export function MobileAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedLocale } = useLocale();
  const discovery = useAutoDiscovery(authorizationServerIssuer);
  const redirectUri = makeRedirectUri({ native: mobileRedirectUri });
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: mobileClientId,
      redirectUri,
      responseType: "code",
      scopes: ["openid", "profile", "email", "account-api"],
      usePKCE: true,
      extraParams: { ui_locales: resolvedLocale },
    },
    discovery,
  );
  const [session, setSession] = useState<MobileSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const refreshInProgress = useRef<Promise<MobileSession | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSession()
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
  }, []);

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
      const result = await promptAsync();
      if (
        result.type !== "success" ||
        !result.params.code ||
        !request.codeVerifier
      ) {
        if (result.type === "cancel" || result.type === "dismiss") {
          setStatus("signed-out");
          return;
        }
        throw new Error("Authorization was not completed");
      }
      const token = await exchangeCodeAsync(
        {
          clientId: mobileClientId,
          code: result.params.code,
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
      await writeSession(nextSession);
      setSession(nextSession);
      setStatus("signed-in");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Authorization failed");
    }
  }, [discovery, promptAsync, redirectUri, request, status]);

  const refreshSession = useCallback(
    async (force = false) => {
      if (!session?.refreshToken || !discovery) return session;
      if (!force && session.expiresAt > Date.now() + 60_000) return session;
      if (refreshInProgress.current) return refreshInProgress.current;

      const requestPromise = refreshAsync(
        { clientId: mobileClientId, refreshToken: session.refreshToken },
        discovery,
      )
        .then(async (token) => {
          const nextSession: MobileSession = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken ?? session.refreshToken,
            idToken: token.idToken ?? session.idToken,
            expiresAt: expiresAtFromToken(
              token.expiresIn,
              token.issuedAt * 1000,
            ),
          };
          await writeSession(nextSession);
          setSession(nextSession);
          setStatus("signed-in");
          return nextSession;
        })
        .catch(() => {
          void clearSession();
          setSession(null);
          setStatus("signed-out");
          return null;
        })
        .finally(() => {
          refreshInProgress.current = null;
        });
      refreshInProgress.current = requestPromise;
      return requestPromise;
    },
    [discovery, session],
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
          mobilePostLogoutRedirectUri,
        );
        url.searchParams.set("client_id", mobileClientId);
        await WebBrowser.openAuthSessionAsync(
          url.toString(),
          mobilePostLogoutRedirectUri,
        );
      }
    } finally {
      await clearSession();
      setSession(null);
      setStatus("signed-out");
      setError(null);
    }
  }, [discovery, session, status]);

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
