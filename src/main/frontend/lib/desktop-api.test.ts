import {
  assertDesktopOnline,
  DesktopOfflineError,
  isDesktopOffline,
  setDesktopConnectivity,
} from "./desktop-api";

describe("desktop connectivity guard", () => {
  afterEach(() => {
    delete window.desktopApi;
    setDesktopConnectivity(true);
  });

  it("rejects desktop writes while offline and permits reads", () => {
    window.desktopApi = { isDesktop: true } as never;
    setDesktopConnectivity(false);

    expect(isDesktopOffline()).toBe(true);
    expect(() => assertDesktopOnline("GET")).not.toThrow();
    expect(() => assertDesktopOnline("POST")).toThrow(DesktopOfflineError);
    expect(() => assertDesktopOnline("DELETE")).toThrow(DesktopOfflineError);
  });
});
