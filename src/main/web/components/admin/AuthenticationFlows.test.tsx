import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AuthenticationFlows from "./AuthenticationFlows";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
let deleteBinding: (() => void) | undefined;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
}));
jest.mock("./AdminAuthProvider", () => ({
  useAdminAuth: () => ({ accessToken: "admin-token", access: { isAdmin: true } }),
}));
jest.mock("./AdminPageHeader", () => ({
  AdminPageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));
jest.mock("./DetailTabs", () => ({
  DetailTabs: ({
    tabs,
    active,
  }: {
    tabs: Array<{ key: string; label: string; onSelect?: () => void }>;
    active: string;
  }) => (
    <div data-testid="detail-tabs">
      {tabs.map((tab) => (
        <button key={tab.key} aria-pressed={tab.key === active} onClick={tab.onSelect}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));
jest.mock("./ConfirmModal", () => ({ ConfirmModal: () => null }));
jest.mock("./AsyncState", () => ({
  DetailLoadingState: () => <div>loading</div>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
}));
jest.mock("@/components/shared/ActionIcon", () => ({ ActionIcon: () => <span /> }));
jest.mock("./AdminActionIcon", () => ({ AdminActionIcon: () => <span /> }));

const flow = {
  id: 20,
  alias: "custom-browser",
  name: "Custom browser",
  description: null,
  flowType: "BASIC",
  topLevel: true,
  builtIn: false,
  requirement: null,
  priority: 0,
};

const bindings = [
  {
    bindingType: "BROWSER",
    flowId: 20,
    flowAlias: flow.alias,
    flowName: flow.name,
  },
  ...[
    "REGISTRATION",
    "RESET_CREDENTIALS",
    "FIRST_BROKER_LOGIN",
    "POST_BROKER_LOGIN",
    "DIRECT_GRANT",
  ].map((bindingType) => ({ bindingType, flowId: null, flowAlias: null, flowName: null })),
];

function mockRequests() {
  mockAdminRequest.mockImplementation((_token, request) => {
    if (request.url?.includes("/flows?page=")) {
      return Promise.resolve({
        status: 200,
        data: { content: [flow], number: 0, size: 20, totalElements: 1, totalPages: 1 },
      }) as never;
    }
    if (request.url?.endsWith("/bindings")) {
      return Promise.resolve({ status: 200, data: bindings }) as never;
    }
    if (request.url?.endsWith("/execution-providers")) {
      return Promise.resolve({ status: 200, data: ["otp-form"] }) as never;
    }
    if (request.url?.endsWith("/flows/20")) {
      return Promise.resolve({
        status: 200,
        data: { flow, executions: [], subFlows: [], nodes: [] },
      }) as never;
    }
    if (request.method === "DELETE" && request.url?.endsWith("/bindings/BROWSER")) {
      return new Promise((resolve) => {
        deleteBinding = () => resolve({ status: 200, data: { ...bindings[0], flowId: null } });
      }) as never;
    }
    return Promise.resolve({ status: 200, data: null }) as never;
  });
}

describe("AuthenticationFlows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminRequest.mockReset();
    deleteBinding = undefined;
    mockRequests();
  });

  it("renders the paged flow list and loads its detail", async () => {
    render(<AuthenticationFlows />);

    expect(
      await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle }),
    ).toBeVisible();
    expect(screen.getByText(flow.name)).toBeVisible();
    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({ url: "/api/admin/authentication/flows/20" }),
      ),
    );
  });

  it("allows clearing a binding and shows the pending spinner", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.bindings }),
    );

    const binding = await screen.findByLabelText("BROWSER");
    const bindingRow = binding.closest("tr");
    if (!bindingRow) throw new Error("Binding row was not rendered");
    fireEvent.change(binding, { target: { value: "" } });
    const removeButton = within(bindingRow).getByRole("button", {
      name: dictionary.admin.authentication.removeBinding,
    });
    fireEvent.click(removeButton);

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "DELETE",
          url: "/api/admin/authentication/bindings/BROWSER",
        }),
      ),
    );
    expect(removeButton).toBeDisabled();
    expect(removeButton.querySelector(".spinner-border")).not.toBeNull();

    await act(async () => {
      deleteBinding?.();
    });
  });

  it("switches between flow detail sections with tabs", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.flowSettings }),
    );
    expect(screen.getByLabelText(dictionary.admin.authentication.alias)).toBeVisible();

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.executions }),
    );
    expect(
      screen.getByRole("heading", { name: dictionary.admin.authentication.executions }),
    ).toBeVisible();

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.bindings }),
    );
    expect(await screen.findByLabelText("BROWSER")).toBeVisible();
  });
});
