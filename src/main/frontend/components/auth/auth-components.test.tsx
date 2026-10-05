import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

import dictionary from "@/locales/en/common.json";
import { StoreProvider } from "@/store/StoreProvider";

const navigation = {
  pathname: "/login",
  push: jest.fn(),
  searchParams: new URLSearchParams(),
};

jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));

jest.mock("axios", () => {
  const client = {
    interceptors: { response: { use: jest.fn() } },
    request: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => client),
      get: jest.fn(),
      isCancel: jest.fn(),
    },
  };
});

import { AuthLayout } from "./AuthLayout";
import { ConsentForm } from "./ConsentForm";
import { ErrorView } from "./ErrorView";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LoginForm } from "./LoginForm";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemeManager } from "./ThemeManager";
import { ThemeSwitcher } from "./ThemeSwitcher";

const mockedAxios = axios as unknown as { get: jest.Mock; isCancel: jest.Mock };
const mockAuthenticatePasskey = jest.fn();
const mockSupportsConditionalMediation = jest.fn();

jest.mock("@/lib/webauthn", () => ({
  authenticatePasskey: (...args: unknown[]) => mockAuthenticatePasskey(...args),
  supportsConditionalMediation: (...args: unknown[]) => mockSupportsConditionalMediation(...args),
}));

const consent = {
  clientId: "console-client",
  state: "request-state",
  scopes: ["openid", "custom.scope"],
  previouslyApprovedScopes: ["profile"],
  principalName: "admin",
  userCode: "user-code",
  requestUri: "/oauth2/authorize",
};

