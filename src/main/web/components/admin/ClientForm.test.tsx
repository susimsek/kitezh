import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import { ClientForm } from "./ClientForm";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "token", access: { manageClients: true } }),
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
