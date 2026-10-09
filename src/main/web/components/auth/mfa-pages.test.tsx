import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import { MfaChallengePage } from "./MfaChallengePage";
import { RequiredActionsPage } from "./RequiredActionsPage";

const mockRegisterPasskey = jest.fn();
const mockAuthenticatePasskey = jest.fn();
jest.mock("@/lib/webauthn", () => {
  const actual = jest.requireActual("@/lib/webauthn");
  return {
    ...actual,
    authenticatePasskey: (...args: unknown[]) => mockAuthenticatePasskey(...args),
    registerPasskey: (...args: unknown[]) => mockRegisterPasskey(...args),
  };
});

const navigation = { searchParams: new URLSearchParams() };

jest.mock("@/routing/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
}));

const fetchMock = jest.fn();

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("MFA authentication pages", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockAuthenticatePasskey.mockReset();
    mockRegisterPasskey.mockReset();
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
    navigation.searchParams = new URLSearchParams();
  });

  it("rejects a malformed setup code without calling the completion endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "CONFIGURE_TOTP",
            displayName: "Configure authenticator app",
            description: "Register an authenticator app and verify a code.",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(
        response(200, {
          secret: "SECRET",
          qrCode: "data:image/png;base64,iVBORw0KGgo=",
          algorithm: "SHA1",
          digits: 6,
          periodSeconds: 30,
        }),
      );

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(
      await screen.findByRole("img", { name: dictionary.requiredActions.totpQrTitle }),
    ).toBeVisible();
    const input = await screen.findByLabelText(dictionary.requiredActions.totpCode);
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText(dictionary.requiredActions.invalidCode)).toBeVisible();
    expect(input).toHaveClass("is-invalid");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a rejected setup code on the field and keeps the form available for retry", async () => {
    const serverMessage = "Authenticator code is invalid.";
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "CONFIGURE_TOTP",
            displayName: "Configure authenticator app",
            description: "Register an authenticator app and verify a code.",
            version: 1,
          },
        ]),
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
      .mockResolvedValueOnce(response(400, { detail: serverMessage }));

    render(<RequiredActionsPage dictionary={dictionary} />);

    const input = await screen.findByLabelText(dictionary.requiredActions.totpCode);
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText(serverMessage)).toBeVisible();
    expect(input).toHaveClass("is-invalid");
    expect(input).toHaveValue("000000");
    expect(screen.getByRole("button", { name: dictionary.requiredActions.continue })).toBeEnabled();
  });

  it("requires saving recovery codes before submitting the required action", async () => {
    const serverMessage = "Save the recovery codes before completing this action";
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "RECOVERY_CODES",
            displayName: "Set up recovery codes",
            description: "Generate and save recovery codes.",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(
        response(200, {
          codes: ["ABCD-EFGH-IJKL", "MNOP-QRST-UVWX"],
          remaining: 2,
        }),
      )
      .mockResolvedValueOnce(response(400, { detail: serverMessage }));

    render(<RequiredActionsPage dictionary={dictionary} />);

    expect(await screen.findByText("ABCD-EFGH-IJKL")).toBeVisible();
    const continueButton = screen.getByRole("button", {
      name: dictionary.requiredActions.continue,
    });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(dictionary.requiredActions.recoverySaved));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(await screen.findByText(serverMessage)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a malformed login challenge code before sending it", async () => {
    render(<MfaChallengePage dictionary={dictionary} />);

    const input = screen.getByLabelText(dictionary.mfa.code);
    fireEvent.change(input, { target: { value: "12ab" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));

    expect(await screen.findByText(dictionary.mfa.invalidCode)).toBeVisible();
    expect(input).toHaveClass("is-invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a rejected login challenge code on the field and permits another attempt", async () => {
    const serverMessage = "The authenticator code is invalid.";
    fetchMock.mockResolvedValueOnce(response(400, { detail: serverMessage }));
    render(<MfaChallengePage dictionary={dictionary} />);

    const input = screen.getByLabelText(dictionary.mfa.code);
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));

    expect(await screen.findByText(serverMessage)).toBeVisible();
    expect(input).toHaveClass("is-invalid");
    expect(input).toHaveValue("000000");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: dictionary.mfa.verify })).toBeEnabled(),
    );
  });

  it("supports recovery codes, safe redirects, unauthorized responses, and network errors", async () => {
    navigation.searchParams = new URLSearchParams("return_to=//unsafe.example");
    fetchMock
      .mockResolvedValueOnce(response(400, undefined))
      .mockResolvedValueOnce(response(401, undefined));
    render(<MfaChallengePage dictionary={dictionary} />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.useRecoveryCode }));
    const recoveryInput = screen.getByLabelText(dictionary.mfa.recoveryCode);
    fireEvent.change(recoveryInput, { target: { value: "ABCD-EFGH-IJKL" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/mfa/recovery-code",
        expect.objectContaining({ body: JSON.stringify({ code: "ABCD-EFGH-IJKL" }) }),
      ),
    );
    expect(await screen.findByText(dictionary.mfa.invalidCode)).toBeVisible();

    fireEvent.change(recoveryInput, { target: { value: "MNOP-QRST-UVWX" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("handles successful and failed passkey authentication", async () => {
    mockAuthenticatePasskey.mockImplementationOnce(
      async (callback: (url: string, init: RequestInit) => Promise<unknown>) => {
        fetchMock.mockResolvedValueOnce(response(200));
        return callback("/api/auth/mfa/passkey", { method: "POST" });
      },
    );
    render(<MfaChallengePage dictionary={dictionary} />);
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.passkey }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/mfa/passkey",
        expect.objectContaining({ method: "POST", credentials: "same-origin" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: dictionary.mfa.passkey })).toBeEnabled(),
    );

    mockAuthenticatePasskey.mockRejectedValueOnce(new Error("not available"));
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.passkey }));
    expect(await screen.findByText(dictionary.mfa.passkeyError)).toBeVisible();
  });

  it("shows the fallback response message and catches a failed request", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new Error("invalid json")),
    } as unknown as Response);
    render(<MfaChallengePage dictionary={dictionary} />);
    const input = screen.getByLabelText(dictionary.mfa.code);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));
    expect(await screen.findByText(dictionary.mfa.invalidCode)).toBeVisible();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fireEvent.change(input, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.mfa.verify }));
    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.mfa.invalidCode);
  });

  it("renders profile and password required actions and reports completion failures", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "UPDATE_PROFILE",
            displayName: "Update profile",
            description: "Profile",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(response(500, { detail: "Profile save failed" }));
    const profileView = render(<RequiredActionsPage dictionary={dictionary} />);
    await screen.findByText("Update profile");
    const firstName = document.querySelector('input[name="firstName"]')!;
    fireEvent.change(firstName, { target: { value: "Admin" } });
    fireEvent.change(document.querySelector('input[name="lastName"]')!, {
      target: { value: "User" },
    });
    fireEvent.change(document.querySelector('input[name="email"]')!, {
      target: { value: "admin@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.requiredActions.continue }));
    expect(await screen.findByText("Profile save failed")).toBeVisible();

    profileView.unmount();
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "UPDATE_PASSWORD",
            displayName: "Update password",
            description: "Password",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(response(500, { detail: "Password save failed" }));
    render(<RequiredActionsPage dictionary={dictionary} />);
    const password = await screen.findByLabelText(dictionary.requiredActions.password);
    fireEvent.change(password, { target: { value: "StrongPassword1!" } });
    fireEvent.change(screen.getByLabelText(dictionary.requiredActions.confirmPassword), {
      target: { value: "StrongPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.requiredActions.continue }));
    expect(await screen.findByText("Password save failed")).toBeVisible();
  });

  it("renders email-pending and generic required-action branches", async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, [
        { key: "UPDATE_EMAIL", displayName: "Update email", description: "Email", version: 1 },
      ]),
    );
    const emailView = render(<RequiredActionsPage dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.requiredActions.emailPending)).toBeVisible();

    emailView.unmount();
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          { key: "VERIFY_EMAIL", displayName: "Verify email", description: "Verify", version: 2 },
        ]),
      )
      .mockResolvedValueOnce(response(500, { detail: "Verification failed" }));
    render(<RequiredActionsPage dictionary={dictionary} />);
    fireEvent.click(await screen.findByRole("button", { name: dictionary.requiredActions.accept }));
    expect(await screen.findByText("Verification failed")).toBeVisible();
  });

  it("renders passkey required action and surfaces registration errors", async () => {
    mockRegisterPasskey.mockRejectedValueOnce(new Error("Passkey unavailable"));
    fetchMock.mockResolvedValueOnce(
      response(200, [
        {
          key: "CONFIGURE_PASSKEY",
          displayName: "Register passkey",
          description: "Passkey",
          version: 1,
        },
      ]),
    );
    render(<RequiredActionsPage dictionary={dictionary} />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.requiredActions.passkeyRegister }),
    );
    expect(await screen.findByText("Passkey unavailable")).toBeVisible();
  });

  it("shows the fatal error when required actions cannot be loaded", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<RequiredActionsPage dictionary={dictionary} />);
    expect(await screen.findByText(dictionary.requiredActions.error)).toBeVisible();
  });

  it("shows setup errors and validates the configured TOTP digit count", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "CONFIGURE_TOTP",
            displayName: "Configure authenticator app",
            description: "Register an authenticator app and verify a code.",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(response(500, { detail: "Setup unavailable" }));
    render(<RequiredActionsPage dictionary={dictionary} />);
    expect(await screen.findByText("Setup unavailable")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("completes a passkey action after registration and reports completion failures", async () => {
    mockRegisterPasskey.mockImplementationOnce(
      async (callback: (url: string, init: RequestInit) => Promise<unknown>) => {
        fetchMock.mockResolvedValueOnce(response(200, { id: "credential" }));
        return callback("/api/auth/passkey/register", { method: "POST" });
      },
    );
    fetchMock
      .mockResolvedValueOnce(
        response(200, [
          {
            key: "CONFIGURE_PASSKEY",
            displayName: "Register passkey",
            description: "Passkey",
            version: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(response(201, {}));
    render(<RequiredActionsPage dictionary={dictionary} />);
    fireEvent.click(
      await screen.findByRole("button", { name: dictionary.requiredActions.passkeyRegister }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(dictionary.requiredActions.error)).not.toBeInTheDocument();
  });

  it("reports password policy validation details before submitting", async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, [
        {
          key: "UPDATE_PASSWORD",
          displayName: "Update password",
          description: "Password",
          version: 1,
        },
      ]),
    );
    render(<RequiredActionsPage dictionary={dictionary} />);
    const password = await screen.findByLabelText(dictionary.requiredActions.password);
    fireEvent.change(password, { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText(dictionary.requiredActions.confirmPassword), {
      target: { value: "xyz" },
    });
    fireEvent.click(screen.getByRole("button", { name: dictionary.requiredActions.continue }));
    expect(await screen.findByText(/Missing requirements/)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
