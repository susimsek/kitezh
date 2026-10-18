import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { registerPasskey } from "@/lib/webauthn";

import { RequiredActionsPage } from "./RequiredActionsPage";

const mockRegisterPasskey = registerPasskey as jest.MockedFunction<typeof registerPasskey>;

jest.mock("@/lib/webauthn", () => ({ registerPasskey: jest.fn() }));

jest.mock("@/routing/navigation", () => ({
  useSearchParams: () => new URLSearchParams("return_to=%2Fauthorize%3Fclient_id%3Ddemo"),
}));

describe("RequiredActionsPage error and validation flows", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("shows the fatal error state when required actions cannot be loaded", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.requiredActions.error)).toBeVisible();
  });

  it("validates password policy before submitting an update-password action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          key: "UPDATE_PASSWORD",
          displayName: "Update password",
          description: "Choose a strong password",
          version: 1,
        },
      ],
    });

    render(<RequiredActionsPage dictionary={dictionary} />);

    const submit = await screen.findByRole("button", {
      name: dictionary.requiredActions.continue,
    });
    fireEvent.click(submit);

    expect(
      await screen.findByText(dictionary.requiredActions.passwordMissingPrefix, {
        exact: false,
      }),
    ).toBeVisible();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows a server detail when completing a non-TOTP action fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            key: "ACCEPT_TERMS",
            displayName: "Accept terms",
            description: "Review the terms",
            version: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: "The action could not be saved" }),
      });

    render(<RequiredActionsPage dictionary={dictionary} />);

    fireEvent.click(await screen.findByRole("button", { name: dictionary.requiredActions.accept }));

    expect(await screen.findByText("The action could not be saved")).toBeVisible();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("validates required profile fields before posting an update-profile action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          key: "UPDATE_PROFILE",
          displayName: "Update profile",
          description: "Complete your profile",
          version: 1,
        },
      ],
    });

    render(<RequiredActionsPage dictionary={dictionary} />);

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.requiredActions.continue }),
    );

    expect(await screen.findAllByText(dictionary.requiredActions.required)).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows setup detail when loading TOTP configuration fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            key: "CONFIGURE_TOTP",
            displayName: "Configure authenticator",
            description: "Set up a code generator",
            version: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "TOTP setup is unavailable" }),
      });

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(await screen.findByText("TOTP setup is unavailable")).toBeVisible();
  });

  it("shows a fallback error when recovery-code setup has no server detail", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            key: "RECOVERY_CODES",
            displayName: "Save recovery codes",
            description: "Keep backup codes somewhere safe",
            version: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("empty response body");
        },
      });

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.requiredActions.error)).toBeVisible();
  });

  it("requires saving recovery codes before continuing and shows completion failures", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            key: "RECOVERY_CODES",
            displayName: "Save recovery codes",
            description: "Keep backup codes somewhere safe",
            version: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ codes: ["ABCD-1234", "WXYZ-9876"], remaining: 2 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: " " }),
      });

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(await screen.findByText("ABCD-1234")).toBeVisible();
    const continueButton = screen.getByRole("button", {
      name: dictionary.requiredActions.continue,
    });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(dictionary.requiredActions.recoverySaved));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(await screen.findByText(dictionary.requiredActions.error)).toBeVisible();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
  });

  it("shows the passkey registration error without submitting the action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          key: "CONFIGURE_PASSKEY",
          displayName: "Add a passkey",
          description: "Register a passkey",
          version: 1,
        },
      ],
    });
    mockRegisterPasskey.mockRejectedValueOnce(new Error("Passkey registration failed"));

    render(<RequiredActionsPage dictionary={dictionary} />);

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.requiredActions.passkeyRegister }),
    );

    expect(await screen.findByText("Passkey registration failed")).toBeVisible();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
