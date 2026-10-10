import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";

import dictionary from "@/locales/en/common.json";
import { adminRequest } from "@/lib/admin-api";

import AuthenticationFlows from "./AuthenticationFlows";

const mockAdminRequest = adminRequest as jest.MockedFunction<typeof adminRequest>;
const mockAddAlert = jest.fn();
const mockAddError = jest.fn();
let deleteBinding: (() => void) | undefined;

jest.mock("@/lib/admin-api", () => ({ adminRequest: jest.fn() }));
jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
}));
jest.mock("@/components/auth/ConsoleAlerts", () => ({
  useConsoleAlerts: () => ({ addAlert: mockAddAlert, addError: mockAddError }),
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
const execution = {
  id: 30,
  flowId: flow.id,
  providerId: "otp-form",
  displayName: "One-time code",
  requirement: "REQUIRED" as const,
  priority: 0,
  authenticatorReference: null,
  configuration: null,
};
const detail = {
  flow,
  executions: [execution],
  subFlows: [],
  nodes: [
    {
      nodeType: "EXECUTION" as const,
      id: execution.id,
      name: execution.displayName,
      providerId: execution.providerId,
      requirement: execution.requirement,
      priority: execution.priority,
      builtIn: false,
    },
    {
      nodeType: "SUB_FLOW" as const,
      id: 31,
      name: "Conditional checks",
      providerId: null,
      requirement: "CONDITIONAL" as const,
      priority: 1,
      builtIn: false,
    },
  ],
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
      return Promise.resolve({ status: 200, data: detail }) as never;
    }
    if (request.url?.endsWith("/flows/31")) {
      return Promise.resolve({ status: 200, data: detail }) as never;
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

  it("validates the new flow form and cancels without submitting", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });

    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.authentication.createFlow }).at(-1)!,
    );
    const alias = screen.getByLabelText(dictionary.admin.authentication.alias);
    expect(alias).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.authentication.createFlow }).at(-1)!,
    );

    await waitFor(() => expect(alias).toHaveClass("is-invalid"));
    expect(mockAdminRequest).not.toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({ method: "POST", url: "/api/admin/authentication/flows" }),
    );

    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.authentication.cancel }));
    expect(screen.queryByLabelText(dictionary.admin.authentication.alias)).toBeNull();
  });

  it("opens and submits the execution form from the executions tab", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.executions }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.authentication.addExecution }).at(-1)!,
    );

    const executionName = screen.getByLabelText(dictionary.admin.authentication.name);
    fireEvent.change(executionName, { target: { value: "One-time code" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: dictionary.admin.authentication.addExecution }).at(-1)!,
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/authentication/flows/20/executions",
          data: expect.objectContaining({
            providerId: "username-password-form",
            displayName: "One-time code",
            requirement: "REQUIRED",
          }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.authentication.saveSuccess);
  });

  it("saves flow settings through the protected update endpoint", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.flowSettings }),
    );

    fireEvent.change(screen.getByLabelText(dictionary.admin.authentication.name), {
      target: { value: "Updated browser flow" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.admin.authentication.saveFlow }));

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/authentication/flows/20",
          data: expect.objectContaining({ name: "Updated browser flow", alias: "custom-browser" }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.authentication.saveSuccess);
  });

  it("creates a sub-flow with its default alternative requirement", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.admin.authentication.createSubFlow }),
    );

    fireEvent.change(screen.getByLabelText(dictionary.admin.authentication.alias), {
      target: { value: "password-step" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.admin.authentication.name), {
      target: { value: "Password step" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: dictionary.admin.authentication.createSubFlow })
        .at(-1)!,
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "POST",
          url: "/api/admin/authentication/flows/20/sub-flows",
          data: expect.objectContaining({
            alias: "password-step",
            name: "Password step",
            requirement: "ALTERNATIVE",
          }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.authentication.saveSuccess);
  });

  it("edits an existing execution from the graph and saves the update", async () => {
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));
    fireEvent.click(await screen.findByRole("button", { name: /One-time code/ }));

    const name = await screen.findByLabelText(dictionary.admin.authentication.name);
    expect(name).toHaveValue(execution.displayName);
    fireEvent.change(name, { target: { value: "Updated one-time code" } });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.admin.authentication.saveExecution }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/authentication/flows/20/executions/30",
          data: expect.objectContaining({ displayName: "Updated one-time code" }),
        }),
      ),
    );
    expect(mockAddAlert).toHaveBeenCalledWith(dictionary.admin.authentication.saveSuccess);
  });

  it("moves graph nodes and reports failed reorder requests", async () => {
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
        return Promise.resolve({ status: 200, data: detail }) as never;
      }
      if (request.url?.endsWith("/position")) {
        return Promise.resolve({ status: 500, data: null }) as never;
      }
      return Promise.resolve({ status: 200, data: null }) as never;
    });
    render(<AuthenticationFlows />);
    await screen.findByRole("heading", { name: dictionary.admin.authentication.flowsTitle });
    fireEvent.click(await screen.findByRole("button", { name: /Custom browser custom-browser/ }));

    const node = await screen.findByRole("button", { name: /One-time code/ });
    const nodeRow = node.closest(".border.rounded");
    if (!(nodeRow instanceof HTMLElement)) throw new Error("Execution graph node was not rendered");
    fireEvent.click(
      within(nodeRow).getByRole("button", { name: dictionary.admin.authentication.moveUp }),
    );

    await waitFor(() =>
      expect(mockAdminRequest).toHaveBeenCalledWith(
        "admin-token",
        expect.objectContaining({
          method: "PUT",
          url: "/api/admin/authentication/flows/20/nodes/EXECUTION/30/position",
          data: { direction: "UP" },
        }),
      ),
    );
    expect(mockAddError).toHaveBeenCalledWith(dictionary.admin.authentication.saveError);
  });
});
