import { act, render, screen, waitFor } from "@testing-library/react";

import { RegistrationCaptcha, type RegistrationCaptchaSettings } from "./RegistrationCaptcha";

const settings: RegistrationCaptchaSettings = {
  enabled: true,
  provider: "recaptcha",
  siteKey: "site-key",
  action: "register",
  recaptchaV3: false,
  useRecaptchaNet: false,
};

function loadCaptchaScript(locale: string) {
  const script = document.querySelector<HTMLScriptElement>(`script[src*='hl=${locale}']`);
  if (!script) throw new Error("CAPTCHA script was not appended");
  act(() => script.dispatchEvent(new Event("load")));
}

describe("RegistrationCaptcha", () => {
  beforeEach(() => {
    delete window.grecaptcha;
  });

  afterEach(() => {
    delete window.grecaptcha;
  });

  it("renders the v2 widget, forwards token lifecycle callbacks, and resets it", async () => {
    let widgetOptions:
      | {
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      | undefined;
    const reset = jest.fn();
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: jest.fn().mockResolvedValue("v3-token"),
      render: (_container, options) => {
        widgetOptions = options;
        return 17;
      },
      reset,
    };
    const onTokenChange = jest.fn();
    const onReady = jest.fn();
    const onError = jest.fn();
    const { unmount } = render(
      <RegistrationCaptcha
        settings={{ ...settings, siteKey: "v2-site-key" }}
        locale="en-v2"
        label="CAPTCHA"
        onTokenChange={onTokenChange}
        onReady={onReady}
        onError={onError}
      />,
    );

    expect(screen.getByLabelText("CAPTCHA")).toBeVisible();
    loadCaptchaScript("en-v2");
    await waitFor(() => expect(widgetOptions).toBeDefined());
    act(() => widgetOptions?.callback("verified-token"));
    expect(onTokenChange).toHaveBeenLastCalledWith("verified-token");
    expect(screen.getByLabelText("CAPTCHA")).toHaveClass("d-none");
    act(() => widgetOptions?.["expired-callback"]());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText("CAPTCHA")).not.toHaveClass("d-none");
    act(() => widgetOptions?.["error-callback"]());
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
    expect(reset).toHaveBeenCalledWith(17);
    expect(onReady).toHaveBeenLastCalledWith(null);
  });

  it("executes the v3 API when requested and handles missing APIs and script failures", async () => {
    const readyCallbacks: Array<() => void> = [];
    const execute = jest.fn().mockResolvedValue("score-token");
    window.grecaptcha = {
      ready: (callback) => readyCallbacks.push(callback),
      execute,
    };
    const onTokenChange = jest.fn();
    const onReady = jest.fn();
    const onError = jest.fn();
    const { unmount } = render(
      <RegistrationCaptcha
        settings={{ ...settings, siteKey: "v3-site-key", recaptchaV3: true, useRecaptchaNet: true }}
        locale="tr-v3"
        label="Score verification"
        onTokenChange={onTokenChange}
        onReady={onReady}
        onError={onError}
      />,
    );
    loadCaptchaScript("tr-v3");
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(expect.any(Function)));

    let token: string | null = null;
    await act(async () => {
      const result = onReady.mock.calls.at(-1)?.[0];
      const tokenPromise = result?.();
      readyCallbacks[0]?.();
      token = (await tokenPromise) ?? null;
    });
    expect(execute).toHaveBeenCalledWith("v3-site-key", { action: "register" });
    expect(token).toBe("score-token");
    expect(onTokenChange).toHaveBeenLastCalledWith("score-token");
    unmount();

    render(
      <RegistrationCaptcha
        settings={{ ...settings, siteKey: "missing-api-site" }}
        locale="missing-api"
        label="CAPTCHA unavailable"
        onTokenChange={onTokenChange}
        onReady={onReady}
        onError={onError}
      />,
    );
    delete window.grecaptcha;
    loadCaptchaScript("missing-api");
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    render(
      <RegistrationCaptcha
        settings={{ ...settings, siteKey: "failed-script-site" }}
        locale="failed-script"
        label="CAPTCHA load failure"
        onTokenChange={onTokenChange}
        onReady={onReady}
        onError={onError}
      />,
    );
    const failedScript = document.querySelector<HTMLScriptElement>("script[src*='failed-script']");
    if (!failedScript) throw new Error("CAPTCHA script was not appended");
    act(() => failedScript.dispatchEvent(new Event("error")));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
  });

  it("does not load CAPTCHA scripts when disabled", () => {
    const { container } = render(
      <RegistrationCaptcha
        settings={{ ...settings, enabled: false }}
        locale="en-disabled"
        label="CAPTCHA"
        onTokenChange={jest.fn()}
        onReady={jest.fn()}
        onError={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector("script[src*='hl=en-disabled']")).toBeNull();
  });
});
