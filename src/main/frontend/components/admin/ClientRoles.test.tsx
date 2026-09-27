import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import en from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { ClientRoles } from "./ClientRoles";

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockAuthState = {
  accessToken: "token" as string | null,
  access: { manageClients: true },
};
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => mockAuthState,
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("@/routing/navigation", () => ({
  usePathname: () => "/admin/clients/orders-client/roles",
}));

const role = {
  id: 9,
  clientId: "orders-client",
  name: "orders.read",
  description: "Read orders",
};

const detail = {
  role,
  users: { content: [], totalPages: 0, totalElements: 0 },
  groups: { content: [], totalPages: 0, totalElements: 0 },
  userCount: 0,
  groupCount: 0,
};

const assignedDetail = {
  ...detail,
  users: {
    content: [{ id: 4, username: "alice", enabled: true }],
    totalPages: 1,
    totalElements: 1,
  },
  groups: {
    content: [{ id: 8, name: "Operations", path: "Finance / Operations" }],
    totalPages: 1,
    totalElements: 1,
  },
  userCount: 1,
  groupCount: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.accessToken = "token";
  mockAuthState.access.manageClients = true;
});

it("lists client roles and creates a validated role", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.method === "POST") {
      return { status: 201, data: { ...role, name: "orders.write" } } as never;
    }
    if (config.url?.includes("/roles/9?")) {
      return { status: 200, data: detail } as never;
    }
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);

  expect(await screen.findByRole("button", { name: role.name })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: en.admin.clients.roles.create }));
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: "orders.write" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("token", {
      url: "/api/admin/clients/orders-client/roles",
      method: "POST",
      data: { name: "orders.write", description: null },
    }),
  );
});

it("shows a load error when the role list request fails", async () => {
  const request = jest.mocked(adminRequest);
  request.mockResolvedValue({ status: 500, data: {} } as never);

  render(<ClientRoles clientId="orders-client" dictionary={en} />);

  expect(await screen.findByText(en.admin.clients.roles.operationError)).toBeVisible();
});

it("reports a detail load failure", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.url?.includes("/roles/9?")) {
      throw new Error("network failure");
    }
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));

  await waitFor(() =>
    expect(mockAddError).toHaveBeenCalledWith(en.admin.clients.roles.operationError),
  );
});

it("reports a non-successful detail response", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.url?.includes("/roles/9?")) return { status: 403, data: {} } as never;
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));

  await waitFor(() =>
    expect(mockAddError).toHaveBeenCalledWith(en.admin.clients.roles.operationError),
  );
});

it("validates role names before saving", async () => {
  const request = jest.mocked(adminRequest);
  request.mockResolvedValue({
    status: 200,
    data: { content: [role], totalPages: 1, totalElements: 1 },
  } as never);

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: en.admin.clients.roles.create }));
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: "orders read" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  expect(await screen.findByText(en.admin.clients.roles.nameFormat)).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

it("validates role descriptions and renders roles without descriptions", async () => {
  const request = jest.mocked(adminRequest);
  request.mockResolvedValue({
    status: 200,
    data: { content: [{ ...role, description: null }], totalPages: 1, totalElements: 1 },
  } as never);

  render(<ClientRoles clientId="orders-client" dictionary={en} />);

  expect(await screen.findByText("—")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: en.admin.clients.roles.create }));
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: "orders.write" },
  });
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.description), {
    target: { value: "x".repeat(501) },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  expect(await screen.findByText(en.admin.common.validation.max500)).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

it("clears failed user and group suggestions", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.url?.includes("available-users")) return { status: 500, data: {} } as never;
    if (config.url?.includes("available-groups")) throw new Error("network failure");
    if (config.url?.includes("/roles/9?")) return { status: 200, data: detail } as never;
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));
  fireEvent.change(
    await screen.findByPlaceholderText(en.admin.clients.roles.searchUsersPlaceholder),
    {
      target: { value: "al" },
    },
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        url: expect.stringContaining("available-users"),
      }),
    ),
  );
  fireEvent.change(
    await screen.findByPlaceholderText(en.admin.clients.roles.searchGroupsPlaceholder),
    {
      target: { value: "ops" },
    },
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        url: expect.stringContaining("available-groups"),
      }),
    ),
  );
});

it("skips role requests when the access token is unavailable", async () => {
  const request = jest.mocked(adminRequest);
  request.mockResolvedValue({
    status: 200,
    data: { content: [role], totalPages: 1, totalElements: 1 },
  } as never);
  const view = render(<ClientRoles clientId="orders-client" dictionary={en} />);
  expect(await screen.findByRole("button", { name: role.name })).toBeVisible();

  mockAuthState.accessToken = null;
  view.rerender(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(screen.getByRole("button", { name: role.name }));

  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
});

it("assigns and removes users and groups from a role", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.url?.includes("available-users")) {
      return {
        status: 200,
        data: {
          content: [{ id: 4, username: "alice", enabled: true }],
          totalPages: 1,
          totalElements: 1,
        },
      } as never;
    }
    if (config.url?.includes("available-groups")) {
      return {
        status: 200,
        data: {
          content: [{ id: 8, name: "Operations", path: "Finance / Operations" }],
          totalPages: 1,
          totalElements: 1,
        },
      } as never;
    }
    if (config.method === "POST" || config.method === "DELETE") {
      return { status: 200, data: assignedDetail } as never;
    }
    if (config.url?.includes("/roles/9?")) {
      return { status: 200, data: assignedDetail } as never;
    }
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));
  expect(await screen.findByText("alice")).toBeVisible();

  const userSearch = screen.getByPlaceholderText(en.admin.clients.roles.searchUsersPlaceholder);
  fireEvent.change(userSearch, { target: { value: "al" } });
  fireEvent.click(await screen.findByRole("button", { name: "alice" }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.assign })[0]);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "POST", data: { userId: 4 } }),
    ),
  );

  const groupSearch = screen.getByPlaceholderText(en.admin.clients.roles.searchGroupsPlaceholder);
  fireEvent.change(groupSearch, { target: { value: "ops" } });
  fireEvent.click(await screen.findByRole("button", { name: "Finance / Operations" }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.assign })[1]);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "POST", url: expect.stringContaining("/groups/8") }),
    ),
  );

  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.remove })[0]);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "DELETE", url: expect.stringContaining("/users/4") }),
    ),
  );

  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.remove })[1]);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "DELETE", url: expect.stringContaining("/groups/8") }),
    ),
  );
});

