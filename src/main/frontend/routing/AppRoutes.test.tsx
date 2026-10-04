import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "i18next";
import en from "@/locales/en/common.json";
import tr from "@/locales/tr/common.json";
import { StoreProvider } from "@/store/StoreProvider";
import { AppRoutes } from "./AppRoutes";

jest.unmock("@/routing/Link");

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