function installMatchMedia(matches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    addEventListener: jest.fn((_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: jest.fn((_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatch(nextMatches: boolean) {
      Object.assign(mediaQuery, { matches: nextMatches });
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn(() => mediaQuery),
  });
  return mediaQuery;
}

describe("authentication components", () => {
  beforeEach(() => {
    navigation.pathname = "/login";
    navigation.searchParams = new URLSearchParams();
    navigation.push.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.isCancel.mockReset();
    window.history.replaceState(null, "", "/login");
    localStorage.clear();
    document.documentElement.removeAttribute("data-bs-theme");
    installMatchMedia();
    mockAuthenticatePasskey.mockReset();
    mockSupportsConditionalMediation.mockReset();
  });

  it("renders the layout, navbar, and login feedback", () => {
    navigation.searchParams = new URLSearchParams("error&logout");

    render(
      <StoreProvider>
        <AuthLayout locale="en" dictionary={dictionary}>
          <LoginForm dictionary={dictionary} />
        </AuthLayout>
      </StoreProvider>,
    );

    expect(screen.getByRole("link", { name: dictionary.brand.product })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText(dictionary.login.invalidCredentials)).toBeVisible();
    expect(screen.getByText(dictionary.login.loggedOut)).toBeVisible();
    expect(screen.getByRole("button", { name: dictionary.navbar.language })).toBeVisible();
    expect(screen.getByRole("button", { name: dictionary.theme.label })).toBeVisible();
  });

  it("renders configured social providers and prevents duplicate submissions", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("social-providers")
            ? [
                { provider: "google", providerType: "google", configured: true },
                { provider: "github", providerType: "github", configured: true },
                { provider: "microsoft", providerType: "microsoft", configured: false },
              ]
            : {},
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<LoginForm dictionary={dictionary} />);

    const google = await screen.findByRole("button", {
      name: `${dictionary.login.socialLogin} Google`,
    });
    const github = screen.getByRole("button", {
      name: `${dictionary.login.socialLogin} GitHub`,
    });
    const microsoft = screen.getByRole("button", {
      name: `${dictionary.login.socialLogin} Microsoft`,
    });
    expect(google).toHaveClass("social-login-button");
    expect(github).toHaveClass("social-login-button");
    expect(microsoft).toHaveClass("social-login-button");
    expect(microsoft).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(google);

    expect(google).toHaveAttribute("aria-disabled", "true");
    expect(github).toHaveAttribute("aria-disabled", "true");
    expect(google.querySelector(".spinner-border")).not.toBeNull();

    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("uses a configured alias for the redirect while retaining the provider type", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("social-providers")
            ? [{ provider: "acme-google", providerType: "google", configured: true }]
            : {},
      } as Response;
    }) as unknown as typeof fetch;

    render(<LoginForm dictionary={dictionary} />);

    const provider = await screen.findByRole("button", {
      name: `${dictionary.login.socialLogin} Google`,
    });
    expect(provider).toHaveAttribute("href", "/oauth2/authorization/acme-google");

    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("validates login fields and submits a valid form", async () => {
    const submit = jest
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);
    render(<LoginForm dictionary={dictionary} />);

    const username = screen.getByLabelText(dictionary.login.username);
    const password = screen.getByLabelText(dictionary.login.password);
    fireEvent.blur(username);
    fireEvent.blur(password);

    const requiredMessages = await screen.findAllByText(
      dictionary.admin.common.validation.required,
    );
    expect(requiredMessages).toHaveLength(2);
    requiredMessages.forEach((message) => expect(message).toBeVisible());
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: dictionary.login.showPassword }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: dictionary.login.hidePassword })).toBeVisible();

    fireEvent.change(username, { target: { value: "admin" } });
    fireEvent.change(password, { target: { value: "password" } });
    fireEvent.submit(
      screen.getByRole("button", { name: dictionary.login.submit }).closest("form")!,
    );

    await waitFor(() => expect(submit).toHaveBeenCalled());
    submit.mockRestore();
  });

  it("loads a consent request, submits selected scopes, and shows scope validation", async () => {
    const submit = jest
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);
    mockedAxios.get.mockResolvedValueOnce({ data: consent });

    render(<ConsentForm dictionary={dictionary} />);

    expect(screen.getByRole("status")).toBeVisible();
    expect(await screen.findByText(consent.clientId)).toBeVisible();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/authorization/consent", {
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByDisplayValue("profile")).toHaveAttribute("type", "hidden");
    expect(screen.getAllByDisplayValue("user-code")).toHaveLength(2);
    expect(screen.getAllByDisplayValue("user-code")[0]).toHaveAttribute("type", "hidden");
    expect(screen.getByText(dictionary.consent.scopeDescriptions.openid)).toBeVisible();
    expect(screen.getByText(dictionary.consent.scopeDefault)).toBeVisible();

    fireEvent.click(screen.getByLabelText("openid"));
    fireEvent.click(screen.getByLabelText("custom.scope"));
    expect(await screen.findByText(dictionary.consent.scopeRequired)).toBeVisible();

    fireEvent.click(screen.getByLabelText("openid"));
    fireEvent.submit(
      screen.getByRole("button", { name: dictionary.consent.submit }).closest("form")!,
    );
    await waitFor(() => expect(submit).toHaveBeenCalled());
    submit.mockRestore();
  });

  it("handles consent request failures and ignores cancellation", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("invalid request"));
    mockedAxios.isCancel.mockReturnValue(false);
    navigation.pathname = "/consent";
    render(<ConsentForm dictionary={dictionary} />);

    expect(await screen.findByText(dictionary.consent.invalidRequest)).toBeVisible();

    mockedAxios.get.mockRejectedValueOnce(new Error("aborted"));
    mockedAxios.isCancel.mockReturnValue(true);
    const { container } = render(<ConsentForm dictionary={dictionary} />);
    await waitFor(() => expect(mockedAxios.isCancel).toHaveBeenCalled());
    expect(container).toHaveTextContent("Loading");
  });

  it("uses requested error messages and falls back to server errors", () => {
    navigation.searchParams = new URLSearchParams("type=invalid_scope");
    const { rerender } = render(<ErrorView dictionary={dictionary} />);
    expect(screen.getByText(dictionary.error.types.invalid_scope.title)).toBeVisible();

    navigation.searchParams = new URLSearchParams("type=unknown");
    rerender(<ErrorView dictionary={dictionary} />);
    expect(screen.getByText(dictionary.error.types.server_error.title)).toBeVisible();

    navigation.searchParams = new URLSearchParams();
    rerender(<ErrorView dictionary={dictionary} />);
    expect(screen.getByText(dictionary.error.types.server_error.description)).toBeVisible();
  });

  it("switches language without navigating or changing the URL", () => {
    window.history.replaceState(null, "", "/admin/users/123?tab=details#profile");
    render(<LanguageSwitcher locale="en" label={dictionary.navbar.language} />);
    fireEvent.click(screen.getByRole("button", { name: dictionary.navbar.language }));
    fireEvent.click(screen.getByRole("button", { name: "Türkçe" }));
    expect(document.cookie).toContain("locale=tr");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/admin/users/123?tab=details#profile",
    );
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: dictionary.navbar.language }));
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("locale=en");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("loads supported locales and persists the authenticated preference", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/localization/me") && init?.method === "PUT") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url.endsWith("/localization/me")) {
        return { ok: true, json: async () => ({ locale: "tr" }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          internationalizationEnabled: false,
          defaultLocale: "tr",
          supportedLocales: ["tr"],
        }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<LanguageSwitcher locale="en" label={dictionary.navbar.language} accessToken="token" />);

    fireEvent.click(screen.getByRole("button", { name: dictionary.navbar.language }));
    expect(await screen.findByRole("button", { name: "Türkçe" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Türkçe" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/localization/me",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("shows the passkey login error when the browser authentication fails", async () => {
    mockSupportsConditionalMediation.mockResolvedValue(false);
    mockAuthenticatePasskey.mockRejectedValue(new Error("not available"));
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("login-settings") ? { passkeys: true, webauthnMediation: "none" } : [],
      } as Response;
    }) as unknown as typeof fetch;

    render(<LoginForm dictionary={dictionary} />);
    const passkey = await screen.findByRole("button", { name: dictionary.login.passkey });
    fireEvent.click(passkey);
    expect(await screen.findByText(dictionary.login.passkeyError)).toBeVisible();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("hides optional login features and normalizes mixed social-provider responses", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("login-settings")) {
        return {
          ok: true,
          json: async () => ({
            userRegistration: false,
            forgotPassword: false,
            rememberMe: false,
            passkeys: false,
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => [
          "github",
          { provider: "acme", configured: true },
          { provider: "", configured: true },
          { invalid: true },
        ],
      } as Response;
    }) as unknown as typeof fetch;

    render(<LoginForm dictionary={dictionary} />);

    expect(
      await screen.findByRole("button", {
        name: `${dictionary.login.socialLogin} GitHub`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: `${dictionary.login.socialLogin} acme` }),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: dictionary.login.register })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: dictionary.login.forgotPassword }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(dictionary.login.rememberMe)).not.toBeInTheDocument();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("ignores unavailable login settings and social-provider endpoints", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, json: jest.fn() });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm dictionary={dictionary} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("button", { name: dictionary.login.submit })).toBeVisible();
    expect(screen.queryByText(dictionary.login.socialDivider)).not.toBeInTheDocument();
    delete (globalThis as { fetch?: typeof fetch }).fetch;

    const rejectedFetch = jest.fn().mockRejectedValue(new Error("offline"));
    globalThis.fetch = rejectedFetch as unknown as typeof fetch;
    render(<LoginForm dictionary={dictionary} />);
    await waitFor(() => expect(rejectedFetch).toHaveBeenCalledTimes(3));
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("starts conditional passkey mediation without surfacing automatic failures", async () => {
    mockSupportsConditionalMediation.mockResolvedValue(true);
    mockAuthenticatePasskey.mockRejectedValue(new Error("conditional unavailable"));
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () =>
          url.includes("login-settings")
            ? { passkeys: true, webauthnMediation: "conditional" }
            : [],
      } as Response;
    }) as unknown as typeof fetch;
    render(<LoginForm dictionary={dictionary} />);
    await waitFor(() => expect(mockSupportsConditionalMediation).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockAuthenticatePasskey).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ mediation: "conditional" }),
      ),
    );
    expect(screen.queryByText(dictionary.login.passkeyError)).not.toBeInTheDocument();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("persists themes, applies system preferences, and cleans up media subscriptions", () => {
    const mediaQuery = installMatchMedia(false);
    const { unmount } = render(
      <StoreProvider>
        <ThemeManager />
        <ThemeSwitcher dictionary={dictionary} />
      </StoreProvider>,
    );
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "light");

    fireEvent.click(screen.getByRole("button", { name: dictionary.theme.label }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.theme.dark }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "dark");

    act(() => window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY })));
    fireEvent.click(screen.getByRole("button", { name: dictionary.theme.label }));
    fireEvent.click(screen.getByRole("button", { name: dictionary.theme.system }));
    act(() => mediaQuery.dispatch(true));
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "dark");

    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
