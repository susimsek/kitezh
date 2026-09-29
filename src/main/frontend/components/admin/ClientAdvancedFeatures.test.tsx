import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import en from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";
import { ClientMappers } from "./ClientMappers";
import { ClientScopeEvaluation } from "./ClientScopeEvaluation";
import { ServiceAccountRoles } from "./ServiceAccountRoles";

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));

const mockAddAlert = jest.fn();
const authState = {
  accessToken: "admin-token",
  access: { manageClients: true },
};

jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => authState }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("creates a protocol mapper and reloads the list", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.method === "POST") {
      return {
        status: 200,
        data: {
          id: 1,
          name: "Email claim",
          mapperType: "user-property",
          source: "email",
          claimName: "email",
          addToIdToken: false,
          addToAccessToken: true,
          value: null,
          priority: 100,
        },
      } as never;
    }
    return { status: 200, data: { content: [], totalPages: 0, totalElements: 0 } } as never;
  });

  render(<ClientMappers clientId="client-1" dictionary={en} />);
  await screen.findByText(en.admin.clients.mappers.empty);
  fireEvent.change(screen.getByLabelText(en.admin.clients.mappers.name), {
    target: { value: "Email claim" },
  });
  fireEvent.change(screen.getByLabelText(en.admin.clients.mappers.claimName), {
    target: { value: "email" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("admin-token", {
      url: "/api/admin/clients/client-1/mappers",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: {
        name: "Email claim",
        mapperType: "user-property",
        source: "email",
        claimName: "email",
        addToIdToken: false,
        addToAccessToken: true,
        value: "",
        priority: 100,
      },
    }),
  );
  expect(mockAddAlert).toHaveBeenCalledWith(en.admin.clients.mappers.saved);
});

it("uses the standard audience claim for an audience mapper", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.method === "POST") {
      return {
        status: 200,
        data: {
          id: 2,
          name: "Reports audience",
          mapperType: "audience",
          source: null,
          claimName: "aud",
          addToIdToken: false,
          addToAccessToken: true,
          value: "reports-api",
          priority: 100,
        },
      } as never;
    }
    return { status: 200, data: { content: [], totalPages: 0, totalElements: 0 } } as never;
  });

  render(<ClientMappers clientId="client-1" dictionary={en} />);
  await screen.findByText(en.admin.clients.mappers.empty);
  fireEvent.change(screen.getByLabelText(en.admin.clients.mappers.type), {
    target: { value: "audience" },
  });
  fireEvent.change(screen.getByLabelText(en.admin.clients.mappers.name), {
    target: { value: "Reports audience" },
  });
  fireEvent.change(screen.getByLabelText(en.admin.clients.mappers.value), {
    target: { value: "reports-api" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({
        method: "POST",
        data: expect.objectContaining({
          name: "Reports audience",
          mapperType: "audience",
          value: "reports-api",
          addToAccessToken: true,
        }),
      }),
    ),
  );
});

it("evaluates requested scopes and renders the preview", async () => {
  const request = jest.mocked(adminRequest);
  request.mockResolvedValue({
    status: 200,
    data: {
      requestedScopes: ["openid", "profile"],
      effectiveScopes: ["openid", "profile"],
      mappedClaims: ["email"],
      roles: [],
      claims: {},
    },
  } as never);

  render(<ClientScopeEvaluation clientId="client-1" dictionary={en} />);
  fireEvent.change(screen.getByLabelText(en.admin.clients.scopeEvaluation.scopes), {
    target: { value: "openid profile" },
  });
  fireEvent.change(screen.getByLabelText(en.admin.clients.scopeEvaluation.subject), {
    target: { value: "admin" },
  });
  fireEvent.click(screen.getByRole("button", { name: en.admin.clients.scopeEvaluation.evaluate }));

  expect(await screen.findByText("openid, profile")).toBeVisible();
  expect(request).toHaveBeenCalledWith("admin-token", {
    url: "/api/admin/clients/client-1/scope-evaluation?scopes=openid%20profile&subject=admin",
  });
});

it("assigns service-account roles through the validated form", async () => {
  const request = jest.mocked(adminRequest);
  request.mockImplementation(async (_token, config) => {
    if (config.method === "PUT") {
      return { status: 200, data: { username: "service-account-client-1", roleIds: [7] } } as never;
    }
    if (config.url?.includes("/service-account")) {
      return {
        status: 200,
        data: { username: "service-account-client-1", roleIds: [] },
      } as never;
    }
    return { status: 200, data: { content: [{ id: 7, name: "orders.read" }] } } as never;
  });

  render(<ServiceAccountRoles clientId="client-1" dictionary={en} />);
  const role = await screen.findByRole("checkbox", { name: "orders.read" });
  fireEvent.click(role);
  fireEvent.click(screen.getByRole("button", { name: en.admin.common.save }));

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("admin-token", {
      url: "/api/admin/clients/client-1/service-account/roles",
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      data: { roleIds: [7] },
    }),
  );
  expect(mockAddAlert).toHaveBeenCalledWith(en.admin.clients.saved);
});
