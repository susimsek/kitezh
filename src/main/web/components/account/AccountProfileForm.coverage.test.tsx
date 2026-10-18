import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

  it("uses supported locales and keeps the profile usable with malformed optional data", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        internationalizationEnabled: true,
        defaultLocale: "en",
        supportedLocales: ["en", "tr", "fr"],
      }),
    }) as typeof fetch;
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile")
        return {
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          preferredLocale: "unknown",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        } as never;
      if (request.url === "/api/account/profile/attributes")
        return { definitions: null, attributes: { ignored: ["value"] } } as never;
      if (request.url === "/api/account/profile/avatar") throw new Error("avatar unavailable");
      return null as never;
    });

    try {
      render(<AccountProfileForm dictionary={dictionary} />);

      expect(await screen.findByDisplayValue("ada@example.test")).toBeVisible();
      expect(screen.getByLabelText(dictionary.account.profile.locale)).toHaveValue("en");
      expect(screen.getByRole("option", { name: "Türkçe" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "fr" })).not.toBeInTheDocument();
      expect(screen.queryByText(dictionary.account.common.operationError)).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/localization", {
        credentials: "same-origin",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it.each([
    {
      label: "uses the configured default when internationalization is disabled",
      settings: {
        internationalizationEnabled: false,
        defaultLocale: "tr",
        supportedLocales: ["en", "tr"],
      },
      expectedOption: "Türkçe",
    },
    {
      label: "falls back to English when no supported locale remains",
      settings: {
        internationalizationEnabled: true,
        defaultLocale: "fr",
        supportedLocales: ["fr"],
      },
      expectedOption: "English",
    },
  ])("$label", async ({ settings, expectedOption }) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => settings,
    }) as typeof fetch;
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile")
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
      if (request.url === "/api/account/profile/attributes")
        return { definitions: [], attributes: {} } as never;
      return { avatarUrl: null } as never;
    });

    try {
      render(<AccountProfileForm dictionary={dictionary} />);
      const locale = await screen.findByLabelText(dictionary.account.profile.locale);
      await waitFor(() => expect(within(locale).getAllByRole("option")).toHaveLength(1));
      expect(within(locale).getByRole("option", { name: expectedOption })).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("maps a server profile validation error to its field and clears it when corrected", async () => {
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile" && request.method === "PUT") {
        throw {
          status: 400,
          data: {
            violations: [{ field: "email", message: "This email is already in use." }],
          },
        } as never;
      }
      if (request.url === "/api/account/profile")
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
      if (request.url === "/api/account/profile/attributes")
        return { definitions: [], attributes: {} } as never;
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    const email = await screen.findByDisplayValue("ada@example.test");
    fireEvent.change(email, { target: { value: "new@example.test" } });
    const saveButton = screen.getByTestId("save-profile");
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ method: "PUT", url: "/api/account/profile" }),
      ),
    );

    expect(await screen.findByText("This email is already in use.")).toBeVisible();
    fireEvent.change(email, { target: { value: "corrected@example.test" } });
    await waitFor(() => expect(screen.queryByText("This email is already in use.")).toBeNull());
  });

  it("restores server profile and custom attributes when changes are cancelled", async () => {
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile")
        return {
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          preferredLocale: "unsupported",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        } as never;
      if (request.url === "/api/account/profile/attributes")
        return {
          definitions: [
            {
              name: "firstName",
              displayName: "First name",
              description: null,
              type: "STRING",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
            {
              name: "department",
              displayName: "Department",
              description: null,
              type: "STRING",
              required: false,
              multivalued: false,
              minLength: null,
              maxLength: null,
              pattern: null,
            },
          ],
          attributes: { department: ["Research"] },
        } as never;
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    const firstName = await screen.findByDisplayValue("Ada");
    const department = await screen.findByDisplayValue("Research");
    fireEvent.change(firstName, { target: { value: "Augusta" } });
    fireEvent.change(department, { target: { value: "Engineering" } });
    const cancel = screen.getByRole("button", { name: dictionary.account.common.cancel });
    await waitFor(() => expect(cancel).toBeEnabled());
    fireEvent.click(cancel);

    await waitFor(() => expect(firstName).toHaveValue("Ada"));
    expect(department).toHaveValue("Research");
    expect(screen.getByLabelText(dictionary.account.profile.locale)).toHaveValue("en");
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

  it("rejects unsupported and oversized avatar files, then uploads and removes a valid avatar", async () => {
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
      if (request.url === "/api/account/profile/attributes")
        return { definitions: [], attributes: {} } as never;
      if (request.url === "/api/account/profile/avatar" && request.method === "PUT")
        return { avatarUrl: "/avatars/ada.png" } as never;
      if (request.url === "/api/account/profile/avatar" && request.method === "DELETE")
        return null as never;
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    const upload = await screen.findByLabelText(dictionary.account.profile.uploadAvatar);
    fireEvent.change(upload, {
      target: { files: [new File(["text"], "avatar.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByText(dictionary.account.profile.avatarInvalid)).toBeVisible();

    fireEvent.change(upload, {
      target: {
        files: [
          new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
        ],
      },
    });
    expect(await screen.findByText(dictionary.account.profile.avatarInvalid)).toBeVisible();

    fireEvent.change(upload, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });
    expect(
      await screen.findByRole("button", { name: dictionary.account.profile.removeAvatar }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.profile.removeAvatar }));

    const confirmDialog = screen
      .getByText(dictionary.account.profile.removeAvatarConfirm)
      .closest(".modal");
    expect(confirmDialog).toBeInTheDocument();
    fireEvent.click(
      within(confirmDialog as HTMLElement).getByRole("button", {
        name: dictionary.account.profile.removeAvatar,
      }),
    );
    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ method: "DELETE", url: "/api/account/profile/avatar" }),
      ),
    );
  });

  it("requests email verification and handles a failed verification request", async () => {
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile")
        return {
          username: "ada",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          preferredLocale: "en",
          emailVerified: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        } as never;
      if (request.url === "/api/account/profile/attributes")
        return { definitions: [], attributes: {} } as never;
      if (request.url === "/api/account/send-verify-email") throw new Error("verification failed");
      return { avatarUrl: null } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    const verify = await screen.findByRole("button", {
      name: dictionary.account.profile.sendVerification,
    });
    fireEvent.click(verify);
    await waitFor(() =>
      expect(mockRequestAccount).toHaveBeenCalledWith(
        "access-token",
        expect.objectContaining({ method: "POST", url: "/api/account/send-verify-email" }),
      ),
    );
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

  it("requests the current password after email reauthentication and completes the retry", async () => {
    let profileUpdates = 0;
    mockRequestAccount.mockImplementation(async (_token, request) => {
      if (request.url === "/api/account/profile" && request.method === "PUT") {
        profileUpdates += 1;
        if (profileUpdates === 1)
          throw { data: { errorCode: "reauthentication_required" } } as never;
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
      if (request.url === "/api/account/profile/attributes" && request.method === "PUT")
        return null as never;
      if (request.url === "/api/account/profile/attributes")
        return { definitions: [], attributes: {} } as never;
      if (request.url === "/api/account/profile/avatar") return { avatarUrl: null } as never;
      return { locale: "en" } as never;
    });

    render(<AccountProfileForm dictionary={dictionary} />);
    await screen.findByDisplayValue("ada@example.test");
    fireEvent.change(screen.getByLabelText(dictionary.account.profile.firstName), {
      target: { value: "Augusta" },
    });
    const saveButton = screen.getByTestId("save-profile");
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(dictionary.account.profile.reauthenticationRequired),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.account.profile.currentPassword), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByTestId("save-profile"));

    await waitFor(() => expect(profileUpdates).toBe(2));
    expect(mockRequestAccount).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({ method: "PUT", url: "/api/auth/localization/me" }),
    );
    expect(mockRequestAccount).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({ method: "PUT", url: "/api/account/profile/attributes" }),
    );
  });
});
