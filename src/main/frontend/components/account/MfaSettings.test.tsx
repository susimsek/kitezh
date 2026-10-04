import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import { MfaSettings } from "./MfaSettings";

const clearLocalSession = jest.fn();

jest.mock("./AccountAuthProvider", () => ({
  useAccountAuth: () => ({ accessToken: "access-token", clearLocalSession }),
}));

const fetchMock = jest.fn();

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("MFA account settings", () => {
  beforeEach(() => {
    clearLocalSession.mockReset();
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
  });

  it("shows invalid codes on the field, permits retry, and clears invalidated login state", async () => {
    const serverMessage = "The authenticator code is invalid.";
    fetchMock
      .mockResolvedValueOnce(
        response(200, {
          enabled: false,
          available: true,
          required: false,
          issuer: "Kitezh",
          digits: 6,
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          secret: "SECRET",
          qrCode: "data:image/png;base64,iVBORw0KGgo=",
          algorithm: "SHA1",
          digits: 6,
          periodSeconds: 30,
        }),
      )
      .mockResolvedValueOnce(response(400, { detail: serverMessage }))
      .mockResolvedValueOnce(response(204));

    render(<MfaSettings dictionary={dictionary} />);

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.account.security.mfa.setup }),
    );
    expect(
      await screen.findByRole("img", { name: dictionary.account.security.mfa.qrTitle }),
    ).toBeVisible();
    const input = await screen.findByPlaceholderText(dictionary.account.security.mfa.code);
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.enable }));

    expect(await screen.findByText(serverMessage)).toBeVisible();
    expect(input).toHaveClass("is-invalid");

    fireEvent.change(input, { target: { value: "123456" } });
    expect(screen.queryByText(serverMessage)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.enable }));

    await waitFor(() => expect(clearLocalSession).toHaveBeenCalledTimes(1));
  });

  it("checks the configured code length before sending an enable request", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, {
          enabled: false,
          available: true,
          required: false,
          issuer: "Kitezh",
          digits: 8,
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          secret: "SECRET",
          qrCode: "data:image/png;base64,iVBORw0KGgo=",
          digits: 8,
        }),
      );

    render(<MfaSettings dictionary={dictionary} />);

    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.account.security.mfa.setup }),
    );
    const input = await screen.findByPlaceholderText(dictionary.account.security.mfa.code);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.enable }));

    expect(await screen.findByText(dictionary.account.security.mfa.invalidCode)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles enabled MFA recovery codes, invalid disable codes, and successful disable", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, {
          enabled: true,
          available: true,
          required: true,
          issuer: "Kitezh",
          digits: 6,
        }),
      )
      .mockResolvedValueOnce(response(200, { remaining: 1, warningThreshold: 3 }))
      .mockResolvedValueOnce(response(200, { codes: ["ABCD-1234"], remaining: 0 }))
      .mockResolvedValueOnce(response(400, { detail: "Invalid authenticator code" }))
      .mockResolvedValueOnce(response(204));

    render(<MfaSettings dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.account.security.mfa.enabled)).toBeVisible();
    expect(
      screen.getByText(dictionary.account.security.mfa.recoveryWarning.replace("{{count}}", "1")),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.account.security.mfa.recoveryGenerate }),
    );
    expect(await screen.findByText("ABCD-1234")).toBeVisible();

    const input = screen.getByPlaceholderText(dictionary.account.security.mfa.code);
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.disable }));
    expect(await screen.findByText(dictionary.account.security.mfa.invalidCode)).toBeVisible();
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.disable }));
    expect(await screen.findByText("Invalid authenticator code")).toBeVisible();
    fireEvent.change(input, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.account.security.mfa.disable }));
    await waitFor(() => expect(clearLocalSession).toHaveBeenCalledTimes(1));
  });
});
