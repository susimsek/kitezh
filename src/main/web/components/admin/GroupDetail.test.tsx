import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import en from "@/locales/en/common.json";
import tr from "@/locales/tr/common.json";
import { adminRequest } from "@/lib/admin-api";
import { GroupDetail } from "./GroupDetail";

let mockGroupIsAdmin = false;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    accessToken: "token",
    access: { manageUsers: true, manageRoles: true, isAdmin: mockGroupIsAdmin },
  }),
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: jest.fn(), addError: jest.fn() }),
}));
jest.mock("@/routing/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/admin/groups/7",
}));

it.each([en, tr])(
  "localizes group name length validation and prevents the update",
  async (dictionary) => {
    mockGroupIsAdmin = false;
    const request = jest.mocked(adminRequest);
    request.mockReset();
    request.mockImplementation(
      async (_token, config) =>
        ({
          status: 200,
          data:
            config.url === "/api/admin/groups/7"
              ? {
                  id: 7,
                  name: "Operators",
                  path: "/Operators",
                  parentId: null,
                  roles: [],
                  userCount: 0,
                  attributes: { department: ["finance"] },
                  defaultGroup: true,
                }
              : { content: [], totalPages: 0, totalElements: 0 },
        }) as never,
    );
    render(<GroupDetail id="7" locale="en" dictionary={dictionary} />);
    const name = await screen.findByRole("textbox", { name: dictionary.admin.groups.name });
    fireEvent.change(name, { target: { value: "a".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await screen.findByText(dictionary.admin.common.validation.max100)).toBeVisible();
    expect(request.mock.calls.some(([, config]) => config.method === "PUT")).toBe(false);
  },
);

it("edits group attributes and the default-group flag", async () => {
  mockGroupIsAdmin = true;
  const request = jest.mocked(adminRequest);
  request.mockReset();
  request.mockImplementation(
    async (_token, config) =>
      ({
        status: 200,
        data:
          config.method === "PUT"
            ? {
                id: 7,
                name: "Operators",
                path: "/Operators",
                parentId: null,
                roles: [],
                userCount: 0,
                attributes: { department: ["platform"] },
                defaultGroup: false,
              }
            : config.url === "/api/admin/groups/7"
              ? {
                  id: 7,
                  name: "Operators",
                  path: "/Operators",
                  parentId: null,
                  roles: [],
                  userCount: 0,
                  attributes: { department: ["finance"] },
                  defaultGroup: true,
                }
              : { content: [], totalPages: 0, totalElements: 0 },
      }) as never,
  );
  render(<GroupDetail id="7" locale="en" dictionary={en} />);

  const attributes = await screen.findByRole("textbox", { name: en.admin.groups.attributes });
  fireEvent.change(attributes, { target: { value: '{"department":["platform"]}' } });
  fireEvent.click(screen.getByRole("checkbox", { name: en.admin.groups.defaultGroup }));
  const saveButton = screen.getByRole("button", { name: en.admin.common.save });
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(saveButton);

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("token", {
      url: "/api/admin/groups/7",
      method: "PUT",
      data: {
        name: "Operators",
        parentId: null,
        attributes: { department: ["platform"] },
        defaultGroup: false,
      },
    }),
  );
});

it("shows permission actions on the permissions tab", async () => {
  mockGroupIsAdmin = true;
  const request = jest.mocked(adminRequest);
  request.mockReset();
  request.mockImplementation(
    async (_token, config) =>
      ({
        status: 200,
        data:
          config.url === "/api/admin/groups/7"
            ? {
                id: 7,
                name: "Operators",
                path: "/Operators",
                parentId: null,
                roles: [],
                userCount: 0,
                attributes: {},
                defaultGroup: false,
              }
            : { content: [], totalPages: 0, totalElements: 0 },
      }) as never,
  );

  render(<GroupDetail id="7" locale="en" dictionary={en} tab="permissions" />);

  expect(await screen.findByRole("heading", { name: en.admin.groups.permissions })).toBeVisible();
  expect(screen.getByRole("button", { name: en.admin.groups.addPermission })).toBeVisible();
});

it("sorts group members by username", async () => {
  mockGroupIsAdmin = true;
  const request = jest.mocked(adminRequest);
  request.mockReset();
  request.mockImplementation(
    async (_token, config) =>
      ({
        status: 200,
        data:
          config.url === "/api/admin/groups/7"
            ? {
                id: 7,
                name: "Operators",
                path: "/Operators",
                parentId: null,
                roles: [],
                userCount: 0,
                attributes: {},
                defaultGroup: false,
              }
            : { content: [], totalPages: 0, totalElements: 0 },
      }) as never,
  );

  render(<GroupDetail id="7" locale="en" dictionary={en} tab="members" />);

  expect(await screen.findByRole("combobox", { name: en.admin.resources.sort })).toHaveValue(
    "username,asc",
  );
  expect(
    request.mock.calls.some(
      ([, config]) =>
        config.url === "/api/admin/groups/7/users?q=&page=0&size=10&sort=username%2Casc",
    ),
  ).toBe(true);
});

it("saves role mappings and permission assignments", async () => {
  mockGroupIsAdmin = true;
  const request = jest.mocked(adminRequest);
  request.mockReset();
  request.mockImplementation(async (_token, config) => {
    if (config.url === "/api/admin/groups/7") {
      return {
        status: 200,
        data: {
          id: 7,
          name: "Operators",
          path: "/Operators",
          parentId: null,
          roles: ["ROLE_USER"],
          userCount: 0,
          attributes: {},
          defaultGroup: false,
        },
      } as never;
    }
    if (config.url === "/api/admin/roles?page=0&size=100") {
      return {
        status: 200,
        data: { content: [{ name: "ROLE_USER" }, { name: "ROLE_ADMIN" }] },
      } as never;
    }
    if (config.url?.includes("/permissions")) {
      return { status: 200, data: [{ userId: 1, username: "admin", permission: "VIEW" }] } as never;
    }
    if (config.method === "PUT" && config.url?.endsWith("/roles")) {
      return {
        status: 200,
        data: { id: 7, name: "Operators", roles: ["ROLE_USER", "ROLE_ADMIN"] },
      } as never;
    }
    if (config.method === "PUT" && config.url?.endsWith("/permissions")) {
      return {
        status: 200,
        data: [{ userId: 1, username: "admin", permission: "MANAGE_ROLES" }],
      } as never;
    }
    return { status: 200, data: { content: [], totalPages: 0, totalElements: 0 } } as never;
  });

  const rolesView = render(<GroupDetail id="7" locale="en" dictionary={en} tab="roles" />);
  expect(await screen.findByLabelText("ROLE_ADMIN")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("ROLE_ADMIN"));
  fireEvent.click(screen.getByRole("button", { name: en.admin.groups.saveMappings }));
  await waitFor(() =>
    expect(
      request.mock.calls.some(
        ([, config]) => config.url?.endsWith("/roles") && config.method === "PUT",
      ),
    ).toBe(true),
  );
  rolesView.unmount();

  render(<GroupDetail id="7" locale="en" dictionary={en} tab="permissions" />);
  expect(await screen.findByRole("button", { name: en.admin.groups.addPermission })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: en.admin.groups.addPermission }));
  const permissionUsers = await screen.findAllByRole("combobox", {
    name: en.admin.groups.permissionUser,
  });
  fireEvent.change(permissionUsers.at(-1)!, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: en.admin.groups.savePermissions }));
  await waitFor(() =>
    expect(
      request.mock.calls.some(
        ([, config]) => config.url?.endsWith("/permissions") && config.method === "PUT",
      ),
    ).toBe(true),
  );
});

