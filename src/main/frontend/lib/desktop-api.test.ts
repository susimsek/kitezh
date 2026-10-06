import {
  apiUrl,
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

  it("rewrites local avatar URLs to the configured desktop API", () => {
    window.desktopApi = {
      isDesktop: true,
      apiBaseUrl: "https://kitezh.onrender.com",
    } as never;

    expect(apiUrl("http://127.0.0.1:9090/avatars/admin?v=1")).toBe(
      "https://kitezh.onrender.com/avatars/admin?v=1",
    );
  });

  it("rewrites local avatar URLs to the current web origin", () => {
    expect(apiUrl("http://127.0.0.1:9090/avatars/admin?v=1")).toBe(
      "http://localhost/avatars/admin?v=1",
    );
  });
});
