import { accountActionError, submitAccountAction } from "./account-actions-api";

import dictionary from "@/locales/en/common.json";

describe("account action API", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("submits JSON actions and resolves successful responses", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await expect(submitAccountAction("register", { username: "user" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "user" }),
    });
  });

  it("propagates JSON problem details and fallback errors", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errorCode: "action_token_expired" }),
    } as unknown as Response);
    await expect(submitAccountAction("verify-email", { token: "expired" })).rejects.toEqual({
      errorCode: "action_token_expired",
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error("not JSON");
      },
    } as unknown as Response);
    await expect(submitAccountAction("forgot-password", {})).rejects.toEqual(
      new Error("Account action failed"),
    );
  });

  it.each([
    ["user_duplicate_username", dictionary.registration.validation.usernameDuplicate],
    ["user_duplicate_email", dictionary.registration.validation.emailDuplicate],
    ["password_mismatch", dictionary.registration.validation.passwordMismatch],
    ["action_email_unavailable", dictionary.accountActions.mailUnavailable],
    ["action_email_required", dictionary.accountActions.mailRequired],
    ["action_email_cooldown", dictionary.accountActions.cooldown],
    ["action_token_invalid", dictionary.accountActions.invalidLink],
    ["action_token_expired", dictionary.accountActions.invalidLink],
    ["action_token_used", dictionary.accountActions.invalidLink],
    ["unknown", dictionary.accountActions.operationError],
  ])("maps %s problem codes", (code, expected) => {
    expect(accountActionError({ errorCode: code }, dictionary)).toBe(expected);
  });

  it("prefers a server field violation message", () => {
    expect(
      accountActionError(
        { violations: [{ field: "email", message: "Email is already used" }] },
        dictionary,
      ),
    ).toBe("Email is already used");
  });
});
