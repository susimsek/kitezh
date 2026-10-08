jest.mock("axios", () => {
  const request = jest.fn();
  const responseUse = jest.fn();
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => ({ interceptors: { response: { use: responseUse } }, request })),
      request,
      responseUse,
    },
  };
});

import axios from "axios";
import { adminRequest, registerAdminTokenHandlers } from "./admin-api";

const mockAxios = axios as unknown as {
  create: jest.Mock;
  request: jest.Mock;
  responseUse: jest.Mock;
};

describe("admin API", () => {
  beforeEach(() => {
    mockAxios.request.mockReset();
    registerAdminTokenHandlers(undefined);
  });

  it("configures axios instances to accept all statuses", () => {
    expect(mockAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(mockAxios.create.mock.calls[0][0].validateStatus()).toBe(true);
  });

  it("adds the bearer token to outgoing requests", () => {
    adminRequest("access-token", { url: "/api/admin/clients" });

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/admin/clients",
        headers: { Authorization: "Bearer access-token" },
      }),
    );
    expect(mockAxios.request.mock.calls[0][0].validateStatus()).toBe(true);
  });

  it("refreshes once and retries an unauthorized request", async () => {
    const refresh = jest.fn().mockResolvedValue("renewed-token");
    const unauthorized = jest.fn();
    const setAuthorization = jest.fn();
    registerAdminTokenHandlers({ refresh, unauthorized });
    const interceptor = mockAxios.responseUse.mock.calls[0][0];
    const response = { status: 401, config: { headers: { set: setAuthorization } } };

    await interceptor(response);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setAuthorization).toHaveBeenCalledWith("Authorization", "Bearer renewed-token");
    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({ _consoleRetried: true }),
    );
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it("notifies the caller when refresh fails and does not retry twice", async () => {
    const refresh = jest.fn().mockResolvedValue(null);
    const unauthorized = jest.fn();
    registerAdminTokenHandlers({ refresh, unauthorized });
    const interceptor = mockAxios.responseUse.mock.calls[0][0];
    const response = { status: 401, config: { _adminRetried: false, headers: { set: jest.fn() } } };

    await interceptor(response);
    await interceptor({ ...response, config: { ...response.config, _consoleRetried: true } });

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("returns non-401 responses and requests without handlers unchanged", async () => {
    const interceptor = mockAxios.responseUse.mock.calls[0][0];
    const ok = { status: 200, config: { headers: { set: jest.fn() } } };
    const unauthorized = { status: 401, config: { headers: { set: jest.fn() } } };

    await expect(interceptor(ok)).resolves.toBe(ok);
    await expect(interceptor(unauthorized)).resolves.toBe(unauthorized);
  });

  it("normalizes Spring Data's stable page DTO for existing console consumers", async () => {
    const interceptor = mockAxios.responseUse.mock.calls[0][0];
    const response = {
      status: 200,
      config: { headers: { set: jest.fn() } },
      data: {
        content: [{ id: "client-1" }],
        page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
      },
    };

    await expect(interceptor(response)).resolves.toBe(response);
    expect(response.data).toEqual({
      content: [{ id: "client-1" }],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
  });
});
