import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AdminLocalizationSettings from "./AdminLocalizationSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
const mockPush = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token", access: { isAdmin: true } }),
}));
jest.mock("@/routing/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("./DetailTabs", () => ({
  DetailTabs: ({ active }: { active: string }) => <div data-testid={`tabs-${active}`} />,
}));
jest.mock("./DataTable", () => ({
  DataTable: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      <table>{children}</table>
      {footer}
    </div>
  ),
}));
jest.mock("./PaginationControls", () => ({
  PaginationControls: ({
    onPageChange,
    onSizeChange,
  }: {
    onPageChange: (page: number) => void;
    onSizeChange: (size: number) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPageChange(1)}>
        next-page
      </button>
      <button type="button" onClick={() => onSizeChange(50)}>
        page-size
      </button>
    </div>
  ),
}));
jest.mock("./ResourceFilters", () => ({
  ResourceFilters: ({
    children,
    searchLabel,
    onQueryChange,
    onClearFilters,
    sort,
  }: {
    children?: React.ReactNode;
    searchLabel: string;
    onQueryChange: (value: string) => void;
    onClearFilters: () => void;
    sort: {
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
    };
  }) => (
    <div>
      <input aria-label={searchLabel} onChange={(event) => onQueryChange(event.target.value)} />
      <select
        aria-label={sort.label}
        value={sort.value}
        onChange={(event) => sort.onChange(event.target.value)}
      >
        {sort.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={onClearFilters}>
        clear-filters
      </button>
      {children}
    </div>
  ),
}));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    clearFilters: jest.fn(),
    page: 0,
    query: "",
    setPage: jest.fn(),
    setQuery: jest.fn(),
    setSize: jest.fn(),
    setSort: jest.fn(),
    size: 20,
    sort: "locale,asc",
  }),
}));

const settings = {
  internationalizationEnabled: true,
  defaultLocale: "en",
  supportedLocales: ["en"],
  availableLocales: ["en", "tr"],
  availableBundles: ["admin", "backend", "email"],
};
const override = {
  id: 7,
  locale: "en",
  bundle: "admin",
  messageKey: "welcome",
  messageValue: "Welcome override",
};

function mockRequests() {
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.url?.endsWith("/settings/localization")) {
      return Promise.resolve({ status: 200, data: settings }) as never;
    }
    if (request.url?.includes("/settings/localization/messages")) {
      if (request.method === "DELETE") return Promise.resolve({ status: 204, data: null }) as never;
      return Promise.resolve({
        status: 200,
        data: { content: [override], totalPages: 1, totalElements: 1 },
      }) as never;
    }
    if (request.url?.includes("/settings/localization/bundled")) {
      return Promise.resolve({ status: 200, data: { welcome: "Welcome bundled" } }) as never;
    }
    return Promise.resolve({ status: 200, data: settings }) as never;
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ welcome: "Welcome effective" }),
  }) as unknown as typeof fetch;
}

describe("AdminLocalizationSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    mockRequests();
  });

  it("updates localization settings", async () => {
    render(<AdminLocalizationSettings dictionary={dictionary} section="settings" />);
    expect(await screen.findByText(dictionary.admin.localization.title)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.defaultLocale), {
      target: { value: "tr" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT", url: "/api/admin/settings/localization" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.localization.saved);
  });

  it("filters effective messages and changes pagination", async () => {
    render(<AdminLocalizationSettings dictionary={dictionary} section="effective" />);
    expect(await screen.findByText(dictionary.admin.localization.effectiveTitle)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.bundle), {
      target: { value: "backend" },
    });
    expect(await screen.findByText("Welcome effective")).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.searchEffective), {
      target: { value: "welcome" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.resources.sort), {
      target: { value: "messageValue,asc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "next-page" }));
    fireEvent.click(screen.getByRole("button", { name: "page-size" }));
    fireEvent.click(screen.getByRole("button", { name: "clear-filters" }));
    expect(screen.getByTestId("tabs-effective")).toBeVisible();
  });

  it("creates an override and handles the edit and delete actions", async () => {
    const { rerender } = render(
      <AdminLocalizationSettings dictionary={dictionary} section="overrides" mode="create" />,
    );
    expect(await screen.findByText(dictionary.admin.localization.overridesTitle)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.messageKey), {
      target: { value: "welcome" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.messageValue), {
      target: { value: "New value" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.create }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/settings/localization/messages",
        }),
      ),
    );

    rerender(<AdminLocalizationSettings dictionary={dictionary} section="overrides" />);
    expect(await screen.findByText("Welcome override")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: `${dictionary.admin.localization.edit}: welcome` }),
    );
    expect(screen.getByDisplayValue("Welcome override")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.cancel }));
    fireEvent.click(
      screen.getByRole("button", { name: `${dictionary.admin.localization.delete}: welcome` }),
    );
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "DELETE", url: expect.stringContaining("/7") }),
      ),
    );
  });

  it("renders the error state when initial requests fail", async () => {
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.url?.endsWith("/settings/localization")) {
        return Promise.resolve({ status: 200, data: settings }) as never;
      }
      return Promise.reject(new Error("network")) as never;
    });
    render(<AdminLocalizationSettings dictionary={dictionary} section="settings" />);
    expect(await screen.findByText(dictionary.admin.localization.error)).toBeVisible();
  });

  it("covers effective backend messages, sorting, filtering, and pagination", async () => {
    render(<AdminLocalizationSettings dictionary={dictionary} section="effective" />);
    expect(await screen.findByText(dictionary.admin.localization.effectiveTitle)).toBeVisible();
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.bundle), {
      target: { value: "email" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.locale), {
      target: { value: "tr" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.resources.sort), {
      target: { value: "source,asc" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.searchEffective), {
      target: { value: "missing" },
    });
    expect(screen.getByRole("table").querySelector("tbody")?.textContent).toBe("");
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ url: expect.stringContaining("/bundled?locale=tr&bundle=email") }),
    );
  });

  it("reports settings and override save failures", async () => {
    render(<AdminLocalizationSettings dictionary={dictionary} section="settings" />);
    await screen.findByText(dictionary.admin.localization.title);
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "PUT") return Promise.resolve({ status: 500, data: null }) as never;
      return Promise.resolve({ status: 200, data: settings }) as never;
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.save }));
    await waitFor(() =>
      expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.localization.error),
    );

    const view = render(
      <AdminLocalizationSettings dictionary={dictionary} section="overrides" mode="create" />,
    );
    await screen.findByText(dictionary.admin.localization.overridesTitle);
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.messageKey), {
      target: { value: "welcome" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.localization.messageValue), {
      target: { value: "Broken" },
    });
    mockAdminRequest.mockImplementation((_token, request) => {
      if (request.method === "POST") return Promise.resolve({ status: 500, data: null }) as never;
      return Promise.resolve({
        status: 200,
        data: { content: [override], totalPages: 1, totalElements: 1 },
      }) as never;
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.create }));
    await waitFor(() =>
      expect(screen.getByText(dictionary.admin.localization.error)).toBeVisible(),
    );
    view.unmount();
  });

  it("supports clearing a supported locale and prevents empty override submissions", async () => {
    render(<AdminLocalizationSettings dictionary={dictionary} section="settings" />);
    await screen.findByText(dictionary.admin.localization.title);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();

    const view = render(
      <AdminLocalizationSettings dictionary={dictionary} section="overrides" mode="create" />,
    );
    await screen.findByText(dictionary.admin.localization.overridesTitle);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.localization.create }));
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "POST" }),
    );
    view.unmount();
  });
});
