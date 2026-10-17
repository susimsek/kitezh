import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@kitezh/shared/web-messages/en";

jest.mock("@/routing/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("./RegistrationCaptcha", () => ({
  RegistrationCaptcha: ({
    onReady,
    onTokenChange,
    onError,
  }: {
    onReady: (getToken: (() => Promise<string | null>) | null) => void;
    onTokenChange: (token: string | null) => void;
    onError: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onReady(async () => null)}>
        Prepare CAPTCHA
      </button>
      <button type="button" onClick={onError}>
        Fail CAPTCHA
      </button>
      <button
        type="button"
        onClick={() => {
          onTokenChange("verified-token");
          onReady(async () => "verified-token");
        }}
      >
        Solve CAPTCHA
      </button>
    </div>
  ),
}));

import { LoginForm } from "./LoginForm";

describe("LoginForm CAPTCHA coverage", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("login-captcha")
            ? {
                enabled: true,
                provider: "recaptcha",
                siteKey: "site-key",
                action: "login",
                recaptchaV3: true,
                useRecaptchaNet: false,
              }
            : {},
      } as Response;
    }) as unknown as typeof fetch;
  });

  it("handles unavailable CAPTCHA, missing token, and successful token submission", async () => {
    const submit = jest
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);
    render(<LoginForm dictionary={dictionary} />);

    fireEvent.click(await screen.findByRole("button", { name: "Fail CAPTCHA" }));
    expect(await screen.findByText(dictionary.login.captchaUnavailable)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Prepare CAPTCHA" }));
    fireEvent.change(screen.getByLabelText(dictionary.login.username), {
      target: { value: "ada" },
    });
    fireEvent.change(screen.getByLabelText(dictionary.login.password), {
      target: { value: "secret" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: dictionary.login.submit }).closest("form")!,
    );
    expect(await screen.findAllByText(dictionary.login.captchaRequired)).toHaveLength(2);
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Solve CAPTCHA" }));
    expect(screen.queryByText(dictionary.login.captchaUnavailable)).not.toBeInTheDocument();
    fireEvent.submit(
      screen.getByRole("button", { name: dictionary.login.submit }).closest("form")!,
    );
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(screen.getByDisplayValue("verified-token")).toHaveAttribute("name", "captchaToken");
    submit.mockRestore();
  });
});
