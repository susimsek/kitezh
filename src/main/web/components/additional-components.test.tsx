import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { requestAccount } from "@/lib/account-api";

import { AccountDeleteForm } from "./account/AccountDeleteForm";
import { AccountPasswordForm } from "./account/AccountPasswordForm";
import { AccountBreadcrumb } from "./account/AccountBreadcrumb";
import { AccountPageHeader } from "./account/AccountPageHeader";
import { FormSection } from "./admin/FormSection";

const mockRequestAccount = requestAccount as jest.MockedFunction<typeof requestAccount>;
const mockClearLocalSession = jest.fn();
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/account-api", () => ({ requestAccount: jest.fn() }));
jest.mock("./account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({
    accessToken: "account-token",
    clearLocalSession: mockClearLocalSession,
  }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));

describe("additional account and shared components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestAccount.mockReset();
  });

  it("renders account headings, breadcrumbs, and form sections", () => {
    render(
      <>
        <AccountBreadcrumb homeLabel="Account" current="Security" />
        <AccountPageHeader
          title="Security"
          description="Manage security"
          actions={<button>Action</button>}
        />
        <FormSection title="Profile" description="Profile details" className="custom">
          <span>Body</span>
        </FormSection>
        <FormSection title="Empty description">
          <span>Second body</span>
        </FormSection>
      </>,
    );

    expect(screen.getByText("Account")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Security" })).toBeVisible();
    expect(screen.getByText("Manage security")).toBeVisible();
    expect(screen.getByText("Profile")).toBeVisible();
    expect(screen.getByText("Profile details")).toBeVisible();
    expect(screen.getByText("Body").parentElement?.parentElement).toHaveClass("custom");
    expect(screen.getByText("Second body")).toBeVisible();
  });

  it("validates and reports account deletion failures", async () => {
    mockRequestAccount.mockRejectedValueOnce({ data: { detail: "Wrong password" } });
    render(<AccountDeleteForm dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.account.deleteAccount.submit }));
    expect(await screen.findByText(dictionary.account.validation.required)).toBeVisible();

    fireEvent.change(screen.getByLabelText(dictionary.account.deleteAccount.currentPassword), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.deleteAccount.submit }));

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith(
        "account-token",
        expect.objectContaining({
          method: "DELETE",
          url: "/api/account",
          data: { currentPassword: "wrong-password" },
        }),
      ),
    );
    expect(await screen.findByText(dictionary.account.deleteAccount.error)).toBeVisible();
    expect(mockClearLocalSession).not.toHaveBeenCalled();
  });

  it("enforces password policy and handles a successful password update", async () => {
    mockRequestAccount.mockResolvedValueOnce({ status: 204, data: null } as never);
    render(<AccountPasswordForm dictionary={dictionary} />);

    const current = screen.getByLabelText(new RegExp(dictionary.account.security.currentPassword));
    const next = screen.getByLabelText(new RegExp(dictionary.account.security.newPassword));
    const confirm = screen.getByLabelText(new RegExp(dictionary.account.security.confirmPassword));
    const submit = screen.getByRole("button", { name: dictionary.account.common.save });

    expect(submit).toBeDisabled();
    fireEvent.change(current, { target: { value: "current-password" } });
    fireEvent.change(next, { target: { value: "current-password" } });
    fireEvent.change(confirm, { target: { value: "different-password" } });
    expect(screen.getByText(dictionary.account.security.policyDifferent)).toBeVisible();
    fireEvent.click(submit);
    expect(await screen.findByText(dictionary.account.validation.passwordSame)).toBeVisible();

    fireEvent.change(next, { target: { value: "new-password-123" } });
    fireEvent.change(confirm, { target: { value: "new-password-123" } });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith(
        "account-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/account/password",
          data: { currentPassword: "current-password", newPassword: "new-password-123" },
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.account.security.saved);
  });
});
