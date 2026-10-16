/* eslint-disable @next/next/no-img-element, react/display-name */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { UserForm } from "./UserForm";

const mockPush = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    access: { manageUsers: true, impersonateUsers: true, viewEvents: true },
    accessToken: "test-token",
  }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));
jest.mock("next/image", () => ({ src, alt }: { src: string; alt: string }) => (
  <img alt={alt} src={src} />
));

function userResponse() {
  return {
    status: 200,
    data: {
      id: 31,
      username: "ada",
      enabled: true,
      authorities: ["ROLE_USER"],
      avatarUrl: null,
    },
  } as never;
}

describe("UserForm uncovered paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates profile definitions and attributes from the object response shape", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [{ name: "ROLE_USER" }] } } as never;
      }
      if (config.url === "/api/admin/profile-attributes") {
        return {
          status: 200,
          data: {
            definitions: [
              {
                id: 1,
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
                displayOrder: 10,
                builtIn: false,
              },
            ],
            attributes: { department: ["Security"] },
          },
        } as never;
      }
      return { status: 201, data: { id: 32, username: "ada" } } as never;
    });

    render(<UserForm dictionary={dictionary} locale="en" />);

    expect(await screen.findByLabelText("Department")).toHaveValue("Security");
  });

  it("shows the events tab only when permission is present", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/events?page=")) {
        return {
          status: 200,
          data: { content: [], totalPages: 0, totalElements: 0 },
        } as never;
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" />);

    expect(
      await screen.findByRole("link", { name: dictionary.admin.events.title }),
    ).toHaveAttribute("href", "/admin/users/31/events");
  });

  it("confirms and performs sign out for all user sessions", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.endsWith("/sessions?page=0&size=10")) {
        return {
          status: 200,
          data: { content: [], totalPages: 0, totalElements: 0 },
        } as never;
      }
      return { status: 204, data: undefined } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="sessions" />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.resources.signOutAllUser }),
    );
    fireEvent.click(screen.getByRole("dialog").querySelector("button.btn-danger")!);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith("test-token", {
        url: "/api/admin/users/ada/sessions",
        method: "DELETE",
      }),
    );
  });

  it("surfaces failed passkey inventory requests", async () => {
    mockAdminRequest.mockImplementation(async (_token, config) => {
      if (config.url === "/api/admin/roles?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (config.url === "/api/admin/users/31") return userResponse();
      if (config.url?.includes("/webauthn/credentials?page")) {
        throw new Error("temporary API failure");
      }
      return { status: 200, data: [] } as never;
    });

    render(<UserForm dictionary={dictionary} id="31" locale="en" tab="credentials" />);

    expect(await screen.findByText(dictionary.admin.resources.operationError)).toBeVisible();
  });
});
