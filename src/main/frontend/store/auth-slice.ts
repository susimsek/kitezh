import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ConsoleKind, JwtPayload } from "@/lib/console-auth-types";

export type AdminAccess = {
  isAdmin?: boolean;
  queryClients?: boolean;
  viewClients: boolean;
  manageClients: boolean;
  queryUsers?: boolean;
  viewUsers: boolean;
  manageUsers: boolean;
  queryGroups?: boolean;
  viewGroups?: boolean;
  manageGroups?: boolean;
  impersonateUsers: boolean;
  viewRoles: boolean;
  manageRoles: boolean;
  viewSessions: boolean;
  manageSessions: boolean;
  viewConsents: boolean;
  manageConsents: boolean;
  viewEvents?: boolean;
  manageEvents?: boolean;
  viewKeys: boolean;
  manageKeys: boolean;
};

export type { ConsoleKind } from "@/lib/console-auth-types";

export type ConsoleAuthState = {
  accessToken: string | null;
  idToken: string | null;
  expiresAt: number | null;
  isLoggingOut: boolean;
  authenticated: boolean;
  initialized: boolean;
  subject: string | null;
  tokenParsed: JwtPayload | null;
  idTokenParsed: JwtPayload | null;
  refreshTokenParsed: JwtPayload | null;
  username: string | null;
};

type AuthState = {
  admin: ConsoleAuthState & { access: AdminAccess | null };
  account: ConsoleAuthState;
};

const emptyConsole = (): ConsoleAuthState => ({
  accessToken: null,
  idToken: null,
  expiresAt: null,
  isLoggingOut: false,
  authenticated: false,
  initialized: false,
  subject: null,
  tokenParsed: null,
  idTokenParsed: null,
  refreshTokenParsed: null,
  username: null,
});

const initialState: AuthState = {
  admin: { ...emptyConsole(), access: null },
  account: emptyConsole(),
};

type ApplyTokenPayload = {
  console: ConsoleKind;
  accessToken: string;
  idToken: string | null;
  expiresAt: number;
  subject: string | null;
  tokenParsed: JwtPayload | null;
  idTokenParsed: JwtPayload | null;
  refreshTokenParsed: JwtPayload | null;
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    applyConsoleToken(state, action: PayloadAction<ApplyTokenPayload>) {
      const target = state[action.payload.console];
      target.accessToken = action.payload.accessToken;
      target.idToken = action.payload.idToken;
      target.expiresAt = action.payload.expiresAt;
      target.authenticated = true;
      target.initialized = true;
      target.subject = action.payload.subject;
      target.tokenParsed = action.payload.tokenParsed;
      target.idTokenParsed = action.payload.idTokenParsed;
      target.refreshTokenParsed = action.payload.refreshTokenParsed;
      target.isLoggingOut = false;
    },
    clearConsoleAuth(state, action: PayloadAction<{ console: ConsoleKind; loggingOut?: boolean }>) {
      const username = state[action.payload.console].username;
      const cleared = emptyConsole();
      cleared.username = action.payload.loggingOut ? null : username;
      cleared.isLoggingOut = Boolean(action.payload.loggingOut);
      cleared.initialized = true;
      if (action.payload.console === "admin") {
        state.admin = { ...cleared, access: null };
      } else {
        state.account = cleared;
      }
    },
    setConsoleInitialized(
      state,
      action: PayloadAction<{ console: ConsoleKind; initialized: boolean }>,
    ) {
      state[action.payload.console].initialized = action.payload.initialized;
    },
    setConsoleUsername(
      state,
      action: PayloadAction<{ console: ConsoleKind; username: string | null }>,
    ) {
      state[action.payload.console].username = action.payload.username;
    },
    setAdminAccess(state, action: PayloadAction<AdminAccess | null>) {
      state.admin.access = action.payload;
    },
  },
});

export const {
  applyConsoleToken,
  clearConsoleAuth,
  setConsoleInitialized,
  setConsoleUsername,
  setAdminAccess,
} = authSlice.actions;

export default authSlice.reducer;
