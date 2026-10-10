import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { OrganizationCreateForm } from "./OrganizationCreateForm";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockPush = jest.fn();
const mockAddError = jest.fn();
const authState = {
  accessToken: "admin-token" as string | null,
  access: { isAdmin: true, manageOrganizations: true },
};

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => authState }));
jest.mock("@/routing/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addError: mockAddError }),
}));
jest.mock("./AdminActionIcon", () => ({ AdminActionIcon: () => <span aria-hidden="true" /> }));

describe("OrganizationCreateForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    authState.accessToken = "admin-token";
    authState.access = { isAdmin: true, manageOrganizations: true };
  });

  it("validates required fields before creating an organization", async () => {
    render(<OrganizationCreateForm dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.create }));

    expect(await screen.findAllByText(dictionary.admin.common.validation.required)).toHaveLength(2);
    expect(mockAdminRequest).not.toHaveBeenCalled();
  });

  it("creates an organization and navigates to its detail page", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 201, data: { id: 42 } } as never);
    render(<OrganizationCreateForm dictionary={dictionary} />);

    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.alias), {
      target: { value: "  acme  " },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.name), {
      target: { value: "  Acme Corporation  " },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.displayName), {
      target: { value: " Acme " },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.description), {
      target: { value: " Customer organization " },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.create }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/organizations/42"));
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({
        method: "POST",
        url: "/api/admin/organizations",
        data: expect.objectContaining({
          alias: "acme",
          name: "Acme Corporation",
          displayName: " Acme ",
          description: " Customer organization ",
          enabled: true,
        }),
      }),
    );
  });

  it("maps field violations and handles request failures and missing authorization", async () => {
    mockAdminRequest
      .mockResolvedValueOnce({
        status: 400,
        data: { violations: [{ field: "alias", message: "Alias is taken" }] },
      } as never)
      .mockRejectedValueOnce(new Error("network"));
    render(<OrganizationCreateForm dictionary={dictionary} />);
    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.alias), {
      target: { value: "acme" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.organizations.name), {
      target: { value: "Acme" },
    });
    const submit = screen.getByRole("button", { name: dictionary.admin.organizations.create });

    fireEvent.click(submit);
    expect(await screen.findByText("Alias is taken")).toBeVisible();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.organizations.operationError),
    );

    authState.access = { isAdmin: false, manageOrganizations: false };
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.organizations.create }));
    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalledTimes(2));
  });

  it("returns to the organizations list from cancel", () => {
    render(<OrganizationCreateForm dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));

    expect(mockPush).toHaveBeenCalledWith("/admin/organizations");
  });
});
