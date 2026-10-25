import { render, screen } from "@testing-library/react";

import RootLayout, { metadata } from "./layout";

jest.mock("@/store/StoreProvider", () => ({
  StoreProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/auth/BrandingProvider", () => ({
  BrandingProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/auth/ThemeManager", () => ({ ThemeManager: () => null }));
jest.mock("@/lib/icon-loader", () => ({ loadIcons: jest.fn() }));

it("wraps the application content and exposes the base metadata", () => {
  render(
    <RootLayout>
      <main>application content</main>
    </RootLayout>,
  );

  expect(screen.getByText("application content")).toBeVisible();
  expect(document.documentElement).toHaveAttribute("lang", "en");
  expect(metadata.title).toBe("Kitezh");
});
