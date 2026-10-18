import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { ClientScopesTable } from "./ClientScopesTable";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
let manageClients = true;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageClients } }),
}));
jest.mock("@/routing/navigation", () => ({ usePathname: () => "/admin/client-scopes" }));
jest.mock(
  "@/routing/Link",
  () =>
    function MockLink({ children, href, ...props }: React.ComponentProps<"a">) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
);

const page = (content: unknown[]) => ({
  content,
  number: 0,
  totalPages: 1,
  totalElements: content.length,
});

const customScope = {
  id: "custom/scope",
  name: "custom-scope",
  displayName: "Custom scope",
  description: "Application access",
  builtIn: false,
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-01T12:00:00Z",
};

const builtInScope = {
  ...customScope,
  id: "openid",
  name: "openid",
  displayName: null,
  description: null,
  builtIn: true,
};

describe("ClientScopesTable coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    manageClients = true;
  });

  it("lists built-in and custom scopes with the create action and protected built-in controls", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: page([builtInScope, customScope]),
    } as never);

    render(<ClientScopesTable dictionary={dictionary} />);

    expect(await screen.findByRole("link", { name: "custom-scope" })).toHaveAttribute(
      "href",
      "/admin/client-scopes/custom%2Fscope",
    );
    expect(
      screen.getByRole("link", { name: dictionary.admin.clientScopes.create }),
    ).toHaveAttribute("href", "/admin/client-scopes/new");
    expect(screen.getByText(dictionary.admin.clientScopes.builtIn)).toBeVisible();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: `openid ${dictionary.admin.common.actions}` }),
      ),
    );
    expect(screen.getByText(dictionary.admin.resources.details)).toBeVisible();
    expect(screen.queryByText(dictionary.admin.clientScopes.edit)).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.admin.clientScopes.delete)).not.toBeInTheDocument();
  });

  it("validates edits, saves custom scope changes, and deletes after confirmation", async () => {
    let finishSave!: (response: { status: number; data: typeof customScope }) => void;
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.method === "PUT") {
        return (await new Promise<{ status: number; data: typeof customScope }>((resolve) => {
          finishSave = resolve;
        })) as never;
      }
      if (config.method === "DELETE") return { status: 204, data: null } as never;
      return { status: 200, data: page([customScope]) } as never;
    });

    render(<ClientScopesTable dictionary={dictionary} />);

    await screen.findByRole("link", { name: "custom-scope" });
    fireEvent.click(
      screen.getByRole("button", { name: `custom-scope ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.edit));
    const dialog = within(screen.getByRole("dialog"));
    const [nameField, displayNameField, descriptionField] = dialog.getAllByRole("textbox");
    fireEvent.change(nameField, {
      target: { value: " " },
    });
    fireEvent.click(dialog.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await dialog.findByText(dictionary.admin.common.validation.required)).toBeVisible();

    fireEvent.change(nameField, {
      target: { value: "updated-scope" },
    });
    fireEvent.change(displayNameField, {
      target: { value: "Updated scope" },
    });
    fireEvent.change(descriptionField, {
      target: { value: "Updated description" },
    });
    fireEvent.click(dialog.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/client-scopes/custom%2Fscope",
          data: {
            name: "updated-scope",
            displayName: "Updated scope",
            description: "Updated description",
          },
        }),
      ),
    );
    expect(screen.getByRole("button", { name: dictionary.admin.common.save })).toBeDisabled();
    finishSave({ status: 200, data: customScope });
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.clientScopes.saved),
    );

    fireEvent.click(
      screen.getByRole("button", { name: `custom-scope ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.delete));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clientScopes.delete,
      }),
    );
    await waitFor(() =>
      expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.clientScopes.deleted),
    );
  });

  it("reports assigned-scope delete and save failures", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.method === "PUT") return { status: 500, data: null } as never;
      if (config.method === "DELETE") return { status: 400, data: null } as never;
      return { status: 200, data: page([customScope]) } as never;
    });

    render(<ClientScopesTable dictionary={dictionary} />);

    await screen.findByRole("link", { name: "custom-scope" });
    fireEvent.click(
      screen.getByRole("button", { name: `custom-scope ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.edit));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getAllByRole("textbox")[0], {
      target: { value: "changed-scope" },
    });
    fireEvent.click(dialog.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.operationError),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.common.cancel,
      }),
    );
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));

    fireEvent.click(
      screen.getByRole("button", { name: `custom-scope ${dictionary.admin.common.actions}` }),
    );
    fireEvent.click(screen.getByText(dictionary.admin.clientScopes.delete));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: dictionary.admin.clientScopes.delete,
      }),
    );
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.clientScopes.assignedDeleteError),
    );
  });

  it("supports clearing an active search and hides mutations without management access", async () => {
    window.history.replaceState({}, "", "/admin/client-scopes?q=custom");
    window.dispatchEvent(new Event("admin-table-state"));
    mockAdminRequest.mockResolvedValue({ status: 200, data: page([customScope]) } as never);
    const view = render(<ClientScopesTable dictionary={dictionary} />);

    await screen.findByRole("link", { name: "custom-scope" });
    fireEvent.change(screen.getByRole("textbox", { name: dictionary.admin.clientScopes.search }), {
      target: { value: "openid" },
    });
    await waitFor(() => expect(window.location.search).toContain("q=openid"));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ url: expect.stringContaining("q=openid") }),
      ),
    );
    fireEvent.change(screen.getByRole("combobox", { name: dictionary.admin.resources.sort }), {
      target: { value: "name,desc" },
    });
    await waitFor(() => expect(window.location.search).toContain("sort=name%2Cdesc"));
    fireEvent.change(
      screen.getByRole("combobox", { name: dictionary.admin.resources.rowsPerPage }),
      { target: { value: "20" } },
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ url: expect.stringContaining("size=20") }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.resources.clearFilters }));
    await waitFor(() => expect(window.location.search).toBe("?size=20"));
    view.unmount();

    manageClients = false;
    render(<ClientScopesTable dictionary={dictionary} />);
    await screen.findByRole("link", { name: "custom-scope" });
    expect(
      screen.queryByRole("link", { name: dictionary.admin.clientScopes.create }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `custom-scope ${dictionary.admin.common.actions}` }),
    ).not.toBeInTheDocument();
  });
});
