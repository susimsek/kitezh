import { authenticatePasskey, registerPasskey, supportsConditionalMediation } from "./webauthn";

function installWebAuthn(publicKeyCredential: unknown = class PublicKeyCredential {}) {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: publicKeyCredential,
  });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {
      create: jest.fn(),
      get: jest.fn(),
    },
  });
  return navigator.credentials as unknown as {
    create: jest.Mock;
    get: jest.Mock;
  };
}

describe("WebAuthn helpers", () => {
  afterEach(() => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: undefined,
    });
  });

  it("rejects registration when WebAuthn is unavailable", async () => {
    installWebAuthn(null);
    await expect(registerPasskey(jest.fn(), "label")).rejects.toThrow("WebAuthn is not supported");
  });

  it("registers a passkey and sends encoded credential data", async () => {
    const credentials = installWebAuthn();
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          challenge: "AQI",
          user: { id: "AwQ", name: "user", displayName: "User" },
          excludeCredentials: [{ id: "BQY", type: "public-key" }],
        },
      })
      .mockResolvedValueOnce({ status: 204, data: null });
    const publicKey = {
      id: "credential-id",
      type: "public-key",
      rawId: new Uint8Array([7, 8]).buffer,
      response: {
        attestationObject: new Uint8Array([9]).buffer,
        clientDataJSON: new Uint8Array([10]).buffer,
        getTransports: () => ["internal"],
      },
      getClientExtensionResults: () => ({ appid: true }),
      authenticatorAttachment: "platform",
    };
    credentials.create.mockResolvedValue(publicKey);

    await registerPasskey(request, "Windows Hello");

    expect(credentials.create).toHaveBeenCalledWith({
      publicKey: expect.objectContaining({
        challenge: expect.any(ArrayBuffer),
        user: expect.objectContaining({ id: expect.any(ArrayBuffer) }),
        excludeCredentials: [{ id: expect.any(ArrayBuffer), type: "public-key" }],
      }),
    });
    expect(request).toHaveBeenLastCalledWith(
      "/webauthn/register",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"label":"Windows Hello"'),
      }),
    );
  });

  it.each([
    ["options", { status: 400, data: null }, "Passkey options could not be loaded"],
    [
      "credential",
      { status: 200, data: { challenge: "AQI", user: { id: "AwQ" } } },
      "No passkey was created",
    ],
    [
      "registration",
      { status: 200, data: { challenge: "AQI", user: { id: "AwQ" } } },
      "Passkey could not be registered",
    ],
  ])("reports %s failures", async (kind, response, message) => {
    const credentials = installWebAuthn();
    const request = jest.fn().mockResolvedValue(response);
    if (kind === "credential") {
      credentials.create.mockResolvedValue(null);
    } else if (kind === "registration") {
      credentials.create.mockResolvedValue({
        id: "credential-id",
        type: "public-key",
        rawId: new Uint8Array([1]).buffer,
        response: {
          attestationObject: new Uint8Array([2]).buffer,
          clientDataJSON: new Uint8Array([3]).buffer,
        },
        getTransports: () => [],
        getClientExtensionResults: () => ({}),
      });
      request.mockResolvedValueOnce(response).mockResolvedValueOnce({ status: 400, data: null });
    }
    await expect(registerPasskey(request, "label")).rejects.toThrow(message);
  });

  it("authenticates a passkey and posts the assertion", async () => {
    const credentials = installWebAuthn();
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          challenge: "AQI",
          allowCredentials: [{ id: "AwQ", type: "public-key", transports: ["internal"] }],
        },
      })
      .mockResolvedValueOnce({ status: 204, data: { ok: true } });
    credentials.get.mockResolvedValue({
      id: "credential-id",
      type: "public-key",
      rawId: new Uint8Array([5]).buffer,
      response: {
        authenticatorData: new Uint8Array([6]).buffer,
        clientDataJSON: new Uint8Array([7]).buffer,
        signature: new Uint8Array([8]).buffer,
        userHandle: new Uint8Array([9]).buffer,
      },
      getClientExtensionResults: () => ({}),
      authenticatorAttachment: "cross-platform",
    });

    await expect(authenticatePasskey(request, { mediation: "optional" })).resolves.toEqual({
      status: 204,
      data: { ok: true },
    });
    expect(credentials.get).toHaveBeenCalledWith({
      mediation: "optional",
      signal: undefined,
      publicKey: expect.objectContaining({
        challenge: expect.any(ArrayBuffer),
        allowCredentials: [
          { id: expect.any(ArrayBuffer), type: "public-key", transports: ["internal"] },
        ],
      }),
    });
    expect(request).toHaveBeenLastCalledWith(
      "/login/webauthn",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"userHandle":"CQ"'),
      }),
    );
  });

  it("covers authentication failures and conditional mediation support", async () => {
    installWebAuthn();
    const request = jest.fn().mockResolvedValue({ status: 400, data: null });
    await expect(authenticatePasskey(request)).rejects.toThrow(
      "Passkey options could not be loaded",
    );

    const credentials = installWebAuthn();
    request.mockResolvedValue({ status: 200, data: { challenge: "AQI" } });
    credentials.get.mockResolvedValue(null);
    await expect(authenticatePasskey(request)).rejects.toThrow("No passkey was selected");

    expect(await supportsConditionalMediation()).toBe(false);
    class ConditionalPublicKeyCredential {
      static isConditionalMediationAvailable = jest.fn().mockResolvedValue(true);
    }
    installWebAuthn(ConditionalPublicKeyCredential);
    expect(await supportsConditionalMediation()).toBe(true);
    expect(ConditionalPublicKeyCredential.isConditionalMediationAvailable).toHaveBeenCalled();
  });
});
