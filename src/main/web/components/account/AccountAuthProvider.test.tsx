import { fireEvent, render, screen } from "@testing-library/react";

import { useConsoleAuth } from "@/lib/console-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { AccountAuthProvider, useAccountAuth } from "./AccountAuthProvider";

jest.mock("@/lib/console-auth", () => ({
  CONSOLE_TRANSACTION_KEYS: { account: "account-transaction" },
  useConsoleAuth: jest.fn(),
}));

jest.mock("@/store/hooks", () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

jest.mock("@/store/auth-slice", () => ({
  setConsoleUsername: (payload: unknown) => ({ type: "auth/setConsoleUsername", payload }),
}));

const mockUseConsoleAuth = useConsoleAuth as jest.MockedFunction<typeof useConsoleAuth>;
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

function Consumer() {
  const auth = useAccountAuth();
  return (
    <>
      <span data-testid="access-token">{auth.accessToken}</span>
      <span data-testid="username">{auth.username}</span>
      <button type="button" onClick={() => auth.setUsername("Grace")}>
        set
      </button>
    </>
  );
}

describe("AccountAuthProvider", () => {
  it("combines console runtime and Redux account state", () => {
    const logout = jest.fn();
    const dispatch = jest.fn();
    mockUseConsoleAuth.mockReturnValue({
      clearLocalSession: jest.fn(),
      refreshAccessToken: jest.fn(),
      logout,
      beginAuthorization: jest.fn(),
      completeAuthorization: jest.fn(),
    } as unknown as ReturnType<typeof useConsoleAuth>);
    mockUseAppDispatch.mockReturnValue(dispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({
        auth: { account: { accessToken: "token", username: "Ada" } },
      } as never),
    );

    render(
      <AccountAuthProvider>
        <Consumer />
      </AccountAuthProvider>,
    );
    expect(screen.getByTestId("access-token")).toHaveTextContent("token");
    expect(screen.getByTestId("username")).toHaveTextContent("Ada");
    fireEvent.click(screen.getByRole("button", { name: "set" }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "auth/setConsoleUsername",
      payload: { console: "account", username: "Grace" },
    });
  });

  it("requires the provider runtime", () => {
    mockUseAppDispatch.mockReturnValue(jest.fn());
    mockUseAppSelector.mockReturnValue({ accessToken: null } as never);
    expect(() => render(<Consumer />)).toThrow("AccountAuthProvider is required");
  });
});
