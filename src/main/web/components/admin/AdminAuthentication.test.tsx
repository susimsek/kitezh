import { render, screen } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import AdminAuthentication from "./AdminAuthentication";

let policy: string | undefined = "webauthn";
let admin = true;

jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
}));

jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ policy }),
}));

jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ access: admin ? { isAdmin: true } : null }),
}));

jest.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div>navigate:{to}</div>,
}));

jest.mock("./AdminPageHeader", () => ({
  AdminPageHeader: ({ title, description }: { title: string; description: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

jest.mock("./DetailTabs", () => ({
  DetailTabs: ({ tabs, active }: { tabs: Array<{ label: string }>; active: string }) => (
    <div>
      <span>active:{active}</span>
      {tabs.map((tab) => (
        <span key={tab.label}>{tab.label}</span>
      ))}
    </div>
  ),
}));

jest.mock("./LoginSettings", () => ({
  __esModule: true,
  default: ({ embedded, focusSection }: { embedded: boolean; focusSection: string }) => (
    <div>
      login-settings:{String(embedded)}:{focusSection}
    </div>
  ),
}));

describe("AdminAuthentication", () => {
  afterEach(() => {
    admin = true;
    policy = "webauthn";
  });

  it("redirects users without administration access", () => {
    admin = false;
    render(<AdminAuthentication />);
    expect(screen.getByText("navigate:/auth-error?type=access_denied")).toBeVisible();
  });

  it("renders the selected authentication policy", () => {
    render(<AdminAuthentication />);
    expect(
      screen.getByRole("heading", { name: dictionary.admin.authentication.title }),
    ).toBeVisible();
    expect(screen.getByText(`login-settings:true:webauthn`)).toBeVisible();
    expect(screen.getByText(dictionary.admin.authentication.webauthnPolicy)).toBeVisible();
  });

  it("falls back to password policy for an unknown route", () => {
    policy = "unknown";
    render(<AdminAuthentication />);
    expect(screen.getByText("login-settings:true:password-policy")).toBeVisible();
  });
});
