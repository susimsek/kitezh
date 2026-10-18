import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import AdminSettings from "./AdminSettings";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
let mockAccess: { isAdmin: boolean } = { isAdmin: true };

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: mockAccess }),
}));
jest.mock("./AdminEventSettings", () => ({
  __esModule: true,
  default: () => <div data-testid="event-settings" />,
}));
jest.mock("./LoginSettings", () => ({
  __esModule: true,
  default: ({ focusSection }: { focusSection?: string }) => (
    <div data-testid="login-settings">{focusSection}</div>
  ),
}));
jest.mock("./EmailSettings", () => ({
  __esModule: true,
  default: () => <div data-testid="email-settings" />,
}));
jest.mock("./AdminLocalizationSettings", () => ({
  __esModule: true,
  default: ({ section, mode }: { section: string; mode: string }) => (
    <div data-testid="localization-settings">{`${section}:${mode}`}</div>
  ),
}));
jest.unmock("@/routing/Link");

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("AdminSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess = { isAdmin: true };
    mockAdminRequest.mockResolvedValue({
      status: 200,
      data: { issuer: "https://issuer.test" },
    } as never);
  });

  it("opens the settings navigation and routes to each settings section", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/settings"]}>
        <Routes>
          <Route path="/admin/settings/:section?" element={<AdminSettings />} />
        </Routes>
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getByText(dictionary.admin.settings.sections.general)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: dictionary.admin.settings.generalTitle }),
    ).toBeVisible();

    for (const [key, label] of Object.entries(dictionary.admin.settings.sections)) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        key === "general"
          ? "/admin/settings"
          : `/admin/settings/${
              key === "bruteForce"
                ? "brute-force"
                : key === "userProfile"
                  ? "user-profile"
                  : key === "socialLogin"
                    ? "social-login"
                    : key === "userFederation"
                      ? "user-federation"
                      : key === "cibaPolicy"
                        ? "ciba-policy"
                        : key === "offlineAccess"
                          ? "offline-access"
                          : key
            }`,
      );
    }

    fireEvent.click(
      screen.getByRole("link", { name: dictionary.admin.settings.sections.bruteForce }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/settings/brute-force"),
    );
    expect(screen.getByTestId("login-settings")).toHaveTextContent("brute-force");
    expect(
      screen.getByRole("link", { name: dictionary.admin.settings.sections.bruteForce }),
    ).toHaveClass("active");
  });

  it("shows the general settings error and limits non-admin navigation", async () => {
    mockAdminRequest.mockResolvedValue({ status: 500, data: null } as never);
    const view = render(
      <MemoryRouter initialEntries={["/admin/settings"]}>
        <Routes>
          <Route path="/admin/settings/:section?" element={<AdminSettings />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(dictionary.admin.settings.generalError)).toBeVisible();
    view.unmount();

    mockAccess = { isAdmin: false };
    render(
      <MemoryRouter initialEntries={["/admin/settings/login"]}>
        <Routes>
          <Route path="/admin/settings/:section?" element={<AdminSettings />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("event-settings")).toBeVisible();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("routes localization creation to overrides and shows its breadcrumb", () => {
    render(
      <MemoryRouter initialEntries={["/admin/settings/localization/effective"]}>
        <Routes>
          <Route
            path="/admin/settings/localization/:localizationSection?"
            element={<AdminSettings localization localizationAction="create" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("localization-settings")).toHaveTextContent("overrides:create");
    expect(
      screen.getByRole("link", { name: dictionary.admin.localization.overridesTab }),
    ).toHaveAttribute("href", "/admin/settings/localization/overrides");
    expect(screen.getByText(dictionary.admin.localization.create)).toBeVisible();
  });
});
