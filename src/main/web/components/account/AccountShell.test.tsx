import { fireEvent, render, screen } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import { AccountShell } from "./AccountShell";

let pathname = "/account/security";

jest.mock("@/routing/navigation", () => ({
  usePathname: () => pathname,
}));

jest.mock("./AccountAuthProvider", () => ({
  useAccountAuth: () => ({
    accessToken: "access-token",
    idTokenParsed: { picture: null },
    tokenParsed: null,
    logout: jest.fn().mockResolvedValue(undefined),
    username: "Ada",
  }),
}));

jest.mock("@/components/auth/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <span>language</span>,
}));

jest.mock("@/components/auth/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <span>theme</span>,
}));

jest.mock("@/components/auth/ConsoleUserMenu", () => ({
  ConsoleUserMenu: ({ username }: { username: string }) => <span>{username}</span>,
}));

jest.mock("@/components/auth/ConsoleAlerts", () => ({
  ConsoleAlertsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/shared/Icon", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

describe("AccountShell", () => {
  it("renders account navigation and marks the current page active", () => {
    render(
      <AccountShell locale="en" dictionary={dictionary}>
        <div>account content</div>
      </AccountShell>,
    );

    expect(screen.getByText(dictionary.account.product)).toBeVisible();
    expect(screen.getByText("account content")).toBeVisible();
    expect(screen.getByRole("link", { name: dictionary.account.nav.security })).toHaveClass(
      "active",
    );
    expect(screen.getByRole("link", { name: dictionary.account.nav.personalInfo })).not.toHaveClass(
      "active",
    );
    expect(screen.getByText("Ada")).toBeVisible();
  });

  it("opens and closes the mobile navigation", () => {
    render(
      <AccountShell locale="en" dictionary={dictionary}>
        <div>content</div>
      </AccountShell>,
    );

    const toggle = screen.getByRole("button", {
      name: dictionary.admin.common.toggleNavigation,
    });
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: dictionary.admin.common.closeNavigation }),
    ).toBeVisible();
    expect(screen.getByTestId("icon-xmark")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.closeNavigation }));
    expect(
      screen.queryByRole("button", { name: dictionary.admin.common.closeNavigation }),
    ).toBeNull();
    expect(screen.getByTestId("icon-bars")).toBeVisible();
  });

  it("treats the account root as personal information", () => {
    pathname = "/account/";
    render(
      <AccountShell locale="en" dictionary={dictionary}>
        <div>content</div>
      </AccountShell>,
    );
    expect(screen.getByRole("link", { name: dictionary.account.nav.personalInfo })).toHaveClass(
      "active",
    );
  });
});
