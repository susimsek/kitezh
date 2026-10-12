import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { OrganizationDetail } from "./OrganizationDetail";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const authState = {
  accessToken: "admin-token",
  access: { isAdmin: true, manageOrganizations: true },
};

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => authState }));
jest.mock("./AdminBreadcrumb", () => ({ AdminBreadcrumb: () => <nav>breadcrumb</nav> }));
jest.mock("./AsyncState", () => ({
  ErrorState: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  LoadingState: () => <div role="status">loading</div>,
}));
jest.mock("./AdminActionIcon", () => ({ AdminActionIcon: () => <span aria-hidden="true" /> }));

const organization = {
  id: 8,
  alias: "acme",
  name: "Acme Corporation",
  displayName: "Acme",
  enabled: true,
};

function mockOrganizationRequests() {
  mockAdminRequest.mockImplementation(async (_token, request) => {
    const url = request.url ?? "";
    if (url === "/api/admin/organizations/8") {
      return { status: 200, data: organization } as never;
    }
    if (url.includes("/members?page=")) {
      return {
        status: 200,
        data: {
          content: [{ userId: 4, username: "alex", email: "alex@example.com", role: "OWNER" }],
          number: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
      } as never;
    }
    if (url.endsWith("/domains")) {
      return {
        status: 200,
        data: [
          { id: 1, domain: "acme.example", verified: true },
          { id: 2, domain: "new.acme.example", verified: false },
        ],
      } as never;
    }
    if (url.includes("/invitations?page=")) {
      return {
        status: 200,
        data: {
          content: [
            {
              id: 1,
              email: "pending@example.com",
              role: "ADMIN",
              expiresAt: "2026-10-11T00:00:00Z",
            },
            {
              id: 2,
              email: "revoked@example.com",
              role: "MEMBER",
              expiresAt: "2026-10-11T00:00:00Z",
              revokedAt: "2026-10-09T00:00:00Z",
            },
          ],
          number: 0,
          size: 20,
          totalElements: 2,
          totalPages: 1,
        },
      } as never;
    }
    if (url.includes("/groups?page=")) {
      return {
        status: 200,
        data: {
          content: [{ id: 3, name: "engineering", parentId: null, memberCount: 5 }],
          number: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
      } as never;
    }
    if (url.endsWith("/claims")) {
      return {
        status: 200,
        data: [
          {
            id: 5,
            claimName: "tenant",
            claimValue: "acme",
            addToAccessToken: true,
            addToIdToken: false,
            addToUserInfo: false,
          },
        ],
      } as never;
    }
    if (url.endsWith("/identity-providers")) {
      return {
        status: 200,
        data: [
          {
            providerAlias: "workforce",
            providerType: "oidc",
            displayName: "Workforce SSO",
            enabled: true,
          },
          {
            providerAlias: "legacy",
            providerType: "saml",
            displayName: "",
            enabled: false,
          },
        ],
      } as never;
    }
    return { status: 204, data: null } as never;
  });
}

describe("OrganizationDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.accessToken = "admin-token";
    authState.access = { isAdmin: true, manageOrganizations: true };
    mockOrganizationRequests();
  });

  it("renders organization collections and supports each management action", async () => {
    render(<OrganizationDetail dictionary={dictionary} id="8" />);

    expect(await screen.findByRole("heading", { name: "Acme" })).toBeVisible();
    expect(screen.getByText("alex")).toBeVisible();
    expect(screen.getByText("acme.example")).toBeVisible();
    expect(screen.getByText("new.acme.example")).toBeVisible();
    expect(screen.getByText("pending@example.com")).toBeVisible();
    expect(screen.getByText("revoked@example.com")).toBeVisible();
    expect(screen.getByText("engineering")).toBeVisible();
    expect(screen.getByText("tenant")).toBeVisible();
    expect(screen.getByText("Workforce SSO")).toBeVisible();
    expect(screen.getByText("legacy")).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("User ID"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.addMember }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/organizations/8/members",
          data: { userId: 12, role: "MEMBER" },
        }),
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.organizations.removeMember }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "DELETE", url: "/api/admin/organizations/8/members/4" }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.domain), {
      target: { value: "new.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.addDomain }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "POST", url: "/api/admin/organizations/8/domains" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.verify }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/organizations/8/domains/2/verify",
        }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.inviteEmail), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.invite }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/organizations/8/invitations",
          data: { email: "new@example.com", role: "MEMBER" },
        }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.groupName), {
      target: { value: "platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.addGroup }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "POST", url: "/api/admin/organizations/8/groups" }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.claimName), {
      target: { value: "department" },
    });
    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.claimValue), {
      target: { value: "engineering" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.addClaim }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/organizations/8/claims",
          data: { claimName: "department", claimValue: "engineering", addToAccessToken: true },
        }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(dictionary.admin.organizations.providerAlias), {
      target: { value: "partner" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.organizations.linkProvider }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/organizations/8/identity-providers",
          data: { providerAlias: "partner" },
        }),
      ),
    );
  });

  it("shows loading and load-error states and hides management forms without permission", async () => {
    let finishLoad: (() => void) | undefined;
    const pendingLoad = new Promise((resolve) => {
      finishLoad = () => resolve({ status: 500, data: null });
    });
    mockAdminRequest.mockImplementation(() => pendingLoad as never);
    render(<OrganizationDetail dictionary={dictionary} id="8" />);
    expect(screen.getByRole("status")).toHaveTextContent("loading");
    await waitFor(() => expect(finishLoad).toBeDefined());
    finishLoad?.();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      dictionary.admin.organizations.operationError,
    );

    authState.access = { isAdmin: false, manageOrganizations: false };
    mockOrganizationRequests();
    render(<OrganizationDetail dictionary={dictionary} id="8" />);
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.organizations.addMember }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: dictionary.admin.organizations.verify }),
    ).toBeNull();
  });
});
