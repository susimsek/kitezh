import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { DESKTOP_LANGUAGE_MODE_KEY } from "@/i18n/locale-cookie";
import { isDesktopRuntime } from "@/lib/desktop-api";

import { DesktopSettings } from "./DesktopSettings";
import { THEME_STORAGE_KEY } from "../auth/theme";

const mockDispatch = jest.fn();
const mockChangeLanguage = jest.fn();
let mockTheme = "system";

jest.mock("@/lib/desktop-api", () => ({ isDesktopRuntime: jest.fn() }));
jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
  useLocale: () => "en",
}));
jest.mock("@/i18n/locale-cookie", () => ({
  DESKTOP_LANGUAGE_MODE_KEY: "KITEZH_DESKTOP_LANGUAGE_MODE",
  detectLocale: (_cookie: string, languages: string[]) =>
    languages.some((language) => language.toLowerCase().startsWith("tr")) ? "tr" : "en",
  persistLocale: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { changeLanguage: mockChangeLanguage } }),
}));
jest.mock("@/store/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ theme: { value: mockTheme } }),
}));
jest.mock("@/components/shared/Icon", () => ({ Icon: () => <span aria-hidden="true" /> }));
jest.mock("./ActionIcon", () => ({ ActionIcon: () => <span aria-hidden="true" /> }));

const preferences = {
  launchAtLogin: false,
  showInMenuBar: true,
  showInDock: true,
  notifications: true,
  globalShortcut: "CommandOrControl+Shift+K",
  automaticDownload: false,
};

const diagnostics = {
  appVersion: "1.2.3",
  electronVersion: "40.0.0",
  chromeVersion: "140.0.0",
  nodeVersion: "24.0.0",
  platform: "darwin",
  architecture: "arm64",
  apiHost: "https://kitezh.example",
  packaged: true,
  secureStorage: "available" as const,
  autoUpdatesSupported: true,
  events: ["App started", "Session restored"],
};

const mockApi = {
  settings: { ready: jest.fn() },
  preferences: {
    get: jest.fn(),
    set: jest.fn(),
    reset: jest.fn(),
  },
  diagnostics: { get: jest.fn() },
  language: { set: jest.fn() },
};

function attachDesktopApi() {
  Object.defineProperty(window, "desktopApi", {
    configurable: true,
    value: mockApi,
  });
  (isDesktopRuntime as jest.Mock).mockReturnValue(true);
}

