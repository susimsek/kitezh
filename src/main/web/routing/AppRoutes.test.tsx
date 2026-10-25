import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "i18next";
import en from "@kitezh/shared/web-messages/en";
import tr from "@kitezh/shared/web-messages/tr";
import { StoreProvider } from "@/store/StoreProvider";
import { isDesktopRuntime } from "@/lib/desktop-api";
import { AppRoutes } from "./AppRoutes";

const mockIsDesktopRuntime = isDesktopRuntime as jest.MockedFunction<typeof isDesktopRuntime>;

jest.unmock("@/routing/Link");

jest.mock("@/components/admin/AdminAuthProvider", () => ({
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/admin/AdminAuthGuard", () => ({
  AdminAuthGuard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/admin/GroupDetail", () => ({
  GroupDetail: ({ id }: { id: string }) => <div data-testid="group-detail">{id}</div>,
}));
jest.mock("@/components/admin/ClientScopeDetail", () => ({
  ClientScopeDetail: ({ id }: { id: string }) => <div data-testid="scope-detail">{id}</div>,
}));
jest.mock("@/components/admin/ConsentDetail", () => ({
  ConsentDetail: ({ routeKey }: { routeKey: string }) => (
    <div data-testid="consent-detail">{routeKey}</div>
  ),
}));
jest.mock("@/components/admin/IdentityProviderDetail", () => ({
  IdentityProviderDetail: ({ id, tab }: { id: string; tab: string }) => (
    <div data-testid="identity-provider-detail">{`${id}:${tab}`}</div>
  ),
}));
jest.mock("@/components/admin/OrganizationDetail", () => ({
  OrganizationDetail: ({ id }: { id: string }) => <div data-testid="organization-detail">{id}</div>,
}));
jest.mock("@/components/admin/UserProfileAttributeForm", () => ({
  UserProfileAttributeForm: ({ id }: { id: string }) => (
    <div data-testid="profile-attribute-form">{id}</div>
  ),
}));
jest.mock("@/components/admin/AdminPageHeader", () => ({
  AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/components/shared/DesktopSettings", () => ({
  DesktopSettings: () => <div>desktop-settings-view</div>,
}));
jest.mock("@/components/shared/DesktopCompanion", () => ({
  DesktopCompanion: () => <div>desktop-companion-view</div>,
}));
jest.mock("@/components/shared/DesktopConsoleChooser", () => ({
  DesktopConsoleChooser: () => <div>desktop-console-chooser</div>,
}));
jest.mock("@/components/home/HomePage", () => ({
  HomePage: () => <h1>Secure identity for modern applications.</h1>,
}));
jest.mock("@/components/download/DownloadPage", () => ({
  DownloadPage: () => <div>download-page</div>,
}));
jest.mock("@/components/auth/AuthNavbar", () => ({ AuthNavbar: () => <nav>auth-navbar</nav> }));
jest.mock("@/components/auth/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock("@/lib/desktop-api", () => ({
  ...jest.requireActual("@/lib/desktop-api"),
  isDesktopRuntime: jest.fn(() => false),
}));

function openRoute(path: string) {
  return render(
    <StoreProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </StoreProvider>,
  );
}

beforeEach(() => mockIsDesktopRuntime.mockReturnValue(false));

describe("SPA not-found routes", () => {
  it.each(["/admin/missing/page", "/account/missing", "/404.html", "/missing?type=server_error"])(
    "shows a localized 404 instead of an authorization error for %s",
    async (path) => {
      openRoute(path);
      expect(screen.getByRole("heading", { name: en.error.types.not_found.title })).toBeVisible();
      expect(screen.queryByText(en.error.types.server_error.title)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: en.error.openAccount })).toHaveAttribute(
        "href",
        "/account/",
      );
      await act(() => i18next.changeLanguage("tr"));
      expect(screen.getByRole("heading", { name: tr.error.types.not_found.title })).toBeVisible();
      expect(screen.getByRole("link", { name: tr.error.backToHome })).toHaveAttribute("href", "/");
    },
  );

  it("lets the user return home through client-side routing", () => {
    openRoute("/account/missing");
    fireEvent.click(screen.getByRole("link", { name: en.error.backToHome }));
    expect(screen.getByRole("heading", { name: en.home.title })).toBeVisible();
    expect(screen.queryByText(en.error.types.not_found.title)).not.toBeInTheDocument();
  });

  it("preserves the dedicated authorization error route", () => {
    openRoute("/auth-error?type=server_error");
    expect(screen.getByRole("heading", { name: en.error.types.server_error.title })).toBeVisible();
  });
});

describe("layout and desktop routes", () => {
  it("renders a download page inside the download layout", () => {
    openRoute("/download");

    expect(screen.getByRole("navigation")).toHaveTextContent("auth-navbar");
    expect(screen.getByText("download-page")).toBeVisible();
  });

  it("selects desktop views when the desktop runtime is available", () => {
    mockIsDesktopRuntime.mockReturnValue(true);

    openRoute("/desktop-settings");
    expect(screen.getByText("desktop-settings-view")).toBeVisible();
  });

  it("shows the desktop companion and console chooser in the desktop runtime", () => {
    mockIsDesktopRuntime.mockReturnValue(true);

    openRoute("/desktop-companion");
    expect(screen.getByText("desktop-companion-view")).toBeVisible();
  });

  it("renders the desktop console chooser on the home and login routes", () => {
    mockIsDesktopRuntime.mockReturnValue(true);

    const home = openRoute("/");
    expect(screen.getByText("desktop-console-chooser")).toBeVisible();
    home.unmount();

    openRoute("/login");
    expect(screen.getByText("desktop-console-chooser")).toBeVisible();
  });
});

describe("resource detail routes", () => {
  it.each([
    "/admin/groups/7",
    "/admin/client-scopes/profile",
    "/admin/consents/client%2Fapp%2Fada",
    "/admin/identity-providers/github/mappers",
    "/admin/identity-providers/github",
    "/admin/organizations/org-7",
    "/admin/settings/user-profile/attribute-3",
  ])("matches the detail route %s", (path) => {
    openRoute(path);

    expect(
      screen.queryByRole("heading", { name: en.error.types.not_found.title }),
    ).not.toBeInTheDocument();
    if (path.startsWith("/admin/groups/"))
      expect(screen.getByTestId("group-detail")).toHaveTextContent("7");
    if (path.startsWith("/admin/client-scopes/"))
      expect(screen.getByTestId("scope-detail")).toHaveTextContent("profile");
    if (path.startsWith("/admin/consents/"))
      expect(screen.getByTestId("consent-detail")).toHaveTextContent("client/app/ada");
    if (path.includes("identity-providers/"))
      expect(screen.getByTestId("identity-provider-detail")).toHaveTextContent(
        path.endsWith("mappers") ? "github:mappers" : "github:details",
      );
    if (path.includes("organizations/"))
      expect(screen.getByTestId("organization-detail")).toHaveTextContent("org-7");
    if (path.includes("user-profile/"))
      expect(screen.getByTestId("profile-attribute-form")).toHaveTextContent("attribute-3");
  });
});
