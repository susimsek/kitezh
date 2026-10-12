import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { isDesktopRuntime, setDesktopConnectivity } from "@/lib/desktop-api";

import { DesktopCompanion } from "./DesktopCompanion";
import { DesktopConnectivityBanner } from "./DesktopConnectivityBanner";
import { DesktopConsoleChooser } from "./DesktopConsoleChooser";
import { DesktopSignInScreen } from "./DesktopSignInScreen";
import { DesktopUpdateBanner } from "./DesktopUpdateBanner";

const mockPush = jest.fn();
const mockIsDesktop = isDesktopRuntime as jest.MockedFunction<typeof isDesktopRuntime>;
const mockSetConnectivity = setDesktopConnectivity as jest.MockedFunction<
  typeof setDesktopConnectivity
>;
let updateListener:
  ((status: { state: string; version?: string; percent?: number }) => void) | null = null;

jest.mock("@/lib/desktop-api", () => ({
  isDesktopRuntime: jest.fn(),
  setDesktopConnectivity: jest.fn(),
  apiUrl: (path: string) => path,
}));
jest.mock("@/i18n/client", () => ({ useDictionary: () => dictionary }));
jest.mock("@/routing/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("./ActionIcon", () => ({ ActionIcon: () => <span aria-hidden="true" /> }));
jest.mock("./BrandLogo", () => ({ BrandLogo: () => <span aria-hidden="true" /> }));

describe("desktop runtime components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDesktop.mockReturnValue(true);
    updateListener = null;
    Object.defineProperty(window, "desktopApi", {
      configurable: true,
      value: {
        companion: { openConsole: jest.fn().mockResolvedValue(undefined) },
        updates: {
          onStatus: jest.fn((listener) => {
            updateListener = listener;
            return jest.fn();
          }),
        },
      },
    });
  });

  afterEach(() => {
    delete (window as { desktopApi?: unknown }).desktopApi;
  });

  it("routes to each console from the chooser", () => {
    render(<DesktopConsoleChooser dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.desktop.adminConsole }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.desktop.accountConsole }));

    expect(mockPush).toHaveBeenNthCalledWith(1, "/admin?desktopSignIn=1");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/account/personal-info?desktopSignIn=1");
  });

  it("renders sign-in error and busy states and invokes the sign-in action", () => {
    const onSignIn = jest.fn();
    const { rerender } = render(
      <DesktopSignInScreen dictionary={dictionary} pending={false} error onSignIn={onSignIn} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(dictionary.desktop.signInUnavailable);
    fireEvent.click(screen.getByRole("button", { name: dictionary.desktop.signInWithBrowser }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    rerender(
      <DesktopSignInScreen dictionary={dictionary} pending onSignIn={onSignIn} error={false} />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: dictionary.desktop.signInWithBrowser }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: dictionary.desktop.signInWithBrowser }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("opens a console from the companion and restores the buttons after completion", async () => {
    let finishOpen: (() => void) | undefined;
    const openConsole = jest.fn(() => new Promise<void>((resolve) => (finishOpen = resolve)));
    Object.assign(window.desktopApi!, { companion: { openConsole } });
    render(<DesktopCompanion dictionary={dictionary} />);

    const adminButton = screen.getByRole("button", { name: dictionary.desktop.adminConsole });
    fireEvent.click(adminButton);
    expect(adminButton).toBeDisabled();
    expect(adminButton.querySelector(".spinner-border")).not.toBeNull();
    expect(openConsole).toHaveBeenCalledWith("admin");

    await act(async () => finishOpen?.());
    await waitFor(() => expect(adminButton).toBeEnabled());
  });

  it("probes connectivity, handles offline events, and cleans up listeners", async () => {
    const online = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as typeof fetch;
    const { unmount } = render(<DesktopConnectivityBanner />);

    await waitFor(() => expect(mockSetConnectivity).toHaveBeenCalledWith(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/branding",
      expect.objectContaining({ credentials: "omit" }),
    );
    act(() => window.dispatchEvent(new Event("offline")));
    expect(mockSetConnectivity).toHaveBeenLastCalledWith(false);
    unmount();

    mockIsDesktop.mockReturnValue(false);
    render(<DesktopConnectivityBanner />);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    if (online) Object.defineProperty(window.navigator, "onLine", online);
  });

  it("shows actionable update states and removes the status listener", () => {
    const { unmount } = render(<DesktopUpdateBanner />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => updateListener?.({ state: "recovered", version: "2.0.0" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      dictionary.desktop.updateRecovered.replace("{version}", "2.0.0"),
    );
    act(() => updateListener?.({ state: "error" }));
    expect(screen.getByRole("status")).toHaveTextContent(dictionary.desktop.updateError);
    act(() => updateListener?.({ state: "downloading", percent: 48.6 }));
    expect(screen.getByRole("status")).toHaveTextContent(
      dictionary.desktop.updateDownloading.replace("{percent}", "49"),
    );
    act(() => updateListener?.({ state: "checking" }));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    expect(window.desktopApi?.updates.onStatus).toHaveBeenCalled();
  });
});
