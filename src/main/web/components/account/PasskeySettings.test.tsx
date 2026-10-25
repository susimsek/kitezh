import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "next-i18next/client";

import dictionary from "@kitezh/shared/web-messages/en";
import config from "@/i18n.config";

import { PasskeySettings } from "./PasskeySettings";

const mockRequestAccount = jest.fn();
const mockRegisterPasskey = jest.fn();
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/components/account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "access-token" }),
}));

jest.mock("@/lib/account-api", () => ({
  accountRequest: jest.fn(),
  requestAccount: (...args: unknown[]) => mockRequestAccount(...args),
}));

jest.mock("@/lib/webauthn", () => ({
  registerPasskey: (...args: unknown[]) => mockRegisterPasskey(...args),
}));

jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

function renderSettings() {
  return render(
    <I18nProvider
      defaultNS={config.defaultNS}
      fallbackLng={config.fallbackLng}
      language="en"
      resources={config.resources}
      supportedLngs={config.supportedLngs}
    >
      <PasskeySettings dictionary={dictionary} />
    </I18nProvider>,
  );
}

describe("passkey account settings", () => {
  beforeEach(() => {
    mockRequestAccount.mockReset();
    mockRegisterPasskey.mockReset();
    mockAddAlert.mockReset();
    mockAddError.mockReset();
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
  });

  it("lists a credential and removes it after confirmation", async () => {
    mockRequestAccount.mockResolvedValue({
      content: [
        {
          credentialId: "credential-id",
          label: "Office laptop",
          createdAt: "2026-01-01T00:00:00Z",
          lastUsedAt: "2026-01-02T00:00:00Z",
          transports: ["internal"],
          backupEligible: true,
          backupState: true,
        },
      ],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    });

    renderSettings();

    expect(await screen.findByText("Office laptop")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Remove: Office laptop/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${dictionary.account.security.passkeys.remove}$`),
      }),
    );

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith("access-token", {
        method: "DELETE",
        url: "/api/account/webauthn/credentials/credential-id",
      }),
    );
  });

  it("shows the empty state when no credentials are registered", async () => {
    mockRequestAccount.mockResolvedValue({
      content: [],
      page: { number: 0, size: 20, totalElements: 0, totalPages: 0 },
    });

    renderSettings();

    expect(await screen.findByText(dictionary.account.security.passkeys.empty)).toBeVisible();
  });

  it("shows unsupported WebAuthn when the browser has no credential API", async () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: undefined,
    });
    mockRequestAccount.mockResolvedValue({
      content: [],
      page: { number: 0, size: 20, totalElements: 0, totalPages: 0 },
    });

    renderSettings();

    expect(await screen.findByText(dictionary.account.security.passkeys.unsupported)).toBeVisible();
    expect(
      screen.getByRole("button", { name: dictionary.account.security.passkeys.add }),
    ).toBeDisabled();
  });

  it("handles a blank credential label and reports rename and removal failures", async () => {
    mockRequestAccount.mockResolvedValue({
      content: [
        {
          credentialId: "credential-id",
          label: "",
          createdAt: "2026-01-01T00:00:00Z",
          lastUsedAt: "2026-01-02T00:00:00Z",
          transports: [],
          backupEligible: false,
          backupState: false,
          signatureCount: 0,
          uvInitialized: false,
        },
      ],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    });

    renderSettings();

    expect(await screen.findByText(dictionary.account.security.passkeys.unnamed)).toBeVisible();
    expect(screen.getByText(dictionary.account.security.passkeys.transportUnknown)).toBeVisible();
    expect(
      screen
        .getByRole("button", {
          name: `${dictionary.account.security.passkeys.remove}: ${dictionary.account.security.passkeys.unnamed}`,
        })
        .closest(".account-session-card"),
    ).toHaveTextContent(dictionary.account.security.passkeys.no);
    const rowLabel = screen.getAllByLabelText(dictionary.account.security.passkeys.label).at(-1)!;
    fireEvent.change(rowLabel, { target: { value: "Renamed credential" } });
    mockRequestAccount.mockRejectedValueOnce(new Error("rename failed"));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.account.security.passkeys.rename }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.account.security.passkeys.renameError),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `${dictionary.account.security.passkeys.remove}: ${dictionary.account.security.passkeys.unnamed}`,
      }),
    );
    mockRequestAccount.mockRejectedValueOnce(new Error("remove failed"));
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${dictionary.account.security.passkeys.remove}$`),
      }),
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.account.security.passkeys.removeError),
    );
  });

  it("renders an error state when credentials cannot be loaded", async () => {
    mockRequestAccount.mockRejectedValue(new Error("load failed"));

    renderSettings();

    expect(await screen.findByText(dictionary.account.security.passkeys.error)).toBeVisible();
  });

  it("adds, renames, and reports passkey operation failures", async () => {
    const page = {
      content: [
        {
          credentialId: "credential-id",
          label: "Office laptop",
          createdAt: "2026-01-01T00:00:00Z",
          lastUsedAt: "2026-01-02T00:00:00Z",
          transports: [],
          backupEligible: false,
          backupState: false,
          signatureCount: 3,
          uvInitialized: true,
        },
      ],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    };
    mockRequestAccount.mockResolvedValue(page);
    mockRegisterPasskey.mockResolvedValue(undefined);
    renderSettings();

    const addLabel = (
      await screen.findAllByLabelText(dictionary.account.security.passkeys.label)
    )[0];
    fireEvent.change(addLabel, { target: { value: "New passkey" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.passkeys.add }));
    await waitFor(() =>
      expect(mockRegisterPasskey).toHaveBeenCalledWith(expect.any(Function), "New passkey"),
    );

    const rowLabel = screen.getAllByLabelText(dictionary.account.security.passkeys.label).at(-1)!;
    fireEvent.change(rowLabel, { target: { value: "Renamed" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.account.security.passkeys.rename }).at(-1)!,
    );
    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith("access-token", {
        method: "PUT",
        url: "/api/account/webauthn/credentials/credential-id",
        data: { label: "Renamed" },
      }),
    );

    mockRegisterPasskey.mockRejectedValue(new Error("registration failed"));
    fireEvent.change(screen.getAllByLabelText(dictionary.account.security.passkeys.label)[0], {
      target: { value: "Broken" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.passkeys.add }));
    await waitFor(() => expect(mockRegisterPasskey).toHaveBeenCalledTimes(2));
  });
});
