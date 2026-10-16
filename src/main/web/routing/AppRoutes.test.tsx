import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "i18next";
import en from "@kitezh/shared/web-messages/en";
import tr from "@kitezh/shared/web-messages/tr";
import { StoreProvider } from "@/store/StoreProvider";
import { AppRoutes } from "./AppRoutes";

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

function openRoute(path: string) {
  return render(
    <StoreProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </StoreProvider>,
  );
}

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

describe("resource detail routes", () => {
  it.each([
    "/admin/groups/7",
    "/admin/client-scopes/profile",
    "/admin/consents/client%2Fapp%2Fada",
    "/admin/identity-providers/github/mappers",
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
      expect(screen.getByTestId("identity-provider-detail")).toHaveTextContent("github:mappers");
  });
});
