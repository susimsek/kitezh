import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "next-i18next/client";

import dictionary from "@/locales/en/common.json";
import config from "@/i18n.config";

import { CibaApprovalPanel } from "./CibaApprovalPanel";

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

function renderPanel() {
  return render(
    <I18nProvider
      defaultNS={config.defaultNS}
      fallbackLng={config.fallbackLng}
      language="en"
      resources={config.resources}
      supportedLngs={config.supportedLngs}
    >
      <CibaApprovalPanel dictionary={dictionary} />
    </I18nProvider>,
  );
}

describe("CIBA approval panel", () => {
  beforeEach(() => {
    mockRequestAccount.mockReset();
    mockAddAlert.mockReset();
    mockAddError.mockReset();
  });

  it("lists pending requests and approves with the user code", async () => {
    mockRequestAccount
      .mockResolvedValueOnce({
        content: [
          {
            authReqId: "request",
            userCode: "K7P4M2Q9",
            bindingMessage: "Approve sign in",
            authorizedScopes: "openid profile",
            deliveryMode: "poll",
            createdAt: "2026-01-01T00:00:00Z",
            expiresAt: "2026-01-01T00:05:00Z",
            status: "PENDING",
            mfaRequired: false,
            stepUpRequired: false,
          },
        ],
      })
      .mockResolvedValueOnce(undefined);

    renderPanel();

    expect(await screen.findByText("K7P4M2Q9")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenLastCalledWith("access-token", {
        method: "POST",
        url: "/api/ciba/requests/request/approve?user_code=K7P4M2Q9",
      }),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.account.security.ciba.approved);
  });

  it("shows an empty state when no request is pending", async () => {
    mockRequestAccount.mockResolvedValue({ content: [] });

    renderPanel();

    expect(await screen.findByText(dictionary.account.security.ciba.empty)).toBeVisible();
  });
});
