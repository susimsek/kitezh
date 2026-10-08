import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopeCreateForm } from "./ClientScopeCreateForm";
import { GroupCreateForm } from "./GroupCreateForm";
import { RoleCreateForm } from "./RoleCreateForm";
import { UserProfileAttributeForm } from "./UserProfileAttributeForm";
import { IdentityProviderForm } from "./IdentityProviderForm";

const mockPush = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddError = jest.fn();
const mockAddAlert = jest.fn();
const authState = {
  accessToken: "token",
  access: { isAdmin: true, manageClients: true, manageRoles: true, manageUsers: true },
};

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => authState,
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addError: mockAddError, addAlert: mockAddAlert }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush }),
}));

describe("dedicated administration creation forms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    authState.accessToken = "token";
    authState.access = { isAdmin: true, manageClients: true, manageRoles: true, manageUsers: true };
  });

  it("creates a group and opens its detail page", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/groups?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      return { status: 201, data: { id: 7, name: "finance-operators" } } as never;
    });
    render(<GroupCreateForm dictionary={dictionary} locale="en" />);

    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.groups.name }), {
      target: { value: "finance-operators" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.groups.attributes }), {
      target: { value: '{"department":["finance"]}' },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: dictionary.admin.groups.defaultGroup }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.groups.create }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/groups",
        method: "POST",
        data: {
          name: "finance-operators",
          parentId: null,
          attributes: { department: ["finance"] },
          defaultGroup: true,
        },
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/admin/groups/7/details");
  });

  it("validates and creates a role from its dedicated page", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 201,
      data: { name: "ROLE_AUDITOR" },
    } as never);
    render(<RoleCreateForm dictionary={dictionary} locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.create }));
    expect(await screen.findByText(dictionary.admin.common.validation.roleFormat)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.roles.name }), {
      target: { value: "ROLE_AUDITOR" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: dictionary.admin.roles.create })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.create }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/roles/ROLE_AUDITOR"));
  });

  it("creates a client scope and returns to the catalogue", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 201, data: { id: "scope-1" } } as never);
    render(<ClientScopeCreateForm dictionary={dictionary} locale="en" />);

    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.clientScopes.name }), {
      target: { value: "invoice.read" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.clientScopes.groupClaimName }),
      { target: { value: "roles.groups" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: dictionary.admin.clientScopes.groupMapperEnabled }),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.clientScopes.create }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/client-scopes",
        method: "POST",
        data: {
          name: "invoice.read",
          displayName: "",
          description: "",
          displayOnConsentScreen: false,
          consentScreenText: "",
          includeInTokenScope: true,
          groupMapperEnabled: true,
          groupClaimName: "roles.groups",
          groupMapperFullPath: true,
        },
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/admin/client-scopes");
  });

  it("creates a user profile attribute from its dedicated page", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 201,
      data: { id: 3, name: "department" },
    } as never);
    render(<UserProfileAttributeForm dictionary={dictionary} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.userProfileSettings.name }),
      {
        target: { value: "department" },
      },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.userProfileSettings.displayName }),
      { target: { value: "Department" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.userProfileSettings.create }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("token", {
        url: "/api/admin/settings/user-profile",
        method: "POST",
        data: {
          name: "department",
          displayName: "Department",
          description: "",
          type: "STRING",
          required: false,
          multivalued: false,
          minLength: null,
          maxLength: null,
          pattern: "",
          enabled: true,
          displayOrder: 0,
        },
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/admin/settings/user-profile");
  });

  it("shows field and operation errors from role and scope APIs", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 400,
      data: { errorCode: "admin_role_duplicate_name", field: "name" },
    } as never);
    const roleView = render(<RoleCreateForm dictionary={dictionary} locale="en" />);
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.roles.name }), {
      target: { value: "ROLE_AUDITOR" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.roles.create }));
    expect(await screen.findByText(dictionary.admin.common.validation.roleDuplicate)).toBeVisible();

    roleView.unmount();
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: {} } as never);
    render(<ClientScopeCreateForm dictionary={dictionary} locale="en" />);
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.clientScopes.name }), {
      target: { value: "invoice.read" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.clientScopes.groupClaimName }),
      { target: { value: "groups" } },
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.clientScopes.create }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );
  });

  it("validates SAML metadata URI before submitting the provider form", async () => {
    render(<IdentityProviderForm dictionary={dictionary} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.identityProviders.name }),
      {
        target: { value: "Acme SAML" },
      },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.identityProviders.registrationId }),
      { target: { value: "acme-saml" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.identityProviders.alias }),
      {
        target: { value: "acme-saml" },
      },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: dictionary.admin.identityProviders.type }),
      {
        target: { value: "saml" },
      },
    );
    expect(
      screen.getByRole("textbox", {
        name: dictionary.admin.identityProviders.samlIdpCertificate,
      }),
    ).toHaveAttribute("rows", "6");
    fireEvent.change(
      screen.getByRole("textbox", { name: dictionary.admin.identityProviders.samlMetadataUri }),
      { target: { value: "not-a-uri" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.identityProviders.create }),
    );

    expect(await screen.findByText(dictionary.admin.identityProviders.uriInvalid)).toBeVisible();
    expect(mockAdminRequest).not.toHaveBeenCalled();
  });

  it("renders the profile edit branch, handles load errors, and respects permissions", async () => {
    const existing = {
      id: 4,
      name: "department",
      displayName: "Department",
      description: "A department",
      type: "STRING",
      required: true,
      multivalued: false,
      minLength: 2,
      maxLength: 40,
      pattern: "[a-z]+",
      enabled: true,
      displayOrder: 1,
      builtIn: false,
    };
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: [existing] } as never);
    const editView = render(<UserProfileAttributeForm dictionary={dictionary} id="4" />);
    expect(await screen.findByDisplayValue("Department")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: dictionary.admin.userProfileSettings.name }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.userProfileSettings.update }),
    );

    editView.unmount();
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: [] } as never);
    render(<UserProfileAttributeForm dictionary={dictionary} id="4" />);
    expect(await screen.findByText(dictionary.admin.userProfileSettings.error)).toBeVisible();

    authState.access = {
      isAdmin: false,
      manageClients: false,
      manageRoles: false,
      manageUsers: false,
    };
    render(<RoleCreateForm dictionary={dictionary} locale="en" />);
    expect(screen.getByRole("button", { name: dictionary.admin.roles.create })).toBeDisabled();
  });

  it("validates group attributes, maps duplicate names, and handles loading failures", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 200,
      data: { content: [{ id: 3, name: "finance", path: "/finance" }] },
    } as never);
    render(<GroupCreateForm dictionary={dictionary} locale="en" />);

    expect(await screen.findByRole("option", { name: "/finance" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.groups.name }), {
      target: { value: "finance-operators" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.groups.attributes }), {
      target: { value: "not-json" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.groups.create }));
    expect(await screen.findByText(dictionary.admin.groups.attributeFormat)).toBeVisible();

    mockAdminRequest.mockResolvedValueOnce({
      status: 400,
      data: { errorCode: "group_duplicate_name", field: "name" },
    } as never);
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.groups.attributes }), {
      target: { value: "{}" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.groups.create }));
    expect(
      await screen.findByText(dictionary.admin.common.validation.groupDuplicate),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
    expect(mockPush).toHaveBeenCalledWith("/admin/groups");

    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    render(<GroupCreateForm dictionary={dictionary} locale="en" />);
    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalled());
  });
});
