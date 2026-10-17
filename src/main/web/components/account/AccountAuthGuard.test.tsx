import { render, screen, waitFor } from "@testing-library/react";

import { accountRequest, registerAccountTokenHandlers } from "@/lib/account-api";

import { AccountAuthGuard } from "./AccountAuthGuard";

const mockAccountRequest = accountRequest as jest.MockedFunction<typeof accountRequest>;
const mockRegisterAccountTokenHandlers = registerAccountTokenHandlers as jest.MockedFunction<
  typeof registerAccountTokenHandlers
>;
const mockBeginAuthorization = jest.fn().mockResolvedValue(undefined);
const mockRefreshAccessToken = jest.fn().mockResolvedValue("new-token");
const mockSetUsername = jest.fn();
const mockRouterReplace = jest.fn();
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

describe("AccountAuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = "/account/applications";
    searchParams = new URLSearchParams();
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
});