it("updates and deletes a role after confirmation", async () => {
  const updatedRole = { ...role, name: "orders.write" };
  const request = jest.mocked(adminRequest);
  let currentRole: typeof role | null = role;
  request.mockImplementation(async (_token, config) => {
    if (config.method === "PUT") {
      currentRole = updatedRole;
      return { status: 200, data: updatedRole } as never;
    }
    if (config.method === "DELETE") {
      currentRole = null;
      return { status: 204, data: {} } as never;
    }
    if (config.url?.includes("/roles/9?")) return { status: 200, data: detail } as never;
    return {
      status: 200,
      data: {
        content: currentRole ? [currentRole] : [],
        totalPages: currentRole ? 1 : 0,
        totalElements: currentRole ? 1 : 0,
      },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));
  await screen.findByRole("heading", { name: role.name });
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.edit }).at(-1)!);
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: updatedRole.name },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("token", expect.objectContaining({ method: "PUT" })),
  );

  fireEvent.click(screen.getByRole("button", { name: en.admin.clients.roles.delete }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.delete }).at(-1)!);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("token", expect.objectContaining({ method: "DELETE" })),
  );
  expect(await screen.findByText(en.admin.clients.roles.empty)).toBeVisible();
  expect(mockAddAlert).toHaveBeenCalledWith(en.admin.clients.roles.deleted);
});

it("reports mutation errors", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.method === "POST") return { status: 500, data: {} } as never;
    return { status: 200, data: { content: [role], totalPages: 1, totalElements: 1 } } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: en.admin.clients.roles.create }));
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: "orders.write" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(mockAddError).toHaveBeenCalledWith(en.admin.clients.roles.operationError),
  );
});

it("reports assignment and deletion errors", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.url?.includes("available-users")) {
      return {
        status: 200,
        data: {
          content: [{ id: 4, username: "alice", enabled: true }],
          totalPages: 1,
          totalElements: 1,
        },
      } as never;
    }
    if (config.url?.includes("available-groups")) {
      return {
        status: 200,
        data: {
          content: [{ id: 8, name: "Operations", path: "Finance / Operations" }],
          totalPages: 1,
          totalElements: 1,
        },
      } as never;
    }
    if (config.method === "POST" || config.method === "DELETE") {
      return { status: 500, data: {} } as never;
    }
    if (config.url?.includes("/roles/9?")) return { status: 200, data: assignedDetail } as never;
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: role.name }));
  await screen.findByText("alice");

  const userSearch = screen.getByPlaceholderText(en.admin.clients.roles.searchUsersPlaceholder);
  fireEvent.change(userSearch, { target: { value: "al" } });
  fireEvent.click(await screen.findByRole("button", { name: "alice" }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.assign })[0]);
  await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(1));

  const groupSearch = screen.getByPlaceholderText(en.admin.clients.roles.searchGroupsPlaceholder);
  fireEvent.change(groupSearch, { target: { value: "ops" } });
  fireEvent.click(await screen.findByRole("button", { name: "Finance / Operations" }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.assign })[1]);
  await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.remove })[0]);
  await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(3));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.remove })[1]);
  await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(4));

  fireEvent.click(screen.getByRole("button", { name: en.admin.clients.roles.delete }));
  fireEvent.click(screen.getAllByRole("button", { name: en.admin.clients.roles.delete }).at(-1)!);
  await waitFor(() => expect(mockAddError).toHaveBeenCalledTimes(5));
});

it("shows a spinner while saving a role", async () => {
  const request = jest.mocked(adminRequest);
  let completeSave!: (value: unknown) => void;
  const pendingSave = new Promise((resolve) => {
    completeSave = resolve;
  });
  request.mockImplementation(async (_token, config) => {
    if (config.method === "POST") return pendingSave as never;
    if (config.url?.includes("/roles/9?")) return { status: 200, data: detail } as never;
    return {
      status: 200,
      data: { content: [role], totalPages: 1, totalElements: 1 },
    } as never;
  });

  render(<ClientRoles clientId="orders-client" dictionary={en} />);
  fireEvent.click(await screen.findByRole("button", { name: en.admin.clients.roles.create }));
  fireEvent.change(screen.getByLabelText(en.admin.clients.roles.name), {
    target: { value: "orders.write" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: en.admin.common.save }).querySelector(".spinner-border"),
    ).not.toBeNull(),
  );
  completeSave({ status: 201, data: role });
  await waitFor(() => expect(mockAddAlert).toHaveBeenCalledWith(en.admin.clients.roles.saved));
});
