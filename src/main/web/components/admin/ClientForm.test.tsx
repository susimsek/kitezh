import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";
import { adminRequest } from "@/lib/admin-api";

import { ClientForm } from "./ClientForm";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
let mockAccessToken: string | null = "token";
let mockCanManageClients = true;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({
    accessToken: mockAccessToken,
    access: { manageClients: mockCanManageClients },
  }),
}));
jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

function advanceCreateStep(label = "Next") {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("ClientForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = "token";
    mockCanManageClients = true;
  });

  it("shows the edit not-found state when the route id is absent", () => {
    render(<ClientForm dictionary={dictionary} id={null} locale="en" mode="edit" />);

    expect(screen.getByText(dictionary.admin.clients.notFound)).toBeInTheDocument();
  });

  it("creates a client and reveals the one-time secret", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 201,
      data: { client: { id: "client-1" }, clientSecret: "created-secret" },
    } as never);

    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "web-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Web client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(await screen.findByText("created-secret")).toBeInTheDocument();
    expect(mockAdminRequest).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "POST", url: "/api/admin/clients" }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.common.close })[1]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/clients/client-1/settings"));
  });

  it("loads an existing client and saves its edited details", async () => {
    const existing = {
      id: "client-1",
      clientId: "old-client",
      clientName: "Old client",
      clientAuthenticationMethods: ["client_secret_basic"],
      authorizationGrantTypes: [
        "authorization_code",
        "urn:ietf:params:oauth:grant-type:token-exchange",
      ],
      redirectUris: ["https://app.example/callback"],
      postLogoutRedirectUris: [],
      scopes: ["openid"],
      requireAuthorizationConsent: true,
      requireProofKey: true,
      tokenExchangeDownscopeOnly: false,
      tokenExchangeAllowDelegation: false,
      tokenExchangeAllowedAudiences: ["reports-api"],
      authorizationCodeTimeToLive: "PT5M",
      accessTokenTimeToLive: "PT5M",
      refreshTokenTimeToLive: "PT1H",
    };
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: existing } as never);
    mockAdminRequest.mockResolvedValueOnce({ status: 200, data: existing } as never);

    render(<ClientForm dictionary={dictionary} id="client-1" locale="en" mode="edit" />);
    expect(await screen.findByDisplayValue("old-client")).toBeInTheDocument();
    expect(
      screen.getByLabelText(dictionary.admin.clients.tokenExchangeDownscopeOnly),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(dictionary.admin.clients.tokenExchangeAllowedAudiences),
    ).toHaveValue("reports-api");
    fireEvent.click(screen.getByLabelText(dictionary.admin.clients.tokenExchangeDownscopeOnly));
    fireEvent.change(
      screen.getByLabelText(dictionary.admin.clients.tokenExchangeAllowedAudiences),
      {
        target: { value: "reports-api\nanalytics-api" },
      },
    );
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Updated client" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/clients/client-1/settings"));
    expect(mockAdminRequest).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({
        method: "PUT",
        data: expect.objectContaining({
          tokenExchangeDownscopeOnly: true,
          tokenExchangeAllowedAudiences: ["reports-api", "analytics-api"],
        }),
      }),
    );
  });

  it("covers capability toggles, switches, cancel, and validation branches", async () => {
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    advanceCreateStep();
    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(checkboxes[4]);
    fireEvent.click(checkboxes[5]);
    fireEvent.click(checkboxes[6]);
    fireEvent.click(checkboxes[7]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.cancel }));
    expect(mockPush).toHaveBeenCalledWith("/admin/clients");

    advanceCreateStep();
    advanceCreateStep();
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    fireEvent.click(screen.getByRole("button", { name: /1 General settings/ }));
    expect(await screen.findAllByText(dictionary.admin.common.validation.required)).toHaveLength(2);
  });

  it("allows clearing the selected DPoP signing algorithms", async () => {
    mockAdminRequest.mockReset();
    mockAdminRequest.mockResolvedValue({ status: 200, data: { content: [] } } as never);
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    advanceCreateStep();

    const toggleChoice = (label: string) => {
      const input = screen.getByText(label).closest(".form-check")?.querySelector("input");
      if (!input) throw new Error(`Missing capability choice: ${label}`);
      fireEvent.click(input);
    };
    toggleChoice("RS256");
    toggleChoice("ES256");
    for (const algorithm of ["RS256", "ES256"]) {
      const input = screen.getByText(algorithm).closest(".form-check")?.querySelector("input");
      if (!input) throw new Error(`Missing DPoP algorithm checkbox: ${algorithm}`);
      expect(input).not.toBeChecked();
    }
  });

  it("covers client security switches and create-time scope selection", async () => {
    mockAdminRequest.mockImplementation(async (_token, request) => {
      if (request.url === "/api/admin/client-scopes?page=0&size=100") {
        return {
          status: 200,
          data: {
            content: [
              {
                id: "scope-openid",
                name: "openid",
                displayName: "OpenID scope",
                description: "Provides the OpenID Connect identity scope.",
              },
              { id: "scope-custom", name: "custom-api", displayName: "Custom API" },
            ],
          },
        } as never;
      }
      if (request.url === "/api/admin/clients" && request.method === "POST") {
        return {
          status: 201,
          data: { client: { id: "security-client" }, clientSecret: null },
        } as never;
      }
      return { status: 200, data: {} } as never;
    });

    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "security-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Security client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    await screen.findByText("OpenID scope");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    const toggleSetting = (label: string) => {
      const input = screen.getByText(label).closest(".admin-setting-row")?.querySelector("input");
      if (!input) throw new Error(`Missing client security switch: ${label}`);
      fireEvent.click(input);
    };
    for (const label of [
      dictionary.admin.clients.requirePkce,
      dictionary.admin.clients.requireConsent,
      dictionary.admin.clients.requireDpop,
      dictionary.admin.clients.requireDpopJkt,
      dictionary.admin.clients.dpopRefreshTokenOnly,
    ]) {
      toggleSetting(label);
    }

    const dpopSettings = screen
      .getByText(dictionary.admin.clients.dpopAlgorithms)
      .closest(".admin-setting-row");
    const algorithms = dpopSettings?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (!algorithms || algorithms.length < 2) throw new Error("Missing DPoP algorithm options");
    fireEvent.click(algorithms[0]);
    fireEvent.click(algorithms[0]);

    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    const openIdScope = screen
      .getByText("OpenID scope")
      .closest(".client-scope-create-option")
      ?.querySelector("input");
    if (!openIdScope) throw new Error("Missing OpenID scope option");
    fireEvent.click(openIdScope);
    fireEvent.click(openIdScope);
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          method: "POST",
          data: expect.objectContaining({
            requireProofKey: false,
            requireAuthorizationConsent: false,
            requireDpop: true,
            requireDpopJkt: true,
            dpopRefreshTokenOnly: true,
            dpopSigningAlgorithms: expect.arrayContaining(["RS256", "ES256"]),
            scopes: ["profile", "openid"],
          }),
        }),
      ),
    );
  });

  it("rejects a public client combined with client credentials", async () => {
    mockAdminRequest.mockResolvedValue({ status: 200, data: { content: [] } } as never);
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "public-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Public client" },
    });
    advanceCreateStep();

    const toggleChoice = (label: string) => {
      const input = screen.getByText(label).closest(".form-check")?.querySelector("input");
      if (!input) throw new Error(`Missing capability choice: ${label}`);
      fireEvent.click(input);
    };
    toggleChoice("none");
    toggleChoice("client_credentials");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(
      (await screen.findAllByText(dictionary.admin.common.validation.selection)).length,
    ).toBeGreaterThan(0);
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "POST", url: "/api/admin/clients" }),
    );
  });

  it("returns to the first invalid step when saving from the final step", async () => {
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 General settings/ })).toHaveClass("active"),
    );
    expect(screen.getAllByText(dictionary.admin.common.validation.required)).toHaveLength(2);
  });

  it("rejects malformed and fragment-bearing client redirect URLs", async () => {
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "uri-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "URI client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://client.example/callback#fragment" },
    });
    fireEvent.change(document.querySelector('textarea[name="postLogoutRedirectUris"]')!, {
      target: { value: "https://client.example/logout#fragment" },
    });
    fireEvent.change(document.querySelector('input[name="rootUrl"]')!, {
      target: { value: "not-an-absolute-url" },
    });
    fireEvent.change(document.querySelector('input[name="homeUrl"]')!, {
      target: { value: "https://client.example/#fragment" },
    });
    fireEvent.change(document.querySelector('input[name="adminUrl"]')!, {
      target: { value: "not-an-absolute-url" },
    });
    fireEvent.change(document.querySelector('textarea[name="webOrigins"]')!, {
      target: { value: "https://client.example/#fragment" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(await screen.findAllByText(dictionary.admin.common.validation.uri)).toHaveLength(6);
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "POST", url: "/api/admin/clients" }),
    );
  });

  it("validates CIBA delivery and conditional authentication requirements", async () => {
    mockAdminRequest.mockImplementation(async (_token, request) => {
      if (request.url === "/api/admin/client-scopes?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (request.url === "/api/admin/clients/client-ciba") {
        return {
          status: 200,
          data: {
            id: "client-ciba",
            clientId: "ciba-client",
            clientName: "CIBA client",
            enabled: true,
            clientAuthenticationMethods: [
              "client_secret_basic",
              "private_key_jwt",
              "tls_client_auth",
            ],
            authorizationGrantTypes: ["authorization_code", "refresh_token"],
            redirectUris: ["https://app.example/callback"],
            postLogoutRedirectUris: [],
            webOrigins: [],
            scopes: ["openid"],
            requireAuthorizationConsent: true,
            requireProofKey: true,
            cibaDeliveryMode: "push",
            cibaNotificationEndpoint: "",
            jwkSetUrl: "not-an-absolute-url",
            x509CertificateSubjectDN: "x".repeat(501),
          },
        } as never;
      }
      return { status: 200, data: {} } as never;
    });
    render(<ClientForm dictionary={dictionary} id="client-ciba" locale="en" mode="edit" />);
    await screen.findByDisplayValue("ciba-client");
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(
      await screen.findAllByText(dictionary.admin.common.validation.selection),
    ).not.toHaveLength(0);
    expect(screen.getByText(dictionary.admin.common.validation.required)).toBeVisible();
    expect(screen.getByText(dictionary.admin.common.validation.uri)).toBeVisible();
    expect(document.querySelector('input[name="cibaNotificationEndpoint"]')).toHaveClass(
      "is-invalid",
    );
    expect(document.querySelector('input[name="x509CertificateSubjectDN"]')).toHaveClass(
      "is-invalid",
    );
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ method: "PUT", url: "/api/admin/clients/client-ciba" }),
    );
  });

  it("returns to the general step when the API reports a duplicate client ID", async () => {
    mockAdminRequest.mockImplementation(async (_token, request) => {
      if (request.url === "/api/admin/client-scopes?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      if (request.url === "/api/admin/clients" && request.method === "POST") {
        return {
          status: 409,
          data: {
            errorCode: "admin_client_duplicate_client_id",
            violations: [{ field: "clientId" }],
          },
        } as never;
      }
      return { status: 200, data: {} } as never;
    });

    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "duplicate-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Duplicate client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(
      await screen.findByText(dictionary.admin.common.validation.clientIdDuplicate),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /1 General settings/ })).toHaveClass("active");
  });

  it("routes directly after creating a client without a secret", async () => {
    mockAdminRequest.mockResolvedValue({
      status: 201,
      data: { client: { id: "client-2" }, clientSecret: null },
    } as never);
    render(<ClientForm dictionary={dictionary} locale="tr" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "mobile-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Mobile client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/clients/client-2/settings"));
  });

  it("does not send a save request when the access token is no longer available", async () => {
    mockAccessToken = null;
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "expired-token-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Expired token client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: dictionary.admin.common.save }),
      ).not.toHaveAttribute("aria-busy", "true"),
    );
    expect(mockAdminRequest).not.toHaveBeenCalled();
  });

  it("maps server field validation errors for scope, URI and selection fields", async () => {
    mockAdminRequest.mockImplementation(async (_token, request) => {
      if (request.url === "/api/admin/client-scopes?page=0&size=100") {
        return { status: 200, data: { content: [] } } as never;
      }
      return {
        status: 400,
        data: {
          errorCode: "validation_failed",
          violations: [
            { field: "scopes" },
            { field: "redirectUris" },
            { field: "clientAuthenticationMethods" },
            { field: "authorizationGrantTypes" },
          ],
        },
      } as never;
    });
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "server-invalid-client" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Server invalid client" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));

    expect(await screen.findByText(dictionary.admin.clients.saveError)).toBeVisible();
    expect(await screen.findByText(dictionary.admin.common.validation.scope)).toBeVisible();
    expect(screen.getByText(dictionary.admin.common.validation.uri)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /2 Capability configuration/ }));
    expect(await screen.findAllByText(dictionary.admin.common.validation.selection)).toHaveLength(
      2,
    );
  });

  it("shows edit load errors and maps duplicate client errors", async () => {
    mockAdminRequest.mockResolvedValueOnce({ status: 500, data: null } as never);
    const failedView = render(
      <ClientForm dictionary={dictionary} id="missing" locale="en" mode="edit" />,
    );
    expect(await screen.findByText(dictionary.admin.clients.saveError)).toBeVisible();
    failedView.unmount();

    mockAdminRequest.mockResolvedValue({
      status: 400,
      data: {
        errorCode: "admin_client_duplicate_client_id",
        detail: "Duplicate client",
        violations: [{ field: "clientId" }, { field: "redirectUris" }],
      },
    } as never);
    render(<ClientForm dictionary={dictionary} locale="en" mode="create" />);
    fireEvent.change(document.querySelector('input[name="clientId"]')!, {
      target: { value: "duplicate" },
    });
    fireEvent.change(document.querySelector('input[name="clientName"]')!, {
      target: { value: "Duplicate" },
    });
    advanceCreateStep();
    advanceCreateStep();
    fireEvent.change(document.querySelector('textarea[name="redirectUris"]')!, {
      target: { value: "https://app.example/callback" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.common.save }));
    expect(await screen.findByText("Duplicate client")).toBeVisible();
  });
});
