import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "next-i18next/client";

import dictionary from "@kitezh/shared/web-messages/en";
import config from "@/i18n.config";

import { PersonalAccessTokens } from "./PersonalAccessTokens";

const mockRequestAccount = jest.fn();
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/components/account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "access-token" }),
}));

jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

jest.mock("@/lib/account-api", () => ({
  requestAccount: (...args: unknown[]) => mockRequestAccount(...args),
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
      <PersonalAccessTokens dictionary={dictionary} />
    </I18nProvider>,
  );
}

const token = {
  id: "token-1",
  name: "Codex",
  createdAt: "2026-01-01T12:00:00Z",
  expiresAt: "2026-04-01T12:00:00Z",
  scope: "mcp.read",
};

describe("personal access tokens", () => {
  beforeEach(() => {
    mockRequestAccount.mockReset();
    mockAddAlert.mockReset();
    mockAddError.mockReset();
  });

  it("loads the token list with its narrow scope and expiry metadata", async () => {
    mockRequestAccount.mockResolvedValue([token]);

    renderSettings();

    expect(await screen.findByText("Codex")).toBeVisible();
    expect(screen.getAllByText("mcp.read")).toHaveLength(2);
    expect(screen.getByText(/Expires:/)).toBeVisible();
    expect(mockRequestAccount).toHaveBeenCalledWith("access-token", {
      method: "GET",
      url: "/api/account/personal-access-tokens",
    });
  });

  it("requires a name before creating a token", async () => {
    mockRequestAccount.mockResolvedValue([]);
    renderSettings();

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.nameRequired),
    ).toBeVisible();
    expect(mockRequestAccount).toHaveBeenCalledTimes(1);
  });

  it("creates a token, displays the secret once, and copies it on request", async () => {
    mockRequestAccount
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ...token, token: "kzh_pat_once" })
      .mockResolvedValueOnce([token]);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderSettings();

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "Codex" } });
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "Codex on laptop" },
    });
    fireEvent.change(screen.getByLabelText("Expires after"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    expect(await screen.findByText("kzh_pat_once")).toBeVisible();
    expect(mockRequestAccount).toHaveBeenNthCalledWith(2, "access-token", {
      method: "POST",
      url: "/api/account/personal-access-tokens",
      data: { name: "Codex", description: "Codex on laptop", expiration: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Copy token/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("kzh_pat_once"));
    expect(mockAddAlert).toHaveBeenCalledWith(
      dictionary.account.security.personalAccessTokens.copied,
    );

    fireEvent.click(screen.getByRole("button", { name: /Hide token/i }));
    expect(screen.queryByText("kzh_pat_once")).not.toBeInTheDocument();
  });

  it("allows a token with no expiry and warns that it must be revoked manually", async () => {
    mockRequestAccount
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ...token, expiresAt: null, token: "kzh_pat_forever" })
      .mockResolvedValueOnce([{ ...token, expiresAt: null }]);
    renderSettings();

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Token name"), {
      target: { value: "Persistent client" },
    });
    fireEvent.change(screen.getByLabelText("Expires after"), { target: { value: "never" } });

    expect(
      screen.getByText(dictionary.account.security.personalAccessTokens.neverExpiresWarning),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    expect(await screen.findByText("kzh_pat_forever")).toBeVisible();
    expect(mockRequestAccount).toHaveBeenNthCalledWith(2, "access-token", {
      method: "POST",
      url: "/api/account/personal-access-tokens",
      data: { name: "Persistent client", description: null, expiration: "never" },
    });
    expect(await screen.findByText(/Expires: Never expires/)).toBeVisible();
  });

  it("requires and submits a custom expiration date", async () => {
    mockRequestAccount
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ...token, token: "kzh_pat_custom" })
      .mockResolvedValueOnce([token]);
    renderSettings();

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "Custom client" } });
    fireEvent.change(screen.getByLabelText("Expires after"), { target: { value: "custom" } });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.customDateRequired),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Custom date"), { target: { value: "2027-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    expect(await screen.findByText("kzh_pat_custom")).toBeVisible();
    expect(mockRequestAccount).toHaveBeenNthCalledWith(2, "access-token", {
      method: "POST",
      url: "/api/account/personal-access-tokens",
      data: {
        name: "Custom client",
        description: null,
        expiration: "custom",
        customExpirationDate: "2027-01-15",
      },
    });
  });

  it("keeps custom expiration dates within the backend's supported range", async () => {
    mockRequestAccount.mockResolvedValue([]);
    renderSettings();

    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "Custom client" } });
    fireEvent.change(screen.getByLabelText("Expires after"), { target: { value: "custom" } });

    const today = new Date().toISOString().slice(0, 10);
    const dateInput = screen.getByLabelText("Custom date");
    fireEvent.change(dateInput, { target: { value: today } });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));
    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.customDateTooEarly),
    ).toBeVisible();

    const tooLate = new Date(`${today}T00:00:00.000Z`);
    tooLate.setUTCFullYear(tooLate.getUTCFullYear() + 1);
    tooLate.setUTCDate(tooLate.getUTCDate() + 1);
    fireEvent.change(dateInput, { target: { value: tooLate.toISOString().slice(0, 10) } });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));
    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.customDateTooLate),
    ).toBeVisible();
    expect(mockRequestAccount).toHaveBeenCalledTimes(1);
  });

  it("shows a page loading state and hides controls until the token list arrives", async () => {
    let resolveList: (value: Array<typeof token>) => void = () => {};
    mockRequestAccount.mockReturnValueOnce(
      new Promise<Array<typeof token>>((resolve) => {
        resolveList = resolve;
      }),
    );
    renderSettings();

    expect(await screen.findByText(dictionary.account.common.loading)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Create token/i })).not.toBeInTheDocument();

    resolveList([]);
    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Create token/i })).toBeEnabled();
  });

  it("revokes a selected token after confirmation and reloads the list", async () => {
    mockRequestAccount
      .mockResolvedValueOnce([token])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Revoke/ }).at(-1)!);

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenNthCalledWith(2, "access-token", {
        method: "DELETE",
        url: "/api/account/personal-access-tokens/token-1",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(
      dictionary.account.security.personalAccessTokens.revoked,
    );
  });

  it("reports load and create failures", async () => {
    mockRequestAccount.mockRejectedValueOnce(new Error("offline"));
    renderSettings();
    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.loadError),
    ).toBeVisible();

    cleanup();
    mockRequestAccount.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
    renderSettings();
    expect(
      await screen.findByText(dictionary.account.security.personalAccessTokens.empty),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Token name"), { target: { value: "Codex" } });
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create token/i }));

    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(
        dictionary.account.security.personalAccessTokens.createError,
      ),
    );
  });
});