describe("DesktopSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = "system";
    mockChangeLanguage.mockResolvedValue(undefined);
    localStorage.clear();
    attachDesktopApi();
    mockApi.settings.ready.mockResolvedValue(undefined);
    mockApi.preferences.get.mockResolvedValue(preferences);
    mockApi.preferences.set.mockImplementation(async (update) => ({ ...preferences, ...update }));
    mockApi.preferences.reset.mockResolvedValue(preferences);
    mockApi.diagnostics.get.mockResolvedValue(diagnostics);
  });

  afterEach(() => {
    delete (window as { desktopApi?: unknown }).desktopApi;
  });

  it("does not render outside the desktop runtime", () => {
    (isDesktopRuntime as jest.Mock).mockReturnValue(false);

    const { container } = render(<DesktopSettings />);

    expect(container).toBeEmptyDOMElement();
    expect(mockApi.settings.ready).not.toHaveBeenCalled();
  });

  it("loads preferences and diagnostics and updates general preferences", async () => {
    render(<DesktopSettings />);

    expect(
      await screen.findByRole("heading", { name: dictionary.desktop.settings.title }),
    ).toBeVisible();
    expect(mockApi.settings.ready).toHaveBeenCalledTimes(1);
    expect(mockApi.preferences.get).toHaveBeenCalledTimes(1);
    expect(mockApi.diagnostics.get).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText(dictionary.desktop.settings.showInDock)).toBeVisible();

    fireEvent.click(screen.getByLabelText(dictionary.desktop.settings.launchAtLogin));
    await waitFor(() =>
      expect(mockApi.preferences.set).toHaveBeenCalledWith({ launchAtLogin: true }),
    );
  });

  it("searches sections and reports an empty search result", async () => {
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    fireEvent.change(screen.getByRole("searchbox", { name: dictionary.desktop.settings.search }), {
      target: { value: "diagnostics" },
    });
    expect(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.diagnostics }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: dictionary.desktop.settings.sections.appearance }),
    ).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: dictionary.desktop.settings.search }), {
      target: { value: "nothing matches" },
    });
    expect(screen.getByText(dictionary.desktop.settings.noSearchResults)).toBeVisible();
  });

  it("switches notification and update preferences and shows write failures", async () => {
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.notifications }),
    );
    fireEvent.click(screen.getByLabelText(dictionary.desktop.settings.notifications));
    await waitFor(() =>
      expect(mockApi.preferences.set).toHaveBeenCalledWith({ notifications: false }),
    );

    mockApi.preferences.set.mockRejectedValueOnce(new Error("write failed"));
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.updates }),
    );
    fireEvent.click(screen.getByLabelText(dictionary.desktop.settings.automaticUpdates));
    expect(await screen.findByText(dictionary.desktop.settings.error)).toBeVisible();
  });

  it("changes theme and language, including the system language mode", async () => {
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.appearance }),
    );
    fireEvent.click(screen.getByRole("radio", { name: dictionary.theme.dark }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(mockDispatch).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.general }),
    );
    fireEvent.change(screen.getByLabelText(dictionary.desktop.settings.language), {
      target: { value: "tr" },
    });
    expect(mockApi.language.set).toHaveBeenCalledWith("tr");

    fireEvent.change(screen.getByLabelText(dictionary.desktop.settings.language), {
      target: { value: "system" },
    });
    expect(localStorage.getItem(DESKTOP_LANGUAGE_MODE_KEY)).toBe("system");
    const systemLanguage = navigator.languages.some((language) => language.startsWith("tr"))
      ? "tr"
      : "en";
    expect(mockApi.language.set).toHaveBeenLastCalledWith(systemLanguage);
  });

  it("captures modified keyboard shortcuts and ignores bare or modifier-only keys", async () => {
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    const shortcut = screen.getByLabelText(dictionary.desktop.settings.globalShortcut);
    fireEvent.focus(shortcut);
    expect(shortcut).toHaveValue(dictionary.desktop.settings.globalShortcutCapture);
    fireEvent.keyDown(shortcut, { key: "k" });
    fireEvent.keyDown(shortcut, { key: "Shift" });
    expect(mockApi.preferences.set).not.toHaveBeenCalled();
    fireEvent.keyDown(shortcut, { key: " ", ctrlKey: true, altKey: true, shiftKey: true });
    await waitFor(() =>
      expect(mockApi.preferences.set).toHaveBeenCalledWith({
        globalShortcut: "CommandOrControl+Alt+Shift+Space",
      }),
    );
  });

  it("cancels shortcut capture and resets preferences, theme, and language", async () => {
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    const shortcut = screen.getByLabelText(dictionary.desktop.settings.globalShortcut);
    fireEvent.focus(shortcut);
    fireEvent.keyDown(shortcut, { key: "Escape" });
    expect(shortcut).toHaveValue(preferences.globalShortcut);

    mockApi.preferences.reset.mockResolvedValueOnce({ ...preferences, notifications: false });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.resetDefaults }),
    );
    await waitFor(() => expect(mockApi.preferences.reset).toHaveBeenCalledTimes(1));
    expect(mockApi.language.set).toHaveBeenCalledWith("en");
    expect(localStorage.getItem(DESKTOP_LANGUAGE_MODE_KEY)).toBe("system");
  });

  it("renders diagnostics and copies the report, while copy failure is surfaced", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.diagnostics }),
    );

    expect(await screen.findByText("1.2.3")).toBeVisible();
    expect(screen.getByLabelText(dictionary.desktop.settings.diagnostics.recentEvents)).toHaveValue(
      "App started\nSession restored",
    );
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.diagnostics.copy }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("API host https://kitezh.example"),
      ),
    );

    writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.diagnostics.copy }),
    );
    expect(await screen.findByText(dictionary.desktop.settings.error)).toBeVisible();
  });

  it("shows unavailable diagnostics and preferences load errors", async () => {
    mockApi.preferences.get.mockRejectedValueOnce(new Error("load failed"));
    mockApi.diagnostics.get.mockRejectedValueOnce(new Error("diagnostics unavailable"));
    render(<DesktopSettings />);

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.desktop.settings.error);
    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.sections.diagnostics }),
    );
    expect(
      await screen.findByText(dictionary.desktop.settings.diagnostics.unavailable),
    ).toBeVisible();
  });

  it("shows reset failures without changing the settings screen", async () => {
    mockApi.preferences.reset.mockRejectedValueOnce(new Error("reset failed"));
    render(<DesktopSettings />);
    await screen.findByRole("heading", { name: dictionary.desktop.settings.title });

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.desktop.settings.resetDefaults }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.desktop.settings.error);
  });
});
