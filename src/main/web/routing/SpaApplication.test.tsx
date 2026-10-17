import { act, render } from "@testing-library/react";

import SpaApplication from "./SpaApplication";

const mockIsDesktopRuntime = jest.fn();
const mockOnMenuLogout = jest.fn();
const mockClearAllSessions = jest.fn();
let mockLogoutListener: (() => void) | undefined;

jest.mock("@/i18n/client", () => ({
  ClientI18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/shared/DesktopConnectivityBanner", () => ({
  DesktopConnectivityBanner: () => null,
}));
jest.mock("@/components/shared/DesktopUpdateBanner", () => ({
  DesktopUpdateBanner: () => null,
}));
jest.mock("@/lib/desktop-api", () => ({ isDesktopRuntime: () => mockIsDesktopRuntime() }));
jest.mock("./AppRoutes", () => ({ AppRoutes: () => <div>application-routes</div> }));

describe("SpaApplication desktop menu logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogoutListener = undefined;
    delete (window as Window & { desktopApi?: unknown }).desktopApi;
    mockIsDesktopRuntime.mockReturnValue(false);
  });

  it("renders routes without subscribing outside the desktop runtime", () => {
    render(<SpaApplication />);

    expect(document.body).toHaveTextContent("application-routes");
    expect(mockOnMenuLogout).not.toHaveBeenCalled();
  });

  it("clears desktop sessions on menu logout and unregisters the listener", async () => {
    const unsubscribe = jest.fn();
    mockIsDesktopRuntime.mockReturnValue(true);
    mockClearAllSessions.mockResolvedValue(undefined);
    mockOnMenuLogout.mockImplementation((listener: () => void) => {
      mockLogoutListener = listener;
      return unsubscribe;
    });
    Object.defineProperty(window, "desktopApi", {
      configurable: true,
      value: {
        isDesktop: true,
        auth: { clearAllSessions: mockClearAllSessions },
        onMenuLogout: mockOnMenuLogout,
      },
    });
    const view = render(<SpaApplication />);

    expect(mockOnMenuLogout).toHaveBeenCalledWith(expect.any(Function));
    expect(mockLogoutListener).toEqual(expect.any(Function));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      mockLogoutListener?.();
      await Promise.resolve();
    });
    expect(mockClearAllSessions).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
