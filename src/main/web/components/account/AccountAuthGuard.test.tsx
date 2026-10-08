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
let pathname = "/account/applications";
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
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("./AccountAuthProvider", () => ({ useAccountAuth: () => auth }));

describe("AccountAuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = "/account/applications";
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
});
