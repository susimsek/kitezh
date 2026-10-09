import {
  applyConsoleToken,
  clearConsoleAuth,
  setAdminAccess,
  setConsoleUsername,
} from "./auth-slice";
import { makeStore } from "./store";
import { setLocale } from "./locale-slice";
import { setTheme } from "./theme-slice";

describe("Redux application store", () => {
  it("manages theme centrally", () => {
    const store = makeStore();

    store.dispatch(setTheme("dark"));

    expect(store.getState().theme).toEqual({ value: "dark" });
  });

  it("manages locale centrally", () => {
    const store = makeStore();

    store.dispatch(setLocale("tr"));

    expect(store.getState().locale).toEqual({ value: "tr" });
  });

  it("manages admin and account authentication independently", () => {
    const store = makeStore();

    store.dispatch(
      applyConsoleToken({
        console: "admin",
        accessToken: "admin-access",
        idToken: "admin-id",
        expiresAt: 123,
        subject: "admin",
        tokenParsed: { sub: "admin", sid: "sid-admin" },
        idTokenParsed: { sub: "admin" },
        refreshTokenParsed: { sub: "admin" },
      }),
    );
    store.dispatch(setConsoleUsername({ console: "admin", username: "administrator" }));
    store.dispatch(
      setAdminAccess({
        viewClients: true,
        manageClients: false,
        viewUsers: true,
        manageUsers: false,
        impersonateUsers: false,
        viewRoles: true,
        manageRoles: false,
        viewSessions: true,
        manageSessions: false,
        viewConsents: true,
        manageConsents: false,
        viewKeys: true,
        manageKeys: false,
      }),
    );

    expect(store.getState().auth.admin).toMatchObject({
      accessToken: "admin-access",
      idToken: "admin-id",
      authenticated: true,
      username: "administrator",
      avatarUrl: null,
      access: { viewClients: true },
    });
    expect(store.getState().auth.account.authenticated).toBe(false);

    store.dispatch(clearConsoleAuth({ console: "admin", loggingOut: true }));
    expect(store.getState().auth.admin).toMatchObject({
      accessToken: null,
      authenticated: false,
      isLoggingOut: true,
      username: null,
      avatarUrl: null,
      access: null,
    });
  });
});
