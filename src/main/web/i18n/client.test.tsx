import { act, render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import type { ReactNode } from "react";

import { StoreProvider } from "@/store/StoreProvider";
import { ClientI18nProvider, useDictionary, useLocale } from "./client";

const mockIsDesktopRuntime = jest.fn(() => false);

jest.mock("next-i18next/client", () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/lib/desktop-api", () => ({ isDesktopRuntime: () => mockIsDesktopRuntime() }));

function LocaleProbe() {
  const locale = useLocale();
  const dictionary = useDictionary();
  return <output>{`${locale}:${dictionary.home.title}`}</output>;
}

function renderProvider() {
  return render(
    <StoreProvider>
      <ClientI18nProvider>
        <LocaleProbe />
      </ClientI18nProvider>
    </StoreProvider>,
  );
}

beforeEach(() => {
  mockIsDesktopRuntime.mockReturnValue(false);
  document.cookie = "locale=en; Path=/";
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock;
});

afterEach(() => {
  delete (window as Window & { desktopApi?: unknown }).desktopApi;
  document.cookie = "locale=; Max-Age=0; Path=/";
});

it("uses the configured cookie locale, persists it, and loads server overrides", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ "home.title": "Server title" }),
  }) as jest.Mock;

  renderProvider();

  await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  expect(screen.getByText(/en:/)).toBeVisible();
  expect(document.cookie).toContain("locale=en");
  expect(global.fetch).toHaveBeenCalledTimes(8);
  expect(i18next.getResource("tr", "common", "home.title")).toBe("Server title");
});

it("uses system language in the desktop runtime and cleans up pending overrides", async () => {
  mockIsDesktopRuntime.mockReturnValue(true);
  window.localStorage.setItem("KITEZH_DESKTOP_LANGUAGE_MODE", "system");
  let changeLanguage: ((locale: "en" | "tr") => void) | undefined;
  const cleanupLanguage = jest.fn();
  const onLanguageChange = jest.fn((listener: (locale: "en" | "tr") => void) => {
    changeLanguage = listener;
    return cleanupLanguage;
  });
  window.desktopApi = {
    language: {
      get: jest.fn().mockResolvedValue("tr"),
      onChanged: onLanguageChange,
    },
  } as never;
  let resolveOverride: ((value: { ok: boolean; json: () => Promise<object> }) => void) | undefined;
  global.fetch = jest.fn(() => new Promise((resolve) => (resolveOverride = resolve))) as jest.Mock;

  const view = renderProvider();

  await waitFor(() => expect(onLanguageChange).toHaveBeenCalledWith(expect.any(Function)));
  await waitFor(() => expect(document.documentElement.lang).toBe("tr"));
  act(() => changeLanguage?.("en"));
  await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  view.unmount();
  expect(cleanupLanguage).toHaveBeenCalled();
  await waitFor(() => expect(resolveOverride).toBeDefined());
  resolveOverride?.({ ok: true, json: async () => ({ "home.title": "Late title" }) });
  await Promise.resolve();
  expect(i18next.getResource("tr", "common", "home.title")).not.toBe("Late title");
});

it("keeps bundled translations when the override request rejects", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as jest.Mock;
  renderProvider();

  expect(await screen.findByText(/en:/)).toBeVisible();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(8));
});
