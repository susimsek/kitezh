import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { StoreProvider } from "@/store/StoreProvider";
import { AppRoutes } from "./AppRoutes";

const mockClearLocalSession = jest.fn();

jest.mock("@/components/account/AccountAuthProvider", () => ({
  AccountAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAccountAuth: () => ({ clearLocalSession: mockClearLocalSession }),
}));
jest.mock("@/components/account/AccountAuthGuard", () => ({
  AccountAuthGuard: ({
    children,
    callbackContent,
  }: {
    children: React.ReactNode;
    callbackContent: React.ReactNode;
  }) => children ?? callbackContent,
}));
jest.mock("@/components/account/AccountShell", () => ({
  AccountShell: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/account/AccountProfileForm", () => ({
  AccountProfileForm: () => <div>account-profile-form</div>,
}));
jest.mock("@/components/account/AccountDeleteForm", () => ({
  AccountDeleteForm: () => <div>account-delete-form</div>,
}));
jest.mock("@/components/account/AccountPasswordForm", () => ({
  AccountPasswordForm: () => <div>account-password-form</div>,
}));
jest.mock("@/components/account/SocialAccountLinks", () => ({
  SocialAccountLinks: () => <div>account-social-links</div>,
}));
jest.mock("@/components/account/CibaApprovalPanel", () => ({
  CibaApprovalPanel: () => <div>account-ciba-approvals</div>,
}));
jest.mock("@/components/account/MfaSettings", () => ({
  MfaSettings: () => <div>account-mfa-settings</div>,
}));
jest.mock("@/components/account/PasskeySettings", () => ({
  PasskeySettings: () => <div>account-passkey-settings</div>,
}));
jest.mock("@/components/account/AccountSessions", () => ({
  AccountSessions: () => <div>account-sessions</div>,
}));
jest.mock("@/components/account/AccountApplications", () => ({
  AccountApplications: () => <div>account-applications</div>,
}));

function openRoute(path: string) {
  return render(
    <StoreProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </StoreProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it.each([
  ["/account", "account-profile-form", "account-delete-form"],
  ["/account/security", "account-password-form", "account-mfa-settings"],
  ["/account/sessions", "account-sessions", null],
  ["/account/applications", "account-applications", null],
])("renders the account layout and requested section at %s", (path, first, second) => {
  openRoute(path);
  expect(screen.getByText(first)).toBeVisible();
  if (second) expect(screen.getByText(second)).toBeVisible();
});

it("clears an impersonated session before leaving the account route", async () => {
  openRoute("/account/personal-info?impersonated=1");
  await waitFor(() => expect(mockClearLocalSession).toHaveBeenCalledTimes(1));
});
