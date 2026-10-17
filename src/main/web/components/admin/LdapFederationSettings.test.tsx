import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import LdapFederationSettings from "./LdapFederationSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token" }),
}));

const provider = {
  id: "provider-id",
  name: "Corporate AD",
  enabled: false,
  priority: 10,
  connectionUrl: "ldaps://directory.example.com:636",
  bindDn: "CN=bind,DC=example,DC=com",
  bindPassword: "",
  bindPasswordConfigured: true,
  usersDn: "OU=Users,DC=example,DC=com",
  usernameAttribute: "sAMAccountName",
  uuidAttribute: "objectGUID",
  emailAttribute: "mail",
  firstNameAttribute: "givenName",
  lastNameAttribute: "sn",
  rdnAttribute: "sAMAccountName",
  objectClasses: "person,user",
  searchScope: "SUBTREE" as const,
  editMode: "READ_ONLY" as const,
  importUsers: true,
  trustEmail: false,
};

const mapper = {
  id: 9,
  name: "Email",
  type: "USER_ATTRIBUTE",
  enabled: true,
  ldapAttribute: "mail",
  userAttribute: "email",
  hardcodedValue: "",
  targetName: "",
  groupSearchBase: "",
  groupObjectClass: "groupOfNames",
  groupNameAttribute: "cn",
  groupMemberAttribute: "member",
};

describe("LdapFederationSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "POST") return Promise.resolve({ status: 204, data: null }) as never;
      if (request.method === "PUT")
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      return Promise.resolve({ status: 200, data: [provider] }) as never;
    });
  });

  it("loads providers, adds a provider, and saves the configuration", async () => {
    render(<LdapFederationSettings />);
    expect(
      await screen.findByRole("heading", { name: dictionary.admin.ldapFederation.title }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/settings/ldap" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.ldapFederation.saved);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.add }));
    expect(
      screen.getByRole("heading", { name: `${dictionary.admin.ldapFederation.provider} 2` }),
    ).toBeVisible();
  });

  it("tests a provider and shows success feedback", async () => {
    render(<LdapFederationSettings />);
    await screen.findByRole("heading", { name: dictionary.admin.ldapFederation.title });

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.test }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "POST", url: "/api/admin/settings/ldap/test" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.ldapFederation.testSucceeded);
  });

  it("edits and deletes an LDAP mapper and runs both sync modes", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url === "/api/admin/settings/ldap")
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      if (request.url?.endsWith("/mappers")) {
        if (request.method === "POST") {
          return Promise.resolve({
            status: 201,
            data: { ...mapper, id: 10, name: "Created" },
          }) as never;
        }
        return Promise.resolve({ status: 200, data: [mapper] }) as never;
      }
      if (request.url?.endsWith("/mappers/9")) {
        return Promise.resolve({ status: 200, data: { ...mapper, name: "Updated" } }) as never;
      }
      return Promise.resolve({ status: 204, data: null }) as never;
    });

    render(<LdapFederationSettings />);
    await screen.findByRole("heading", { name: dictionary.admin.ldapFederation.title });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.mappers }));
    expect(await screen.findByText("Email (USER_ATTRIBUTE)")).toBeVisible();

    const mapperRow = screen.getByText("Email (USER_ATTRIBUTE)").parentElement?.parentElement;
    if (!mapperRow) throw new Error("Mapper action row was not rendered");
    fireEvent.click(
      within(mapperRow).getByRole("button", {
        name: dictionary.admin.ldapFederation.updateMapper,
      }),
    );
    expect(screen.getByLabelText(dictionary.admin.ldapFederation.mapperName)).toHaveValue("Email");
    fireEvent.change(screen.getByLabelText(dictionary.admin.ldapFederation.mapperName), {
      target: { value: "Updated" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.ldapFederation.saveMapper }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/settings/ldap/provider-id/mappers/9",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.syncFull }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ url: "/api/admin/settings/ldap/provider-id/sync?mode=FULL" }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.ldapFederation.syncChanged }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ url: "/api/admin/settings/ldap/provider-id/sync?mode=CHANGED" }),
      ),
    );
  });

  it("deletes a configured LDAP mapper", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url === "/api/admin/settings/ldap")
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      if (request.url?.endsWith("/mappers"))
        return Promise.resolve({ status: 200, data: [mapper] }) as never;
      return Promise.resolve({ status: 204, data: null }) as never;
    });

    render(<LdapFederationSettings />);
    await screen.findByRole("heading", { name: dictionary.admin.ldapFederation.title });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.mappers }));
    const mapperEntry = await screen.findByText("Email (USER_ATTRIBUTE)");
    const mapperRow = mapperEntry.parentElement?.parentElement;
    if (!mapperRow) throw new Error("Mapper action row was not rendered");
    fireEvent.click(
      within(mapperRow).getByRole("button", {
        name: dictionary.admin.ldapFederation.deleteMapper,
      }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "DELETE",
          url: "/api/admin/settings/ldap/provider-id/mappers/9",
        }),
      ),
    );
  });

  it("reports mapper loading and LDAP test failures", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url === "/api/admin/settings/ldap")
        return Promise.resolve({ status: 200, data: [provider] }) as never;
      if (request.url?.endsWith("/mappers"))
        return Promise.resolve({ status: 500, data: null }) as never;
      if (request.method === "POST" || request.method === "PUT")
        return Promise.resolve({ status: 500, data: null }) as never;
      return Promise.resolve({ status: 200, data: [provider] }) as never;
    });

    render(<LdapFederationSettings />);
    await screen.findByRole("heading", { name: dictionary.admin.ldapFederation.title });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.test }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.ldapFederation.testFailed),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.ldapFederation.mappers }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.ldapFederation.mapperError),
    );
  });
});
