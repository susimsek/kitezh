import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { accountRequest, registerAccountTokenHandlers } from "@/lib/account-api";
import { isDesktopRuntime } from "@/lib/desktop-api";

import { AccountAuthGuard } from "./AccountAuthGuard";

const mockAccountRequest = accountRequest as jest.MockedFunction<typeof accountRequest>;
const mockRegisterAccountTokenHandlers = registerAccountTokenHandlers as jest.MockedFunction<
  typeof registerAccountTokenHandlers
>;
const mockBeginAuthorization = jest.fn().mockResolvedValue(undefined);
const mockRefreshAccessToken = jest.fn().mockResolvedValue("new-token");
const mockSetUsername = jest.fn();
const mockRouterReplace = jest.fn();
const mockIsDesktopRuntime = isDesktopRuntime as jest.MockedFunction<typeof isDesktopRuntime>;
let pathname = "/account/applications";
let searchParams = new URLSearchParams();
let auth = {
  accessToken: "token" as string | null,
  beginAuthorization: mockBeginAuthorization,
  expiresAt: null as number | null,
  initialized: true,
  isLoggingOut: false,
  refreshAccessToken: mockRefreshAccessToken,
  setUsername: mockSetUsername,
};

jest.mock("@/lib/account-api", () => ({
  accountRequest: jest.fn(),
  registerAccountTokenHandlers: jest.fn(),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: mockRouterReplace }),
}));
jest.mock("./AccountAuthProvider", () => ({ useAccountAuth: () => auth }));
jest.mock("@/lib/desktop-api", () => ({
  ...jest.requireActual("@/lib/desktop-api"),
  isDesktopRuntime: jest.fn(() => false),
}));

describe("AccountAuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = "/account/applications";
    searchParams = new URLSearchParams();
    mockIsDesktopRuntime.mockReturnValue(false);
    auth = {
      accessToken: "token",
      beginAuthorization: mockBeginAuthorization,
      expiresAt: null,
      initialized: true,
      isLoggingOut: false,
      refreshAccessToken: mockRefreshAccessToken,
      setUsername: mockSetUsername,
    };
    mockAccountRequest.mockResolvedValue({ status: 200, data: { username: "admin" } } as never);
  });

  it.each([
    ["initialization", { initialized: false }],
    ["logout", { isLoggingOut: true }],
  ])("shows a loading state during %s", async (_, state) => {
    auth = { ...auth, ...state };

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    expect(screen.getByRole("status")).toBeVisible();
    expect(mockAccountRequest).not.toHaveBeenCalled();
  });

  it("shows and completes the desktop browser sign-in action", async () => {
    mockIsDesktopRuntime.mockReturnValue(true);
    auth = { ...auth, accessToken: null };
    let finishLogin!: () => void;
    mockBeginAuthorization.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishLogin = resolve;
      }),
    );

    render(<AccountAuthGuard locale="tr">Account</AccountAuthGuard>);

    const signInButton = screen.getByRole("button", { name: /browser/i });
    expect(signInButton).toBeEnabled();
    fireEvent.click(signInButton);
    await waitFor(() => expect(mockBeginAuthorization).toHaveBeenCalledWith("tr", "/"));
    expect(signInButton).toBeDisabled();
    expect(signInButton).toHaveAttribute("aria-busy", "true");

    finishLogin();
    await waitFor(() => expect(signInButton).toBeEnabled());
  });

  it("starts desktop sign-in from the requested route and shows an authorization error", async () => {
    mockIsDesktopRuntime.mockReturnValue(true);
    searchParams = new URLSearchParams("desktopSignIn=1");
    auth = { ...auth, accessToken: null };
    mockBeginAuthorization.mockRejectedValueOnce(new Error("desktop login unavailable"));

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    await waitFor(() => expect(mockBeginAuthorization).toHaveBeenCalledWith("en", "/"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole("button", { name: /browser/i })).toBeEnabled();
  });

  it("shows an authorization error after browser sign-in cannot start", async () => {
    mockBeginAuthorization.mockRejectedValueOnce(new Error("authorization unavailable"));
    auth = { ...auth, accessToken: null };

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(mockAccountRequest).not.toHaveBeenCalled();
  });

  it("starts one authorization request to restore the browser SSO session", async () => {
    auth = { ...auth, accessToken: null };

    render(<AccountAuthGuard locale="tr">Protected</AccountAuthGuard>);

    await waitFor(() => expect(mockBeginAuthorization).toHaveBeenCalledWith("tr", "/"));
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("loads the account profile after an access token is available", async () => {
    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    expect(await screen.findByText("Account")).toBeVisible();
    expect(mockSetUsername).toHaveBeenCalledWith("admin");
    expect(mockRegisterAccountTokenHandlers).toHaveBeenCalledWith({
      refresh: mockRefreshAccessToken,
      unauthorized: expect.any(Function),
    });
  });

  it("routes to the localized server error page when profile loading fails", async () => {
    mockAccountRequest.mockRejectedValueOnce(new Error("service unavailable"));

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith("/auth-error?type=server_error"),
    );
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });

  it("does not authorize a profile response that requires reauthentication", async () => {
    mockAccountRequest.mockResolvedValueOnce({ status: 401, data: null } as never);

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    await waitFor(() => expect(mockAccountRequest).toHaveBeenCalled());
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(mockSetUsername).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("routes non-success profile responses to the server error page", async () => {
    mockAccountRequest.mockResolvedValueOnce({ status: 403, data: null } as never);

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith("/auth-error?type=server_error"),
    );
    expect(mockSetUsername).not.toHaveBeenCalled();
  });

  it("ignores a canceled profile request without redirecting", async () => {
    mockAccountRequest.mockRejectedValueOnce(
      Object.assign(new Error("request canceled"), { code: "ERR_CANCELED" }),
    );

    render(<AccountAuthGuard locale="en">Account</AccountAuthGuard>);

    await waitFor(() => expect(mockAccountRequest).toHaveBeenCalled());
    await waitFor(() => expect(mockSetUsername).not.toHaveBeenCalled());
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("renders callback content without making a profile request", () => {
    pathname = "/en/account/callback/";

    render(
      <AccountAuthGuard locale="en" callbackContent={<div>Callback complete</div>}>
        Account
      </AccountAuthGuard>,
    );

    expect(screen.getByText("Callback complete")).toBeVisible();
    expect(mockAccountRequest).not.toHaveBeenCalled();
  });

  it("renders the protected child when callback content is not supplied", () => {
    pathname = "/en/account/callback";

    render(<AccountAuthGuard locale="en">Callback child</AccountAuthGuard>);

    expect(screen.getByText("Callback child")).toBeVisible();
    expect(mockAccountRequest).not.toHaveBeenCalled();
  });
});
