import { fireEvent, render, screen } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { requestAccount } from "@/lib/account-api";

import { AccountProfileForm } from "./AccountProfileForm";

const mockRequestAccount = requestAccount as jest.MockedFunction<typeof requestAccount>;

jest.mock("@/lib/account-api", () => ({ requestAccount: jest.fn() }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: jest.fn(), addError: jest.fn() }),
}));
jest.mock("@/components/account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "access-token" }),
}));
jest.mock("@/components/admin/AsyncState", () => ({
  DetailLoadingState: () => <div>loading-profile</div>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
}));
jest.mock("@/i18n/client", () => ({ useLocale: () => "en" }));
jest.mock("@/i18n/useDateTimeFormatter", () => ({ useDateTimeFormatter: () => jest.fn() }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { changeLanguage: jest.fn() } }),
}));

describe("AccountProfileForm loading failures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile") throw new Error("profile unavailable");
      if (request.url === "/api/account/profile/attributes") {
        return { definitions: [], attributes: {} } as never;
      }
      return { avatarUrl: null } as never;
    });
  });

  it("shows the shared error state when the profile endpoint fails", async () => {
    render(<AccountProfileForm dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.account.common.operationError)).toBeVisible();
  });

  it("shows the avatar upload error when the upload request fails", async () => {
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile") {
        return {
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          preferredLocale: "en",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        } as never;
      }
      if (request.url === "/api/account/profile/attributes") {
        return { definitions: [], attributes: {} } as never;
      }
      if (request.url === "/api/account/profile/avatar" && request.method === "PUT") {
        throw new Error("avatar upload failed");
      }
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);

    const upload = await screen.findByLabelText(dictionary.account.profile.uploadAvatar);
    fireEvent.change(upload, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });

    expect(await screen.findByText(dictionary.account.profile.avatarUploadError)).toBeVisible();
  });

  it("validates required and typed custom profile attributes, including malformed patterns", async () => {
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile") {
        return {
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          preferredLocale: "en",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        } as never;
      }
      if (request.url === "/api/account/profile/attributes") {
        return {
          definitions: [
            {
              name: "requiredDepartment",
              displayName: "Department",
              description: null,
              type: "STRING",
              required: true,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
            {
              name: "workEmail",
              displayName: "Work email",
              description: null,
              type: "EMAIL",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
            {
              name: "employeeNumber",
              displayName: "Employee number",
              description: null,
              type: "INTEGER",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
            {
              name: "malformedPattern",
              displayName: "Patterned value",
              description: null,
              type: "STRING",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: "[",
            },
            {
              name: "singleValue",
              displayName: "Single value",
              description: null,
              type: "STRING",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
          ],
          attributes: {
            requiredDepartment: [],
            workEmail: ["ada@example.test"],
            employeeNumber: ["1"],
            malformedPattern: ["valid"],
            singleValue: ["one", "two"],
          },
        } as never;
      }
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    await screen.findByLabelText("Department *");
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "not an email" } });
    fireEvent.change(screen.getByLabelText("Employee number"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Patterned value"), { target: { value: "invalid" } });
    fireEvent.click(screen.getByTestId("save-profile"));

    expect(await screen.findByText(dictionary.account.validation.required)).toBeVisible();
    expect(screen.getAllByText(dictionary.account.validation.invalid).length).toBeGreaterThan(0);
    expect(mockRequestAccount).not.toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({ method: "PUT", url: "/api/account/profile" }),
    );
  });
});
