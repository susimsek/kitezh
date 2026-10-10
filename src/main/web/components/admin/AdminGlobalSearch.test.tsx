import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { AdminGlobalSearch } from "./AdminGlobalSearch";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const authState = { accessToken: "admin-token" as string | null };

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => authState }));
jest.mock("@/routing/Link", () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: React.ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
jest.mock("@/components/shared/ActionIcon", () => ({ ActionIcon: () => <span /> }));

describe("AdminGlobalSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    authState.accessToken = "admin-token";
  });

  it("searches, groups results, responds to the shortcut, and closes on selection", async () => {
    mockAdminRequest.mockResolvedValueOnce({
      status: 200,
      data: {
        results: [
          {
            type: "user",
            id: "1",
            title: "Alex Doe",
            subtitle: "alex@example.com",
            href: "/admin/users/1",
          },
          {
            type: "client",
            id: "2",
            title: "web-client",
            subtitle: null,
            href: "/admin/clients/2",
          },
        ],
      },
    } as never);
    render(<AdminGlobalSearch dictionary={dictionary} />);
    const input = screen.getByRole("searchbox", { name: dictionary.admin.globalSearch.ariaLabel });

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "  al  " } });

    expect(
      await screen.findByRole("option", { name: /Alex Doe alex@example.com/ }),
    ).toHaveAttribute("href", "/admin/users/1");
    expect(screen.getByText(dictionary.admin.globalSearch.types.user)).toBeVisible();
    expect(screen.getByText(dictionary.admin.globalSearch.types.client)).toBeVisible();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ url: "/api/admin/search?q=al" }),
    );

    fireEvent.click(screen.getByRole("option", { name: /Alex Doe/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows the empty state on failure and clears short queries", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 503, data: null } as never);
    render(<AdminGlobalSearch dictionary={dictionary} />);
    const input = screen.getByRole("searchbox", { name: dictionary.admin.globalSearch.ariaLabel });
    fireEvent.change(input, { target: { value: "xy" } });

    await waitFor(() => expect(mockAdminRequest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(dictionary.admin.globalSearch.noResults)).toBeVisible();
    fireEvent.change(input, { target: { value: "x" } });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).not.toHaveFocus();
  });

  it("does not query without a token and reports successful empty results", async () => {
    authState.accessToken = null;
    const { rerender } = render(<AdminGlobalSearch dictionary={dictionary} />);
    const input = screen.getByRole("searchbox", { name: dictionary.admin.globalSearch.ariaLabel });
    fireEvent.change(input, { target: { value: "user" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockAdminRequest).not.toHaveBeenCalled();

    authState.accessToken = "admin-token";
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: { results: [] } } as never);
    rerender(<AdminGlobalSearch dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.admin.globalSearch.noResults)).toBeVisible();
  });
});
