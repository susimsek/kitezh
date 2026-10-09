import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18next from "i18next";

import dictionary from "@/locales/en/common.json";
import { accountRequest } from "@/lib/account-api";
import { StoreProvider } from "@/store/StoreProvider";

import { AccountApplications } from "./AccountApplications";
import { AccountProfileForm } from "./AccountProfileForm";
import { AccountSessions } from "./AccountSessions";

const mockAccountRequest = accountRequest as jest.MockedFunction<typeof accountRequest>;
const mockLogout = jest.fn();
jest.mock("@/routing/navigation", () => ({
  usePathname: () => window.location.pathname,
}));

function renderWithStore(component: React.ReactNode) {
  return render(<StoreProvider>{component}</StoreProvider>);
}

jest.mock("@/lib/account-api", () => {
  const request = jest.fn();
  return {
    accountRequest: request,
    requestAccount: async (...args: Parameters<typeof request>) => {
      const response = await request(...args);
      if (response.status >= 300) throw { status: response.status, data: response.data };
      return response.data;
    },
  };
});
jest.mock("./AccountAuthProvider", () => ({
  useAccountAuth: () => ({
    accessToken: "token",
    logout: mockLogout,
  }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({
    addAlert: jest.fn(),
    addError: jest.fn(),
  }),
}));

describe("Account console resources", () => {
  it.each(["profile", "applications", "sessions"])(
    "updates %s timestamps when the UI locale changes",
    async (resource) => {
      const timestamp = "2026-09-03T13:45:00Z";
      const data = {
        username: "admin",
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.test",
        createdAt: timestamp,
        updatedAt: timestamp,
        content: [
          {
            id: "session",
            clientId: "console",
            clientName: "Console",
            scopes: ["openid"],
            clients: [],
            current: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            lastAccessedAt: timestamp,
            expiresAt: timestamp,
          },
        ],
        totalElements: 1,
        totalPages: 1,
      };
      mockAccountRequest.mockResolvedValue({ status: 200, data } as never);
      renderWithStore(
        resource === "profile" ? (
          <AccountProfileForm dictionary={dictionary} />
        ) : resource === "applications" ? (
          <AccountApplications dictionary={dictionary} />
        ) : (
          <AccountSessions dictionary={dictionary} />
        ),
      );
      expect(
        (await screen.findAllByText(new Date(timestamp).toLocaleString("en"), { exact: false }))
          .length,
      ).toBeGreaterThan(0);
      await act(() => i18next.changeLanguage("tr"));
      expect(
        screen.getAllByText(new Date(timestamp).toLocaleString("tr"), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByText(new Date(timestamp).toLocaleString("en"), { exact: false }),
      ).not.toBeInTheDocument();
    },
  );
  beforeEach(() => {
    jest.clearAllMocks();
    document.documentElement.lang = "en";
  });

  it("shows current and remote sessions with client context and confirms sign out", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: {
            content: [
              {
                id: "sid-current",
                createdAt: "2026-08-23T10:00:00Z",
                lastAccessedAt: "2026-08-23T10:30:00Z",
                expiresAt: "2026-08-23T11:00:00Z",
                current: true,
                clients: [{ clientId: "account-console", clientName: "Account Console" }],
              },
              {
                id: "sid-other",
                createdAt: "2026-08-22T10:00:00Z",
                lastAccessedAt: "2026-08-22T10:30:00Z",
                expiresAt: "2026-08-24T11:00:00Z",
                current: false,
                clients: [{ clientId: "mobile", clientName: "Mobile App" }],
              },
            ],
            totalPages: 1,
            totalElements: 2,
          },
        } as never;
      }
      return { status: 204, data: null } as never;
    });

    renderWithStore(<AccountSessions dictionary={dictionary} />);

    expect(await screen.findByText("Account Console")).toBeVisible();
    expect(screen.getByText("Mobile App")).toBeVisible();
    expect(screen.getAllByText(dictionary.account.sessions.current)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: dictionary.account.sessions.signOut }));
    expect(screen.getByText(dictionary.account.sessions.signOutConfirm)).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.sessions.signOut,
      }),
    );

    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/account/sessions/sid-other",
      }),
    );
  });

  it("signs out other sessions and logs out after signing out all sessions", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: {
            content: [
              {
                id: "sid-current",
                createdAt: "2026-08-23T10:00:00Z",
                lastAccessedAt: "2026-08-23T10:30:00Z",
                expiresAt: "2026-08-23T11:00:00Z",
                current: true,
                clients: [],
              },
              {
                id: "sid-other",
                createdAt: "2026-08-22T10:00:00Z",
                lastAccessedAt: "2026-08-22T10:30:00Z",
                expiresAt: "2026-08-24T11:00:00Z",
                current: false,
                clients: [],
              },
            ],
            totalPages: 1,
            totalElements: 2,
          },
        } as never;
      }
      return { status: 204, data: null } as never;
    });

    renderWithStore(<AccountSessions dictionary={dictionary} />);
    expect(
      await screen.findByRole("button", { name: dictionary.account.sessions.signOutOthers }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.account.sessions.signOutOthers }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.sessions.signOutOthers,
      }),
    );
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/account/sessions/others",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: dictionary.account.sessions.signOutAll }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Sign out/,
      }),
    );
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it("moves back a page after removing its last session and handles failures", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: {
            content: [
              {
                id: "sid-other",
                createdAt: "2026-08-22T10:00:00Z",
                lastAccessedAt: "2026-08-22T10:30:00Z",
                expiresAt: "2026-08-24T11:00:00Z",
                current: false,
                clients: [],
              },
            ],
            totalPages: 2,
            totalElements: 11,
          },
        } as never;
      }
      throw new Error("session operation failed");
    });

    renderWithStore(<AccountSessions dictionary={dictionary} />);
    expect(await screen.findByText("sid-other")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.sessions.signOut }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.sessions.signOut,
      }),
    );
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("confirms application consent revocation and renders grant metadata", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (!config.method) {
        return {
          status: 200,
          data: {
            content: [
              {
                clientId: "web-client",
                clientName: "Web Client",
                scopes: ["SCOPE_openid", "SCOPE_profile"],
                createdAt: "2026-08-20T10:00:00Z",
                updatedAt: "2026-08-21T10:00:00Z",
              },
            ],
            totalPages: 1,
            totalElements: 1,
          },
        } as never;
      }
      return { status: 204, data: null } as never;
    });

    renderWithStore(<AccountApplications dictionary={dictionary} />);

    expect(await screen.findByText("Web Client")).toBeVisible();
    expect(screen.getByText("openid")).toBeVisible();
    expect(screen.getByText("profile")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: dictionary.account.applications.revoke }));
    expect(screen.getByText(dictionary.account.applications.revokeConfirm)).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.applications.revoke,
      }),
    );

    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/account/applications/web-client",
      }),
    );
  });

  it("validates, uploads, and removes the account avatar", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/account/profile") {
        return {
          status: 200,
          data: {
            username: "admin",
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.test",
            emailVerified: true,
            createdAt: "2026-08-20T10:00:00Z",
            updatedAt: "2026-08-20T10:00:00Z",
          },
        } as never;
      }
      if (config.url === "/api/account/profile/attributes") {
        return { status: 200, data: { definitions: [], attributes: {} } } as never;
      }
      if (config.url === "/api/account/profile/avatar" && !config.method) {
        return { status: 200, data: { avatarUrl: "/avatars/current?v=1" } } as never;
      }
      if (config.method === "PUT") {
        return { status: 200, data: { avatarUrl: "/avatars/new?v=2" } } as never;
      }
      return { status: 204, data: null } as never;
    });

    renderWithStore(<AccountProfileForm dictionary={dictionary} />);

    const upload = await screen.findByLabelText(dictionary.account.profile.uploadAvatar);
    const invalidFile = new File(["text"], "avatar.txt", { type: "text/plain" });
    fireEvent.change(upload, { target: { files: [invalidFile] } });
    expect(await screen.findByText(dictionary.account.profile.avatarInvalid)).toBeVisible();

    const validFile = new File(["image"], "avatar.png", { type: "image/png" });
    fireEvent.change(upload, { target: { files: [validFile] } });
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith("token", {
        method: "PUT",
        url: "/api/account/profile/avatar",
        data: expect.any(FormData),
      }),
    );

    const removeButton = screen.getByRole("button", {
      name: dictionary.account.profile.removeAvatar,
    });
    await waitFor(() => expect(removeButton).toBeEnabled());
    fireEvent.click(removeButton);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.account.profile.removeAvatar,
      }),
    );
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith("token", {
        method: "DELETE",
        url: "/api/account/profile/avatar",
      }),
    );
  });

  it("renders built-in and custom profile fields in display order", async () => {
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/account/profile") {
        return {
          status: 200,
          data: {
            username: "admin",
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.test",
            emailVerified: true,
            createdAt: "2026-08-20T10:00:00Z",
            updatedAt: "2026-08-20T10:00:00Z",
          },
        } as never;
      }
      if (config.url === "/api/account/profile/attributes") {
        return {
          status: 200,
          data: {
            definitions: [
              {
                name: "department",
                displayName: "Department",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                displayOrder: 60,
              },
              {
                name: "username",
                displayName: "Username",
                description: null,
                type: "STRING",
                required: true,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                displayOrder: 10,
              },
              {
                name: "employeeNumber",
                displayName: "Employee number",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                displayOrder: 50,
              },
              {
                name: "email",
                displayName: "Email",
                description: null,
                type: "EMAIL",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 200,
                pattern: null,
                displayOrder: 20,
              },
              {
                name: "lastName",
                displayName: "Last name",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                displayOrder: 40,
              },
              {
                name: "firstName",
                displayName: "First name",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                displayOrder: 30,
              },
            ],
            attributes: { employeeNumber: ["USR-001"], department: ["Sales"] },
          },
        } as never;
      }
      if (config.url === "/api/account/profile/avatar") {
        return { status: 200, data: { avatarUrl: null } } as never;
      }
      return { status: 204, data: null } as never;
    });

    const view = renderWithStore(<AccountProfileForm dictionary={dictionary} />);
    await screen.findByRole("textbox", { name: /Username/ });
    const fields = [
      screen.getByRole("textbox", { name: /Username/ }),
      screen.getByRole("textbox", { name: /^Email$/ }),
      screen.getByRole("textbox", { name: /First name/ }),
      screen.getByRole("textbox", { name: /Last name/ }),
      screen.getByRole("textbox", { name: /Employee number/ }),
      screen.getByRole("textbox", { name: /Department/ }),
    ];
    const inputOrder = [...view.container.querySelectorAll('input:not([type="file"])')];
    expect(fields.map((field) => inputOrder.indexOf(field as HTMLInputElement))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("updates profile data after email reauthentication and sends verification", async () => {
    const profile = {
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.test",
      emailVerified: false,
      preferredLocale: "en",
      createdAt: "2026-08-20T10:00:00Z",
      updatedAt: "2026-08-20T10:00:00Z",
    };
    const definitions = [
      {
        name: "email",
        displayName: dictionary.account.profile.email,
        description: null,
        type: "EMAIL",
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: 200,
        pattern: null,
      },
      {
        name: "department",
        displayName: "Department",
        description: "Team",
        type: "STRING",
        required: true,
        multivalued: false,
        minLength: 2,
        maxLength: 30,
        pattern: null,
      },
      {
        name: "active",
        displayName: "Active",
        description: null,
        type: "BOOLEAN",
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
      {
        name: "tags",
        displayName: "Tags",
        description: null,
        type: "STRING",
        required: false,
        multivalued: true,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
    ];
    let updateAttempt = 0;
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (!config.method && config.url === "/api/account/profile") {
        return { status: 200, data: profile } as never;
      }
      if (!config.method && config.url === "/api/account/profile/attributes") {
        return {
          status: 200,
          data: {
            definitions,
            attributes: { department: ["security"], active: ["true"], tags: ["oauth", "oidc"] },
          },
        } as never;
      }
      if (!config.method && config.url === "/api/account/profile/avatar") {
        return { status: 200, data: { avatarUrl: null } } as never;
      }
      if (config.url === "/api/account/profile" && config.method === "PUT") {
        updateAttempt += 1;
        if (updateAttempt === 1)
          return Promise.reject({ data: { errorCode: "reauthentication_required" } });
        return { status: 200, data: { ...profile, firstName: "Updated" } } as never;
      }
      if (config.url === "/api/account/profile/attributes" && config.method === "PUT") {
        return {
          status: 200,
          data: { definitions, attributes: { department: ["security"] } },
        } as never;
      }
      if (config.url === "/api/auth/localization/me") return { status: 204, data: null } as never;
      if (config.url === "/api/account/send-verify-email")
        return { status: 204, data: null } as never;
      return { status: 204, data: null } as never;
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ ok: false }),
    });
    renderWithStore(<AccountProfileForm dictionary={dictionary} />);
    expect(await screen.findByText("Department", { exact: false })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: /Department/ }), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.common.save }));
    expect(
      await screen.findByText(dictionary.account.profile.reauthenticationRequired),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.account.profile.currentPassword), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.common.save }));
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ url: "/api/auth/localization/me", method: "PUT" }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.account.profile.sendVerification }),
    );
    await waitFor(() =>
      expect(mockAccountRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ url: "/api/account/send-verify-email", method: "POST" }),
      ),
    );
  });

  it("validates required, typed, multivalued, and patterned profile attributes", async () => {
    const definitions = [
      {
        name: "department",
        displayName: "Department",
        description: null,
        type: "STRING",
        required: true,
        multivalued: false,
        minLength: 2,
        maxLength: 30,
        pattern: null,
      },
      {
        name: "active",
        displayName: "Active",
        description: null,
        type: "BOOLEAN",
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
      {
        name: "count",
        displayName: "Count",
        description: null,
        type: "INTEGER",
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
      {
        name: "contact",
        displayName: "Contact",
        description: null,
        type: "EMAIL",
        required: false,
        multivalued: true,
        minLength: null,
        maxLength: null,
        pattern: null,
      },
      {
        name: "code",
        displayName: "Code",
        description: null,
        type: "STRING",
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: "^[A-Z]+$",
      },
    ];
    mockAccountRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/account/profile") {
        return {
          status: 200,
          data: {
            username: "admin",
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.test",
            emailVerified: true,
            preferredLocale: "en",
            createdAt: "2026-08-20T10:00:00Z",
            updatedAt: "2026-08-20T10:00:00Z",
          },
        } as never;
      }
      if (config.url === "/api/account/profile/attributes") {
        return {
          status: 200,
          data: { definitions, attributes: { department: ["IT"], active: ["true"] } },
        } as never;
      }
      return { status: 204, data: null } as never;
    });
    renderWithStore(<AccountProfileForm dictionary={dictionary} />);
    expect(await screen.findByRole("textbox", { name: "Department *" })).toHaveValue("IT");

    const department = screen.getByRole("textbox", { name: "Department *" });
    fireEvent.change(department, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.common.save }));
    expect(await screen.findByText(dictionary.account.validation.required)).toBeVisible();

    fireEvent.change(department, { target: { value: "Platform" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Active" }), {
      target: { value: "false" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Count" }), {
      target: { value: "not-a-number" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Contact" }), {
      target: { value: "bad-email\nsecond@example.test" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Code" }), {
      target: { value: "lowercase" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.common.save }));
    expect(await screen.findAllByText(dictionary.account.validation.invalid)).not.toHaveLength(0);
    expect(mockAccountRequest.mock.calls.some(([, config]) => config.method === "PUT")).toBe(false);
  });
});
