import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "next-i18next/client";

import dictionary from "@/locales/en/common.json";
import config from "@/i18n.config";

import { SocialAccountLinks } from "./SocialAccountLinks";

const mockRequestAccount = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/routing/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/components/account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "access-token" }),
}));

jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({
    addAlert: mockAddAlert,
    addError: mockAddError,
  }),
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
      <SocialAccountLinks dictionary={dictionary} />
    </I18nProvider>,
  );
}

describe("social account links", () => {
  beforeEach(() => {
    mockRequestAccount.mockReset();
    mockSearchParams = new URLSearchParams();
    mockAddAlert.mockReset();
    mockAddError.mockReset();
  });

  it("routes the link callback success through the shared alert", async () => {
    mockSearchParams = new URLSearchParams("social_linked=1");
    mockRequestAccount.mockResolvedValue([]);

    renderSettings();

    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.account.security.socialLinks.success),
    );
  });

  it("shows connect for unlinked providers and remove for linked providers", async () => {
    mockRequestAccount.mockResolvedValue([
      { provider: "google", displayName: "Google", linked: true, configured: true, enabled: true },
      { provider: "github", displayName: "GitHub", linked: false, configured: true, enabled: true },
      {
        provider: "microsoft",
        displayName: "Microsoft",
        linked: false,
        configured: false,
        enabled: true,
      },
    ]);

    renderSettings();

    expect(await screen.findByRole("button", { name: /Remove/ })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Connect/ })).toHaveLength(2);
    expect(screen.getByText("Not configured by an administrator")).toBeVisible();
  });

  it("removes a linked provider after confirmation", async () => {
    mockRequestAccount
      .mockResolvedValueOnce([
        {
          provider: "google",
          displayName: "Google",
          linked: true,
          configured: true,
          enabled: true,
        },
      ])
      .mockResolvedValueOnce(undefined);

    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: /Remove/ }));
    const removeButtons = screen.getAllByRole("button", { name: /^Remove$/ });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith("access-token", {
        method: "DELETE",
        url: "/api/account/social-links/google",
      }),
    );
  });

  it("keeps a linked provider removable after an administrator disables it", async () => {
    mockRequestAccount.mockResolvedValue([
      { provider: "github", displayName: "GitHub", linked: true, configured: true, enabled: false },
    ]);

    renderSettings();

    expect(await screen.findByRole("button", { name: /Remove/ })).toBeEnabled();
  });

  it("starts configured links and reports loading and removal failures", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    mockRequestAccount.mockResolvedValue([
      { provider: "github", displayName: "GitHub", linked: false, configured: true, enabled: true },
    ]);
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: /Connect/ }));
    expect(open).toHaveBeenCalledWith("/account/social-links/github/start", "_self");
    open.mockRestore();

    mockRequestAccount.mockRejectedValueOnce(new Error("offline"));
    renderSettings();
    expect(await screen.findByText(dictionary.account.security.socialLinks.error)).toBeVisible();

    mockRequestAccount
      .mockResolvedValueOnce([
        {
          provider: "google",
          displayName: "Google",
          linked: true,
          configured: true,
          enabled: true,
        },
      ])
      .mockRejectedValueOnce(new Error("remove failed"));
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: /Remove/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Remove$/ }).at(-1)!);
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(
        dictionary.account.security.socialLinks.removeError,
      ),
    );
  });
});
