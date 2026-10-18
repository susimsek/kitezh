/* eslint-disable @next/next/no-img-element, react/display-name */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { UserForm } from "./UserForm";

const mockPush = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
let mockUserAccess = { manageUsers: true, impersonateUsers: true, viewEvents: true };

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    access: mockUserAccess,
    accessToken: "test-token",
  }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));
jest.mock("next/image", () => ({ src, alt }: { src: string; alt: string }) => (
  <img alt={alt} src={src} />
));

function userResponse() {
  return {
    status: 200,
    data: {
      id: 31,
      username: "ada",
      enabled: true,
      authorities: ["ROLE_USER"],
      avatarUrl: null,
    },
  } as never;
}

describe("UserForm uncovered paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserAccess = { manageUsers: true, impersonateUsers: true, viewEvents: true };
  });

  it("keeps account actions read-only when user management permissions are absent", async () => {
    mockUserAccess = { manageUsers: false, impersonateUsers: false, viewEvents: false };
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/sessions?page=")) {
        return { status: 200, data: { content: [], totalPages: 0, totalElements: 0 } } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="sessions" />);

    expect(await screen.findByRole("heading", { name: "ada" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.resources.impersonate }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: dictionary.admin.resources.delete })).toBeNull();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.resources.signOutAllUser }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: dictionary.admin.events.title })).toBeNull();
  });

  it("hydrates profile definitions and attributes from the object response shape", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [{ name: "ROLE_USER" }] } } as never;
      }
      if (config.url === "/api/admin/profile-attributes") {
        return {
          status: 200,
          data: {
            definitions: [
              {
                id: 1,
                name: "department",
                displayName: "Department",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                enabled: true,
                displayOrder: 10,
                builtIn: false,
              },
            ],
            attributes: { department: ["Security"] },
          },
        } as never;
      }
      return { status: 201, data: { id: 32, username: "ada" } } as never;
    });

    render(<UserForm dictionary={dictionary} locale="en" />);

    expect(await screen.findByLabelText("Department")).toHaveValue("Security");
  });

  it("validates required, typed, patterned, and single-valued profile attributes", async () => {
    const definitions = [
      {
        id: 1,
        name: "requiredAttribute",
        displayName: "Required attribute",
        description: null,
        type: "STRING",
        required: true,
        multivalued: false,
        minLength: null,
        maxLength: 100,
        pattern: null,
        enabled: true,
        displayOrder: 1,
        builtIn: false,
      },
      ...(["EMAIL", "INTEGER", "BOOLEAN", "STRING", "STRING"] as const).map((type, index) => ({
        id: index + 2,
        name: [
          "emailAttribute",
          "integerAttribute",
          "booleanAttribute",
          "patternAttribute",
          "singleAttribute",
        ][index],
        displayName: [
          "Email attribute",
          "Integer attribute",
          "Boolean attribute",
          "Pattern attribute",
          "Single attribute",
        ][index],
        description: null,
        type,
        required: false,
        multivalued: false,
        minLength: null,
        maxLength: 100,
        pattern: index === 3 ? "[" : null,
        enabled: true,
        displayOrder: index + 2,
        builtIn: false,
      })),
    ];
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [{ name: "ROLE_USER" }] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/users/31/profile-attributes") {
        return {
          status: 200,
          data: {
            definitions,
            attributes: {
              emailAttribute: ["not-an-email"],
              integerAttribute: ["1.5"],
              booleanAttribute: ["maybe"],
              patternAttribute: ["x"],
              singleAttribute: ["one", "two"],
            },
          },
        } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);
    await screen.findByLabelText("Required attribute *");
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(await screen.findByText(dictionary.admin.common.validation.required)).toBeVisible();
    expect(screen.getAllByText(dictionary.admin.common.validation.invalid).length).toBeGreaterThan(
      0,
    );
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ method: "PUT", url: "/api/admin/users/31" }),
    );
  });

  it("shows the events tab only when permission is present", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/events?page=")) {
        return {
          status: 200,
          data: { content: [], totalPages: 0, totalElements: 0 },
        } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);

    expect(
      await screen.findByRole("link", { name: dictionary.admin.events.title }),
    ).toHaveAttribute("href", "/admin/users/31/events");
  });

  it("shows empty group and inherited role states", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") {
        return {
          status: 200,
          data: {
            id: 31,
            username: "ada",
            enabled: true,
            authorities: [],
            assignedRoles: [],
            groupMappings: [],
            inheritedRoles: [],
            effectiveRoles: [],
            avatarUrl: null,
          },
        } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="roles" />);

    expect(await screen.findByText(dictionary.admin.resources.noGroupRoles)).toBeVisible();
    expect(screen.getByText(dictionary.admin.resources.noInheritedRoles)).toBeVisible();
  });

  it("shows an error when a required action cannot be assigned", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/required-actions/users/31") {
        return {
          status: 200,
          data: [
            {
              key: "VERIFY_EMAIL",
              displayName: "Verify email",
              enabled: true,
              assigned: false,
              globalPolicy: false,
            },
          ],
        } as never;
      }
      if (config.url === "/api/admin/required-actions/users/31/VERIFY_EMAIL") {
        return { status: 500, data: null } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);

    await screen.findAllByText("Verify email");
    const verifyEmailSwitch = screen
      .getAllByRole("checkbox")
      .find((input) => input.parentElement?.textContent?.includes("Verify email"));
    if (!verifyEmailSwitch) throw new Error("Required action switch was not rendered");
    fireEvent.click(verifyEmailSwitch);

    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        method: "POST",
        url: "/api/admin/required-actions/users/31/VERIFY_EMAIL",
      }),
    );
  });

  it("shows an operation error when user impersonation is rejected", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31/impersonation") {
        return { status: 403, data: null } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.resources.impersonate }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.admin.resources.notFound);
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        method: "POST",
        url: "/api/admin/users/31/impersonation",
      }),
    );
  });

  it("surfaces failed passkey rename and deletion operations", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/webauthn/credentials?page")) {
        return {
          status: 200,
          data: {
            content: [
              {
                credentialId: "credential-31",
                label: "Security key",
                credentialType: "public-key",
                createdAt: "2026-01-01T00:00:00Z",
                lastUsedAt: "2026-01-02T00:00:00Z",
              },
            ],
          },
        } as never;
      }
      return { status: 500, data: null } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);
    const passkey = await screen.findByDisplayValue("Security key");
    const passkeyRow = passkey.closest<HTMLElement>(".border");
    if (!passkeyRow) throw new Error("Passkey controls were not rendered");

    fireEvent.change(passkey, { target: { value: "Renamed key" } });
    fireEvent.click(
      within(passkeyRow).getByRole("button", { name: dictionary.admin.resources.save }),
    );
    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/users/31/webauthn/credentials/credential-31",
        }),
      ),
    );

    fireEvent.click(
      within(passkeyRow).getByRole("button", { name: dictionary.admin.resources.delete }),
    );
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({
          method: "DELETE",
          url: "/api/admin/users/31/webauthn/credentials/credential-31",
        }),
      ),
    );
    expect(screen.getAllByText(dictionary.admin.resources.operationError).length).toBeGreaterThan(
      0,
    );
  });

  it("confirms and performs sign out for all user sessions", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.endsWith("/sessions?page=0&size=10")) {
        return {
          status: 200,
          data: { content: [], totalPages: 0, totalElements: 0 },
        } as never;
      }
      return { status: 204, data: undefined } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="sessions" />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.resources.signOutAllUser }),
    );
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("test-token", {
        url: "/api/admin/users/ada/sessions",
        method: "DELETE",
      }),
    );
  });

  it("shows an error when sending a required-action email fails", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/required-actions/users/31") {
        return {
          status: 200,
          data: [
            {
              key: "VERIFY_EMAIL",
              displayName: "Verify email",
              enabled: true,
              assigned: false,
              globalPolicy: false,
            },
          ],
        } as never;
      }
      if (config.url?.includes("execute-actions-email")) {
        return { status: 500, data: null } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);
    await screen.findByRole("button", { name: dictionary.admin.resources.sendActionEmail });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "VERIFY_EMAIL" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.sendActionEmail }),
    );

    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        method: "PUT",
        url: "/api/admin/users/31/execute-actions-email?lifespan=43200",
        data: ["VERIFY_EMAIL"],
      }),
    );
  });

  it("surfaces failed passkey inventory requests", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/webauthn/credentials?page")) {
        throw new Error("temporary API failure");
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);

    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });

  it("uses a fallback label and validates it before renaming an unlabeled verified passkey", async () => {
    const credential = {
      credentialId: "credential-without-label",
      label: null,
      credentialType: "public-key",
      signatureCount: 0,
      uvInitialized: true,
      createdAt: "2026-01-01T00:00:00Z",
      lastUsedAt: "2026-01-02T00:00:00Z",
    };
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/webauthn/credentials?page")) {
        return { status: 200, data: { content: [credential] } } as never;
      }
      return { status: 200, data: null } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);
    const label = await screen.findByDisplayValue(dictionary.admin.resources.unnamedPasskey);
    const passkeyCard = label.closest<HTMLElement>(".border");
    if (!passkeyCard) throw new Error("Passkey card was not rendered");
    fireEvent.change(label, { target: { value: "" } });
    fireEvent.click(
      within(passkeyCard).getByRole("button", { name: dictionary.admin.resources.save }),
    );
    expect(await screen.findByText(dictionary.admin.common.validation.required)).toBeVisible();

    fireEvent.change(label, { target: { value: "Hardware key" } });
    fireEvent.click(
      within(passkeyCard).getByRole("button", { name: dictionary.admin.resources.save }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/users/31/webauthn/credentials/credential-without-label",
          data: { label: "Hardware key" },
        }),
      ),
    );
  });

  it("falls back to the details tab and empty profile definitions for unknown tab and payload shapes", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/users/31/profile-attributes") {
        return { status: 200, data: { malformed: true } } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="unexpected-tab" />);

    expect(await screen.findByRole("heading", { name: "ada" })).toBeVisible();
    expect(screen.getByLabelText(dictionary.admin.resources.email)).toBeVisible();
    expect(screen.queryByText(dictionary.admin.resources.requiredActions)).not.toBeInTheDocument();
  });

  it("reports a non-success response while loading the user record", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return { status: 503, data: null } as never;
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);

    expect(await screen.findByText(dictionary.admin.resources.notFound)).toBeVisible();
  });

  it("shows the profile settings error when the profile configuration request fails", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/users/31/profile-attributes") {
        return { status: 503, data: null } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);

    expect(await screen.findByText(dictionary.admin.userProfileSettings.error)).toBeVisible();
  });

  it("uses empty states for non-array required-action and missing passkey lists", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/required-actions/users/31") {
        return { status: 200, data: { malformed: true } } as never;
      }
      if (config.url?.includes("/webauthn/credentials?page")) {
        return { status: 200, data: {} } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);

    expect(await screen.findByText(dictionary.admin.resources.noPasskeys)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: dictionary.admin.resources.requiredActions }),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Verify email" })).not.toBeInTheDocument();
  });

  it("unassigns a required action and renders passkey verification as disabled", async () => {
    const credential = {
      credentialId: "credential-no-verification",
      label: "Laptop key",
      credentialType: "public-key",
      signatureCount: 4,
      uvInitialized: false,
      createdAt: "2026-01-01T00:00:00Z",
      lastUsedAt: "2026-01-02T00:00:00Z",
    };
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/required-actions/users/31") {
        return {
          status: 200,
          data: [
            {
              key: "VERIFY_EMAIL",
              displayName: "Verify email",
              enabled: true,
              assigned: true,
              globalPolicy: false,
            },
          ],
        } as never;
      }
      if (config.url?.includes("/webauthn/credentials?page")) {
        return { status: 200, data: { content: [credential] } } as never;
      }
      return { status: 200, data: null } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);

    const verifyEmailLabels = await screen.findAllByText("Verify email");
    const unassign = screen
      .getAllByRole("checkbox")
      .find((input) => input.parentElement?.textContent?.includes("Verify email"));
    if (!unassign) throw new Error("Required action checkbox was not rendered");
    expect(verifyEmailLabels[0]).toBeVisible();
    expect(await screen.findByText("Laptop key")).toBeVisible();
    fireEvent.click(unassign);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({
          method: "DELETE",
          url: "/api/admin/required-actions/users/31/VERIFY_EMAIL",
        }),
      ),
    );
  });

  it("reports profile attribute save failures after the user record was saved", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url === "/api/admin/users/31/profile-attributes" && config.method !== "PUT") {
        return {
          status: 200,
          data: {
            definitions: [
              {
                id: 1,
                name: "department",
                displayName: "Department",
                description: null,
                type: "STRING",
                required: false,
                multivalued: false,
                minLength: null,
                maxLength: 100,
                pattern: null,
                enabled: true,
                displayOrder: 1,
                builtIn: false,
              },
            ],
            attributes: { department: ["Security"] },
          },
        } as never;
      }
      if (config.url === "/api/admin/users/31/profile-attributes" && config.method === "PUT") {
        return { status: 500, data: null } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);
    await screen.findByLabelText("Department");
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "Platform" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(await screen.findByText(dictionary.admin.resources.notFound)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        method: "PUT",
        url: "/api/admin/users/31/profile-attributes",
        data: { attributes: { department: ["Platform"] } },
      }),
    );
  });

  it("shows the lock operation error when an account cannot be unlocked", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") {
        return {
          status: 200,
          data: {
            id: 31,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            locked: true,
            failedLoginCount: 5,
            avatarUrl: null,
          },
        } as never;
      }
      if (config.url === "/api/admin/users/31/unlock") return { status: 500, data: null } as never;
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: dictionary.admin.resources.unlock }));

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.admin.resources.notFound);
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ method: "POST", url: "/api/admin/users/31/unlock" }),
    );
  });

  it("shows lockout expiry and clears the lock state after a successful unlock", async () => {
    const lockedUntil = "2026-10-20T12:00:00Z";
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") {
        return {
          status: 200,
          data: {
            id: 31,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            locked: true,
            lockedUntil,
            failedLoginCount: 5,
            avatarUrl: null,
          },
        } as never;
      }
      if (config.url === "/api/admin/users/31/unlock") return { status: 204, data: null } as never;
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="details" />);
    const lockedStatus = await screen.findByText(new RegExp(dictionary.admin.resources.locked));
    expect(lockedStatus).toHaveTextContent(`${dictionary.admin.resources.failedLogins}: 5`);
    expect(lockedStatus).toHaveTextContent(new Date(lockedUntil).toLocaleString("en"));

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.unlock }));

    const unlockedStatus = await screen.findByText(new RegExp(dictionary.admin.resources.unlocked));
    expect(unlockedStatus).toHaveTextContent(`${dictionary.admin.resources.failedLogins}: 0`);
    expect(screen.queryByRole("button", { name: dictionary.admin.resources.unlock })).toBeNull();
  });

  it("shows an error when resetting the user's authenticator is rejected", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") {
        return {
          status: 200,
          data: {
            id: 31,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            totpEnabled: true,
            avatarUrl: null,
          },
        } as never;
      }
      if (config.url === "/api/admin/users/31/totp") return { status: 500, data: null } as never;
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.resources.resetAuthenticator }),
    );
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);

    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ method: "DELETE", url: "/api/admin/users/31/totp" }),
    );
  });

  it.each([
    ["username", "user_duplicate_username", dictionary.admin.common.validation.usernameDuplicate],
    ["email", "user_duplicate_email", dictionary.admin.common.validation.emailDuplicate],
    ["password", "invalid_user", dictionary.admin.common.validation.password],
    ["roles", "invalid_user", dictionary.admin.common.validation.roles],
  ] as const)(
    "maps a server-side %s violation to its field feedback",
    async (field, errorCode, message) => {
      mockAdminRequest.mockImplementation(async (_token, config) => {
        if (config.url === "/api/admin/roles?page=0&size=100") {
          return { status: 200, data: { content: [{ name: "ROLE_USER" }] } } as never;
        }
        if (config.url === "/api/admin/users" && config.method === "POST") {
          return {
            status: 400,
            data: { errorCode, violations: [{ field }] },
          } as never;
        }
        if (config.url === "/api/admin/profile-attributes") {
          return { status: 200, data: [] } as never;
        }
        return { status: 200, data: [] } as never;
      });

      render(<UserForm dictionary={dictionary} locale="en" />);
      await screen.findByRole("button", { name: dictionary.admin.common.save });
      fireEvent.change(document.querySelector('input[name="username"]')!, {
        target: { value: "ada" },
      });
      fireEvent.change(document.querySelector('input[name="password"]')!, {
        target: { value: "StrongPassword1!" },
      });
      fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

      expect(await screen.findByText(message)).toBeVisible();
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "test-token",
        expect.objectContaining({ method: "POST", url: "/api/admin/users" }),
      );
    },
  );
});
