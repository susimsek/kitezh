import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
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
});
