/* eslint-disable @next/next/no-img-element, react/display-name */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { UserForm } from "./UserForm";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

function rolePage(...roles: { name: string }[]) {
  return { content: roles };
}

function profileDefinitions() {
  return [
    {
      id: 1,
      name: "username",
      displayName: "Username",
      description: null,
      type: "STRING",
      required: true,
      multivalued: false,
      minLength: null,
      maxLength: 100,
      pattern: null,
      enabled: true,
      displayOrder: 10,
      builtIn: true,
    },
    {
      id: 2,
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
      displayOrder: 20,
      builtIn: false,
    },
  ];
}

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    access: { manageUsers: true, impersonateUsers: true },
    accessToken: "token",
  }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
jest.mock("next/image", () => ({ src, alt }: { src: string; alt: string }) => (
  <img alt={alt} src={src} />
));

describe("UserForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads available roles and creates a user", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      if (config.url === "/api/admin/profile-attributes")
        return { status: 200, data: profileDefinitions() } as never;
      return { status: 201, data: { id: 1, username: "ada" } } as never;
    });

    render(<UserForm dictionary={dictionary} locale="en" />);
    expect((await screen.findAllByRole("checkbox"))[0]).toBeChecked();
    fireEvent.change(document.querySelector('input[name="username"]')!, {
      target: { value: "ada" },
    });
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/users"));
  });

  it("does not validate built-in profile fields as nested attributes", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      if (config.url === "/api/admin/profile-attributes")
        return { status: 200, data: profileDefinitions() } as never;
      return { status: 201, data: { id: 2, username: "profile-user" } } as never;
    });

    render(<UserForm dictionary={dictionary} locale="en" />);
    await screen.findByLabelText("Username *");
    fireEvent.change(screen.getByLabelText("Username *"), {
      target: { value: "profile-user" },
    });
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/users"));
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        url: "/api/admin/users",
        method: "POST",
      }),
    );
  });

  it("shows the avatar validation message before uploading an unsupported file", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage() } as never;
      return {
        status: 200,
        data: {
          id: 1,
          username: "ada",
          enabled: true,
          authorities: ["ROLE_USER"],
          avatarUrl: null,
        },
      } as never;
    });

    render(<UserForm dictionary={dictionary} id="1" locale="en" />);
    expect(
      await screen.findByLabelText(dictionary.admin.resources.uploadAvatar),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(dictionary.admin.resources.uploadAvatar), {
      target: { files: [new File(["text"], "avatar.txt", { type: "text/plain" })] },
    });

    expect(await screen.findAllByText(dictionary.admin.resources.avatarHelp)).toHaveLength(2);
  });

  it("loads an existing user, toggles roles, updates the password, and removes the avatar", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return {
          status: 200,
          data: rolePage({ name: "ROLE_USER" }, { name: "ROLE_ADMIN" }),
        } as never;
      }
      if (config.url === "/api/admin/users/7") {
        return {
          status: 200,
          data: {
            id: 7,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            assignedRoles: ["ROLE_USER"],
            groupMappings: [
              { groupId: 3, groupPath: "/finance/operations", roles: ["ROLE_ADMIN"] },
            ],
            effectiveRoles: ["ROLE_ADMIN", "ROLE_USER"],
            avatarUrl: "/avatar.png",
          },
        } as never;
      }
      return { status: 200, data: {} } as never;
    });

    const view = render(<UserForm dictionary={dictionary} id="7" locale="en" />);
    expect(await screen.findByDisplayValue("ada")).toBeVisible();
    expect(screen.getByAltText("")).toBeVisible();

    view.rerender(<UserForm dictionary={dictionary} id="7" locale="en" tab="roles" />);
    expect(await screen.findByText("/finance/operations")).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);

    view.rerender(<UserForm dictionary={dictionary} id="7" locale="en" tab="credentials" />);
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/7/password",
        method: "PUT",
        data: { password: "new-password" },
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/admin/users/7/credentials");

    view.rerender(<UserForm dictionary={dictionary} id="7" locale="en" tab="details" />);
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.removeAvatar })[0],
    );
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.common.cancel })[1]);
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.removeAvatar })[0],
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.removeAvatar })[1],
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/7/avatar",
        method: "DELETE",
      }),
    );
  });

  it("updates the enable action and form switch after disabling a user", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      }
      if (config.url === "/api/admin/users/7/enabled") {
        return {
          status: 204,
          data: undefined,
        } as never;
      }
      return {
        status: 200,
        data: {
          id: 7,
          username: "ada",
          enabled: true,
          authorities: ["ROLE_USER"],
          avatarUrl: null,
        },
      } as never;
    });

    render(<UserForm dictionary={dictionary} id="7" locale="en" />);
    expect(
      await screen.findByRole("button", { name: dictionary.admin.resources.disable }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.disable }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/7/enabled",
        method: "PUT",
        data: { enabled: false },
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: dictionary.admin.resources.enable })).toBeVisible(),
    );
    expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked();
  });

  it("validates required password and roles on create", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: rolePage({ name: "ROLE_USER" }),
    } as never);
    render(<UserForm dictionary={dictionary} locale="en" />);
    await screen.findAllByRole("checkbox");
    fireEvent.change(document.querySelector('input[name="username"]')!, {
      target: { value: "ada" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await screen.findByText(dictionary.admin.common.validation.password)).toBeVisible();

    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await screen.findByText(dictionary.admin.common.validation.roles)).toBeVisible();
  });

  it("uploads a valid avatar and handles an avatar validation response", async () => {
    const createImageBitmapMock = jest.fn().mockResolvedValue({
      width: 100,
      height: 100,
      close: jest.fn(),
    });
    Object.assign(globalThis, { createImageBitmap: createImageBitmapMock });
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage() } as never;
      if (config.url === "/api/admin/users/8") {
        return {
          status: 200,
          data: { id: 8, username: "ada", enabled: true, authorities: [], avatarUrl: null },
        } as never;
      }
      return { status: 200, data: { avatarUrl: "/new-avatar.png" } } as never;
    });

    render(<UserForm dictionary={dictionary} id="8" locale="en" />);
    const input = await screen.findByLabelText(dictionary.admin.resources.uploadAvatar);
    fireEvent.change(input, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          url: "/api/admin/users/8/avatar",
          method: "PUT",
        }),
      ),
    );
    expect(createImageBitmapMock).toHaveBeenCalled();
  });

  it("maps duplicate username and password API violations", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      return {
        status: 400,
        data: {
          errorCode: "user_duplicate_username",
          violations: [{ field: "username" }, { field: "roles" }],
        },
      } as never;
    });
    render(<UserForm dictionary={dictionary} locale="en" />);
    await screen.findAllByRole("checkbox");
    fireEvent.change(document.querySelector('input[name="username"]')!, {
      target: { value: "ada" },
    });
    fireEvent.blur(document.querySelector('input[name="username"]')!);
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(
      await screen.findAllByText(dictionary.admin.common.validation.usernameDuplicate),
    ).toHaveLength(2);
  });

  it("rejects oversized images and bitmap decoding failures", async () => {
    const close = jest.fn();
    Object.assign(globalThis, {
      createImageBitmap: jest
        .fn()
        .mockResolvedValueOnce({ width: 5000, height: 100, close })
        .mockRejectedValueOnce(new Error("invalid image")),
    });
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage() } as never;
      return {
        status: 200,
        data: { id: 9, username: "ada", enabled: true, authorities: [], avatarUrl: null },
      } as never;
    });
    render(<UserForm dictionary={dictionary} id="9" locale="en" />);
    const input = await screen.findByLabelText(dictionary.admin.resources.uploadAvatar);
    const file = new File(["image"], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(createImageBitmap).toHaveBeenCalled());
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(dictionary.admin.resources.avatarHelp)).toBeVisible();
  });

  it("maps avatar and password operation failures", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      const url = config.url ?? "";
      if (url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      if (url === "/api/admin/users/10") {
        return {
          status: 200,
          data: {
            id: 10,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            avatarUrl: "/a.png",
          },
        } as never;
      }
      if (url.endsWith("/avatar")) {
        return { status: 400, data: { violations: [{ field: "avatar" }] } } as never;
      }
      if (url.endsWith("/password")) {
        return { status: 400, data: { violations: [{ field: "password" }] } } as never;
      }
      return { status: 200, data: {} } as never;
    });
    Object.assign(globalThis, {
      createImageBitmap: jest.fn().mockResolvedValue({ width: 100, height: 100, close: jest.fn() }),
    });
    const view = render(<UserForm dictionary={dictionary} id="10" locale="en" />);
    const input = await screen.findByLabelText(dictionary.admin.resources.uploadAvatar);
    fireEvent.change(input, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(screen.getAllByText(dictionary.admin.resources.avatarHelp)).toHaveLength(2),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(dictionary.admin.resources.avatarHelp);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.removeAvatar }));
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.resources.removeAvatar })[1],
    );
    expect(await screen.findByText(dictionary.admin.resources.notFound)).toBeVisible();

    view.unmount();
    mockAdminRequest.mockImplementation(async (_token, config) => {
      const url = config.url ?? "";
      if (url === "/api/admin/roles?page=0&size=100")
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      if (url === "/api/admin/users/10") {
        return {
          status: 200,
          data: {
            id: 10,
            username: "ada",
            enabled: true,
            authorities: ["ROLE_USER"],
            avatarUrl: null,
          },
        } as never;
      }
      if (url.endsWith("/password")) {
        return { status: 400, data: { violations: [{ field: "password" }] } } as never;
      }
      return { status: 200, data: {} } as never;
    });
    const passwordView = render(<UserForm dictionary={dictionary} id="10" locale="en" />);
    await screen.findByDisplayValue("ada");
    passwordView.rerender(
      <UserForm dictionary={dictionary} id="10" locale="en" tab="credentials" />,
    );

    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/10/password",
        method: "PUT",
        data: { password: "new-password" },
      }),
    );
  });

  it("manages required actions, passkeys, lock state, and credential actions", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      const url = config.url ?? "";
      if (url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      }
      if (url === "/api/admin/users/11") {
        return {
          status: 200,
          data: {
            id: 11,
            username: "locked-user",
            enabled: true,
            email: "locked@example.test",
            authorities: ["ROLE_USER"],
            locked: true,
            lockedUntil: "2026-09-20T12:00:00Z",
            failedLoginCount: 3,
            mustChangePassword: true,
            temporaryPassword: false,
            totpEnabled: true,
          },
        } as never;
      }
      if (url.endsWith("/required-actions/users/11")) {
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
            {
              key: "UPDATE_PASSWORD",
              displayName: "Update password",
              enabled: true,
              assigned: true,
              globalPolicy: false,
            },
          ],
        } as never;
      }
      if (url.includes("/webauthn/credentials?page")) {
        return {
          status: 200,
          data: {
            content: [
              {
                credentialId: "admin-credential",
                label: "Admin key",
                credentialType: "public-key",
                createdAt: "2026-01-01T00:00:00Z",
                lastUsedAt: "2026-01-02T00:00:00Z",
                signatureCount: 4,
                uvInitialized: true,
              },
            ],
          },
        } as never;
      }
      return { status: 204, data: null } as never;
    });

    const view = render(<UserForm dictionary={dictionary} id="11" locale="en" tab="details" />);
    expect(await screen.findByText(new RegExp(dictionary.admin.resources.locked))).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.unlock }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/11/unlock",
        method: "POST",
      }),
    );

    view.rerender(<UserForm dictionary={dictionary} id="11" locale="en" tab="credentials" />);

    await screen.findByText("Required actions");
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/required-actions/users/11/VERIFY_EMAIL",
        method: "POST",
      }),
    );

    const passkeyLabel = await screen.findByDisplayValue("Admin key");
    fireEvent.change(passkeyLabel, { target: { value: "Renamed key" } });
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.resources.save })[0]);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/11/webauthn/credentials/admin-credential",
        method: "PUT",
        data: { label: "Renamed key" },
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.resources.delete })[1]);
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/11/webauthn/credentials/admin-credential",
        method: "DELETE",
      }),
    );

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "VERIFY_EMAIL" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.sendActionEmail }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/11/execute-actions-email?lifespan=43200",
        method: "PUT",
        data: ["VERIFY_EMAIL"],
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.resources.resetAuthenticator }),
    );
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/users/11/totp",
        method: "DELETE",
      }),
    );
  });

  it("validates custom profile types and persists valid multivalued attributes", async () => {
    const definitions = [
      {
        id: 9,
        name: "username",
        displayName: "Username",
        description: null,
        type: "STRING",
        required: true,
        multivalued: false,
        minLength: null,
        maxLength: 100,
        pattern: null,
        enabled: true,
        displayOrder: 10,
        builtIn: true,
      },
      {
        id: 10,
        name: "tags",
        displayName: "Tags",
        description: "Uppercase tags",
        type: "STRING",
        required: true,
        multivalued: true,
        minLength: 2,
        maxLength: 5,
        pattern: "^[A-Z]+$",
        enabled: true,
        displayOrder: 50,
        builtIn: false,
      },
      {
        id: 11,
        name: "enabledFlag",
        displayName: "Enabled flag",
        description: null,
        type: "BOOLEAN",
        required: true,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
        enabled: true,
        displayOrder: 60,
        builtIn: false,
      },
      {
        id: 12,
        name: "rank",
        displayName: "Rank",
        description: null,
        type: "INTEGER",
        required: true,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
        enabled: true,
        displayOrder: 70,
        builtIn: false,
      },
      {
        id: 13,
        name: "contact",
        displayName: "Contact",
        description: null,
        type: "EMAIL",
        required: true,
        multivalued: false,
        minLength: null,
        maxLength: null,
        pattern: null,
        enabled: true,
        displayOrder: 80,
        builtIn: false,
      },
    ];
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: rolePage({ name: "ROLE_USER" }) } as never;
      }
      if (config.url === "/api/admin/profile-attributes") {
        return { status: 200, data: definitions } as never;
      }
      if (config.url === "/api/admin/users") {
        return { status: 201, data: { id: 20, username: "ada" } } as never;
      }
      return { status: 200, data: { attributes: {} } } as never;
    });

    render(<UserForm dictionary={dictionary} locale="en" />);
    await screen.findByLabelText("Tags *");
    fireEvent.change(screen.getByLabelText("Tags *"), { target: { value: "A\nTOOLONG" } });
    fireEvent.change(screen.getByLabelText("Enabled flag *"), { target: { value: "maybe" } });
    fireEvent.change(screen.getByLabelText("Rank *"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Contact *"), { target: { value: "invalid" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Username *" }), {
      target: { value: "ada" },
    });
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await screen.findAllByText(dictionary.admin.common.validation.invalid)).not.toHaveLength(
      0,
    );

    fireEvent.change(screen.getByLabelText("Tags *"), { target: { value: "AB\nCD" } });
    fireEvent.change(screen.getByLabelText("Enabled flag *"), { target: { value: "true" } });
    fireEvent.change(screen.getByLabelText("Rank *"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Contact *"), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/users"));
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        url: "/api/admin/users/20/profile-attributes",
        method: "PUT",
        data: {
          attributes: {
            tags: ["AB", "CD"],
            enabledFlag: ["true"],
            rank: ["7"],
            contact: ["ada@example.test"],
          },
        },
      }),
    );
  });
});
