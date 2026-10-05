/* eslint-disable react/display-name */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import { StoreProvider } from "@/store/StoreProvider";

import { AdminShell } from "./AdminShell";

const mockLogout = jest.fn().mockResolvedValue(undefined);
const defaultAdminAccess = {
  isAdmin: true,
  viewClients: true,
  viewUsers: true,
  manageRoles: true,
  viewSessions: true,
  viewConsents: true,
  viewKeys: true,
};
const mockAdminAccess = { ...defaultAdminAccess };

jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/admin/clients/detail",
}));
jest.mock("@/routing/Link", () => ({ children, href, ...props }: React.ComponentProps<"a">) => (
  <a href={href} {...props}>
    {children}
  </a>
));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    access: mockAdminAccess,
    idTokenParsed: { picture: "/avatars/admin?v=1" },
    logout: mockLogout,
    tokenParsed: null,
    username: "admin",
  }),
}));
jest.mock("@/components/auth/ConsoleUserMenu", () => ({
  ConsoleUserMenu: ({
    username,
    avatarSrc,
    logoutLabel,
    onLogout,
  }: {
    username: string;
    avatarSrc?: string | null;
    logoutLabel: string;
    onLogout: () => void;
  }) => (
    <div data-avatar-src={avatarSrc}>
      <span>{username}</span>
      <button onClick={onLogout}>{logoutLabel}</button>
    </div>
  ),
}));
jest.mock("@/components/auth/LanguageSwitcher", () => ({
  LanguageSwitcher: ({ label }: { label: string }) => <button>{label}</button>,
}));
jest.mock("@/components/auth/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <button>Theme</button>,
}));
jest.mock("./AdminGlobalSearch", () => ({
  AdminGlobalSearch: () => <div aria-label="global search" />,
}));
jest.mock("@fortawesome/react-fontawesome", () => ({
  FontAwesomeIcon: () => <span aria-hidden="true" />,
}));
jest.mock("react-bootstrap", () => {
  const MockNavbar = ({
    children,
    fluid: _fluid,
    ...props
  }: React.ComponentProps<"nav"> & { fluid?: boolean }) => {
    void _fluid;
    return <nav {...props}>{children}</nav>;
  };
  const MockNavbarBrand = ({
    children,
    as: _as,
    ...props
  }: React.ComponentProps<"a"> & { as?: unknown }) => {
    void _as;
    return <a {...props}>{children}</a>;
  };
  const MockNav = ({ children, ...props }: React.ComponentProps<"nav">) => (
    <nav {...props}>{children}</nav>
  );
  const MockNavLink = ({
    children,
    as: _as,
    active: _active,
    href,
    ...props
  }: React.ComponentProps<"a"> & { as?: unknown; active?: boolean }) => {
    void _as;
    void _active;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
  return {
    __esModule: true,
    Button: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
    Container: ({
      children,
      fluid: _fluid,
      ...props
    }: React.ComponentProps<"div"> & { fluid?: boolean }) => {
      void _fluid;
      return <div {...props}>{children}</div>;
    },
    Nav: Object.assign(MockNav, { Link: MockNavLink }),
    Navbar: Object.assign(MockNavbar, { Brand: MockNavbarBrand }),
  };
});

describe("AdminShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockAdminAccess, defaultAdminAccess);
  });

  it("renders permitted navigation and redirects after logout", async () => {
    render(
      <StoreProvider>
        <AdminShell locale="en" dictionary={dictionary}>
          <div>Content</div>
        </AdminShell>
      </StoreProvider>,
    );
    expect(screen.getByText(dictionary.admin.product)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.clients)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.users)).toBeVisible();
    expect(screen.queryByText(dictionary.admin.nav.dashboard)).toBeVisible();
    expect(screen.getByText("admin").parentElement).toHaveAttribute(
      "data-avatar-src",
      "/avatars/admin?v=1",
    );
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.logout }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    const toggle = screen.getByRole("button", {
      name: dictionary.admin.common.toggleNavigation,
    });
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: dictionary.admin.common.closeNavigation }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.closeNavigation }));
  });

  it("uses query access for resource discovery navigation", () => {
    Object.assign(mockAdminAccess, {
      isAdmin: false,
      viewClients: false,
      viewUsers: false,
      queryClients: true,
      queryUsers: true,
      queryGroups: true,
      viewGroups: false,
    });

    render(
      <StoreProvider>
        <AdminShell locale="en" dictionary={dictionary}>
          <div>Content</div>
        </AdminShell>
      </StoreProvider>,
    );

    expect(screen.getByText(dictionary.admin.nav.clients)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.users)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.groups)).toBeVisible();
  });

  it("keeps viewer navigation visible without query access", () => {
    Object.assign(mockAdminAccess, {
      isAdmin: false,
      queryClients: false,
      viewClients: true,
      queryUsers: false,
      viewUsers: true,
      queryGroups: false,
      viewGroups: true,
    });

    render(
      <StoreProvider>
        <AdminShell locale="en" dictionary={dictionary}>
          <div>Content</div>
        </AdminShell>
      </StoreProvider>,
    );

    expect(screen.getByText(dictionary.admin.nav.clients)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.users)).toBeVisible();
    expect(screen.getByText(dictionary.admin.nav.groups)).toBeVisible();
  });
});