it("adds and removes group members through search suggestions", async () => {
  mockGroupIsAdmin = true;
  const request = jest.mocked(adminRequest);
  request.mockReset();
  let added = false;
  request.mockImplementation(async (_token, config) => {
    if (config.url === "/api/admin/groups/7") {
      return {
        status: 200,
        data: {
          id: 7,
          name: "Operators",
          path: "/Operators",
          parentId: null,
          roles: [],
          userCount: 1,
          attributes: {},
          defaultGroup: false,
        },
      } as never;
    }
    if (config.url?.includes("available-users")) {
      return {
        status: 200,
        data: { content: [{ id: 2, username: "member", enabled: true }] },
      } as never;
    }
    if (config.method === "POST") {
      added = true;
      return { status: 204, data: null } as never;
    }
    if (config.method === "DELETE") return { status: 204, data: null } as never;
    if (config.url?.includes("/users?q=")) {
      return {
        status: 200,
        data: {
          content: added ? [{ id: 2, username: "member", enabled: true }] : [],
          totalPages: added ? 1 : 0,
          totalElements: added ? 1 : 0,
        },
      } as never;
    }
    return { status: 200, data: { content: [], totalPages: 0, totalElements: 0 } } as never;
  });

  render(<GroupDetail id="7" locale="en" dictionary={en} tab="members" />);
  const search = await screen.findByRole("textbox", { name: en.admin.groups.assignUser });
  fireEvent.change(search, { target: { value: "mem" } });
  expect(await screen.findByText("member")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "member" }).at(-1)!);
  fireEvent.click(screen.getByRole("button", { name: en.admin.groups.assignUser }));
  await waitFor(() =>
    expect(request.mock.calls.some(([, config]) => config.method === "POST")).toBe(true),
  );
  const remove = await screen.findByRole("button", { name: en.admin.groups.removeUser });
  fireEvent.click(remove);
  await waitFor(() =>
    expect(request.mock.calls.some(([, config]) => config.method === "DELETE")).toBe(true),
  );
});
