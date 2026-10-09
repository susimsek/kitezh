import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { IdentityProviderDetail } from "./IdentityProviderDetail";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: () => ({ accessToken: "admin-token" }) }));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
}));
jest.mock("./IdentityProviderForm", () => ({
  IdentityProviderForm: ({ id }: { id: string }) => <div>provider-form:{id}</div>,
}));
jest.mock("./AdminBreadcrumb", () => ({ AdminBreadcrumb: () => <div>breadcrumb</div> }));
jest.mock("./DetailTabs", () => ({ DetailTabs: () => <div>tabs</div> }));
jest.mock("./DataTable", () => ({
  DataTable: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      <table>{children}</table>
      {footer}
    </div>
  ),
}));
jest.mock("./PaginationControls", () => ({ PaginationControls: () => <div>pagination</div> }));
jest.mock("./ResourceFilters", () => ({ ResourceFilters: () => <div>filters</div> }));
jest.mock("./useAdminTableState", () => ({
  useAdminTableState: () => ({
    page: 0,
    query: "",
    setPage: jest.fn(),
    setQuery: jest.fn(),
    setSize: jest.fn(),
    setSort: jest.fn(),
    size: 10,
    sort: "name,asc",
    clearFilters: jest.fn(),
  }),
}));
jest.mock("./RowActions", () => ({
  RowActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("./ConfirmModal", () => ({
  ConfirmModal: ({
    show,
    message,
    cancelLabel,
    confirmLabel,
    onCancel,
    onConfirm,
  }: {
    show: boolean;
    message: string;
    cancelLabel: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
  }) =>
    show ? (
      <div role="dialog">
        <p>{message}</p>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const provider = {
  id: "provider-1",
  registrationId: "google",
  providerType: "oidc",
  displayName: "Google",
  alias: "google",
  iconKey: "google",
  shortStateParameter: false,
  caseSensitiveUsername: false,
  enabled: true,
  clientId: "client",
  clientSecret: "",
  hideOnLogin: false,
  accountLinkingOnly: false,
  trustEmail: true,
  mfaRequired: false,
  requiredClaims: "sub,email",
  storeTokens: false,
  storedTokensReadable: false,
  guiOrder: 0,
  showInAccountConsole: "always",
  syncMode: "import",
  authorizationUri: "https://example.test/auth",
  tokenUri: "https://example.test/token",
  userInfoUri: "https://example.test/userinfo",
  jwkSetUri: "https://example.test/jwks",
  issuerUri: "https://example.test",
  clientAuthenticationMethod: "client_secret_basic",
  scopes: "openid profile",
  userNameAttribute: "sub",
  mapperCount: 1,
};
const mapper = {
  id: "mapper-1",
  providerAlias: "google",
  name: "email-mapper",
  sourceClaim: "email",
  target: "email",
  mapperType: "claim",
  syncMode: "import",
  addToIdToken: true,
  addToAccessToken: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.url?.includes("/mappers")) {
      if (request.method === "DELETE") return Promise.resolve({ status: 204, data: null }) as never;
      if (request.method === "POST" || request.method === "PUT")
        return Promise.resolve({ status: 200, data: mapper }) as never;
      return Promise.resolve({
        status: 200,
        data: { content: [mapper], totalPages: 1, totalElements: 1 },
      }) as never;
    }
    return Promise.resolve({ status: 200, data: provider }) as never;
  });
});

describe("IdentityProviderDetail", () => {
  it("creates, edits, and deletes an identity-provider mapper", async () => {
    render(
      <IdentityProviderDetail dictionary={dictionary} locale="en" id="provider-1" tab="mappers" />,
    );
    expect(await screen.findByText("email-mapper")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.identityProviders.createMapper }),
    );
    const mapperInputs = screen.getAllByRole("textbox");
    fireEvent.change(mapperInputs[0], { target: { value: "new-mapper" } });
    fireEvent.change(mapperInputs[1], { target: { value: "sub" } });
    fireEvent.change(mapperInputs[2], { target: { value: "username" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.identityProviders.mapperCreated);

    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.identityProviders.mapperSaved);

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.identityProviders.deleted);
  });

  it("renders the provider details tab and handles loading failures", async () => {
    const { rerender } = render(
      <IdentityProviderDetail dictionary={dictionary} locale="en" id="provider-1" tab="details" />,
    );
    expect(await screen.findByText("provider-form:provider-1")).toBeVisible();
    mockAdminRequest.mockRejectedValueOnce(new Error("network"));
    rerender(
      <IdentityProviderDetail dictionary={dictionary} locale="en" id="provider-1" tab="details" />,
    );
  });
});
