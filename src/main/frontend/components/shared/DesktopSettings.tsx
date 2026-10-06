"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Alert, Button, Card, Container, Form, InputGroup, Spinner, Stack } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { Icon, type IconName } from "@/components/shared/Icon";
import { useDictionary, useLocale } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/config";
import { DESKTOP_LANGUAGE_MODE_KEY, detectLocale, persistLocale } from "@/i18n/locale-cookie";
import {
  isDesktopRuntime,
  type DesktopDiagnostics,
  type DesktopPreferences,
} from "@/lib/desktop-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/theme-slice";

import { THEME_STORAGE_KEY, type Theme } from "../auth/theme";
import { ActionIcon } from "./ActionIcon";

type PreferenceKey =
  | "launchAtLogin"
  | "showInMenuBar"
  | "showInDock"
  | "notifications"
  | "automaticDownload"
  | "globalShortcut";
type SettingsSection = "general" | "notifications" | "appearance" | "updates" | "diagnostics";
type LanguageMode = Locale | "system";

const sectionIcons: Record<SettingsSection, IconName> = {
  general: "sliders",
  notifications: "heartPulse",
  appearance: "sun",
  updates: "clockRotateLeft",
  diagnostics: "circleInfo",
};

const defaultPreferences: DesktopPreferences = {
  launchAtLogin: false,
  showInMenuBar: true,
  showInDock: true,
  notifications: true,
  globalShortcut: "CommandOrControl+Shift+K",
  automaticDownload: false,
};

export function DesktopSettings() {
  const dictionary = useDictionary();
  const { i18n } = useTranslation("common");
  const locale = useLocale();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.value) as Theme;
  const [section, setSection] = useState<SettingsSection>("general");
  const [preferences, setPreferences] = useState<DesktopPreferences>(defaultPreferences);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PreferenceKey | null>(null);
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [copyingDiagnostics, setCopyingDiagnostics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [languageMode, setLanguageMode] = useState<LanguageMode>(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem(DESKTOP_LANGUAGE_MODE_KEY) === "system"
    ) {
      return "system";
    }
    return locale;
  });

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    const desktopApi = window.desktopApi;
    void desktopApi.settings.ready();
    void desktopApi.preferences
      .get()
      .then(setPreferences)
      .catch(() => setError(true));
    void desktopApi.diagnostics
      .get()
      .then(setDiagnostics)
      .catch(() => undefined);
  }, []);

  if (!isDesktopRuntime() || !window.desktopApi) {
    return null;
  }

  const updatePreference = async (key: PreferenceKey, value: boolean) => {
    setPending(key);
    setError(false);
    try {
      const next = await window.desktopApi!.preferences.set({ [key]: value });
      setPreferences(next);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };

  const updateShortcut = async (accelerator: string) => {
    setPending("globalShortcut");
    setError(false);
    try {
      const next = await window.desktopApi!.preferences.set({ globalShortcut: accelerator });
      setPreferences(next);
      setRecordingShortcut(false);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };

  const shortcutFromKeyEvent = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setRecordingShortcut(false);
      return null;
    }
    if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return null;

    const modifiers: string[] = [];
    if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (modifiers.length === 0) return null;

    const key =
      event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
    return [...modifiers, key].join("+");
  };

  const changeTheme = (nextTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    dispatch(setTheme(nextTheme));
  };

  const changeLocale = (nextMode: LanguageMode) => {
    setLanguageMode(nextMode);
    if (nextMode === "system") {
      localStorage.setItem(DESKTOP_LANGUAGE_MODE_KEY, "system");
      const systemLocale = detectLocale("", navigator.languages);
      persistLocale(systemLocale);
      void i18n.changeLanguage(systemLocale);
      return;
    }
    localStorage.removeItem(DESKTOP_LANGUAGE_MODE_KEY);
    persistLocale(nextMode);
    void i18n.changeLanguage(nextMode);
  };

  const sections: Array<{
    id: SettingsSection;
    label: string;
    description: string;
    keywords: string;
  }> = [
    {
      id: "general",
      label: dictionary.desktop.settings.sections.general,
      description: dictionary.desktop.settings.sectionDescriptions.general,
      keywords: `${dictionary.desktop.settings.launchAtLogin} ${dictionary.desktop.settings.showInMenuBar} ${dictionary.desktop.settings.showInDock} ${dictionary.desktop.settings.globalShortcut} ${dictionary.desktop.settings.language}`,
    },
    {
      id: "notifications",
      label: dictionary.desktop.settings.sections.notifications,
      description: dictionary.desktop.settings.sectionDescriptions.notifications,
      keywords: dictionary.desktop.settings.notifications,
    },
    {
      id: "appearance",
      label: dictionary.desktop.settings.sections.appearance,
      description: dictionary.desktop.settings.sectionDescriptions.appearance,
      keywords: dictionary.desktop.settings.theme,
    },
    {
      id: "updates",
      label: dictionary.desktop.settings.sections.updates,
      description: dictionary.desktop.settings.sectionDescriptions.updates,
      keywords: `${dictionary.desktop.settings.automaticUpdates} ${dictionary.desktop.settings.updateCheckDescription}`,
    },
    {
      id: "diagnostics",
      label: dictionary.desktop.settings.sections.diagnostics,
      description: dictionary.desktop.settings.sectionDescriptions.diagnostics,
      keywords: `${dictionary.desktop.settings.diagnostics.appVersion} ${dictionary.desktop.settings.diagnostics.runtime} ${dictionary.desktop.settings.diagnostics.recentEvents}`,
    },
  ];

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleSections = sections.filter(({ label, description, keywords }) => {
    if (!normalizedSearch) return true;
    return `${label} ${description} ${keywords}`.toLocaleLowerCase().includes(normalizedSearch);
  });
  const activeSection = section;

  const themeLabels: Record<Theme, string> = {
    system: dictionary.theme.system,
    light: dictionary.theme.light,
    dark: dictionary.theme.dark,
  };

  const copyDiagnostics = async () => {
    if (!diagnostics) return;
    setCopyingDiagnostics(true);
    try {
      const text = [
        `Kitezh ${diagnostics.appVersion}`,
        `Electron ${diagnostics.electronVersion}`,
        `Chrome ${diagnostics.chromeVersion}`,
        `Node ${diagnostics.nodeVersion}`,
        `Platform ${diagnostics.platform} (${diagnostics.architecture})`,
        `API host ${diagnostics.apiHost}`,
        `Packaged ${diagnostics.packaged}`,
        `Secure storage ${diagnostics.secureStorage}`,
        `Auto updates ${diagnostics.autoUpdatesSupported}`,
        "",
        "Recent events:",
        ...diagnostics.events,
      ].join("\n");
      await navigator.clipboard.writeText(text);
    } catch {
      setError(true);
    } finally {
      setCopyingDiagnostics(false);
    }
  };

  return (
    <main className="auth-content desktop-settings-page">
      <Container fluid>
        <Card className="auth-card desktop-settings-card w-100">
          <Card.Body className="p-4 p-md-5">
            <Stack gap={1} className="mb-4">
              <h1 className="h3 fw-bold mb-1">{dictionary.desktop.settings.title}</h1>
              <p className="text-body-secondary mb-0">{dictionary.desktop.settings.description}</p>
            </Stack>

            {error && (
              <Alert variant="danger" role="alert">
                {dictionary.desktop.settings.error}
              </Alert>
            )}

            <div className="row g-4">
              <div className="col-12 col-md-4">
                <nav
                  className="desktop-settings-navigation"
                  aria-label={dictionary.desktop.settings.navigation}
                >
                  <InputGroup className="desktop-settings-search mb-3">
                    <InputGroup.Text>
                      <ActionIcon action="search" className="m-0" />
                    </InputGroup.Text>
                    <Form.Control
                      type="search"
                      value={searchQuery}
                      placeholder={dictionary.desktop.settings.searchPlaceholder}
                      aria-label={dictionary.desktop.settings.search}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </InputGroup>
                  {visibleSections.length > 0 ? (
                    <>
                      <span className="desktop-settings-navigation-title">
                        {dictionary.desktop.settings.navigationTitle}
                      </span>
                      {visibleSections.map(({ id, label }) => (
                        <Button
                          key={id}
                          type="button"
                          variant="link"
                          className={`desktop-settings-nav-item ${activeSection === id ? "active" : ""}`}
                          aria-current={activeSection === id ? "page" : undefined}
                          onClick={() => setSection(id)}
                        >
                          <Icon icon={sectionIcons[id]} />
                          <span>{label}</span>
                        </Button>
                      ))}
                    </>
                  ) : (
                    <p className="small text-body-secondary mb-0 px-2">
                      {dictionary.desktop.settings.noSearchResults}
                    </p>
                  )}
                </nav>
              </div>

              <div className="col-12 col-md-8">
                <section aria-labelledby="desktop-settings-section-title">
                  <h2 id="desktop-settings-section-title" className="h4 fw-bold mb-1">
                    {sections.find(({ id }) => id === activeSection)?.label}
                  </h2>
                  <p className="text-body-secondary mb-4">
                    {dictionary.desktop.settings.sectionDescriptions[activeSection]}
                  </p>

                  {activeSection === "general" && (
                    <Stack gap={3}>
                      <Form.Check
                        type="switch"
                        id="desktop-launch-at-login"
                        label={dictionary.desktop.settings.launchAtLogin}
                        checked={preferences.launchAtLogin}
                        disabled={pending !== null}
                        onChange={(event) =>
                          void updatePreference("launchAtLogin", event.target.checked)
                        }
                      />
                      <Form.Text className="text-body-secondary">
                        {dictionary.desktop.settings.launchAtLoginDescription}
                      </Form.Text>
                      <Form.Check
                        type="switch"
                        id="desktop-show-in-menu-bar"
                        label={dictionary.desktop.settings.showInMenuBar}
                        checked={preferences.showInMenuBar}
                        disabled={pending !== null}
                        onChange={(event) =>
                          void updatePreference("showInMenuBar", event.target.checked)
                        }
                      />
                      <Form.Text className="text-body-secondary">
                        {dictionary.desktop.settings.showInMenuBarDescription}
                      </Form.Text>
                      {diagnostics?.platform === "darwin" && (
                        <>
                          <Form.Check
                            type="switch"
                            id="desktop-show-in-dock"
                            label={dictionary.desktop.settings.showInDock}
                            checked={preferences.showInDock}
                            disabled={pending !== null}
                            onChange={(event) =>
                              void updatePreference("showInDock", event.target.checked)
                            }
                          />
                          <Form.Text className="text-body-secondary">
                            {dictionary.desktop.settings.showInDockDescription}
                          </Form.Text>
                        </>
                      )}
                      <Form.Group>
                        <Form.Label htmlFor="desktop-language">
                          {dictionary.desktop.settings.language}
                        </Form.Label>
                        <Form.Select
                          id="desktop-language"
                          value={languageMode}
                          onChange={(event) => changeLocale(event.target.value as LanguageMode)}
                          aria-describedby="desktop-language-help"
                        >
                          <option value="system">
                            {dictionary.desktop.settings.systemLanguage}
                          </option>
                          {locales.map((value) => (
                            <option key={value} value={value}>
                              {value === "en" ? "English" : "Türkçe"}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text id="desktop-language-help" className="text-body-secondary">
                          {dictionary.desktop.settings.languageDescription}
                        </Form.Text>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label htmlFor="desktop-global-shortcut">
                          {dictionary.desktop.settings.globalShortcut}
                        </Form.Label>
                        <Form.Control
                          id="desktop-global-shortcut"
                          value={
                            recordingShortcut
                              ? dictionary.desktop.settings.globalShortcutCapture
                              : preferences.globalShortcut
                          }
                          readOnly
                          disabled={pending !== null}
                          onFocus={() => setRecordingShortcut(true)}
                          onBlur={() => setRecordingShortcut(false)}
                          onKeyDown={(event) => {
                            event.preventDefault();
                            const accelerator = shortcutFromKeyEvent(event);
                            if (accelerator) void updateShortcut(accelerator);
                          }}
                          aria-describedby="desktop-global-shortcut-help"
                        />
                        <Form.Text
                          id="desktop-global-shortcut-help"
                          className="text-body-secondary"
                        >
                          {dictionary.desktop.settings.globalShortcutDescription}
                        </Form.Text>
                      </Form.Group>
                    </Stack>
                  )}

                  {activeSection === "notifications" && (
                    <Form.Check
                      type="switch"
                      id="desktop-notifications"
                      label={dictionary.desktop.settings.notifications}
                      checked={preferences.notifications}
                      disabled={pending !== null}
                      onChange={(event) =>
                        void updatePreference("notifications", event.target.checked)
                      }
                    />
                  )}

                  {activeSection === "appearance" && (
                    <fieldset>
                      <legend className="fs-6 fw-semibold mb-3">
                        {dictionary.desktop.settings.themeMode}
                      </legend>
                      <div
                        className="desktop-theme-modes"
                        role="radiogroup"
                        aria-label={dictionary.desktop.settings.theme}
                      >
                        {(Object.keys(themeLabels) as Theme[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={`desktop-theme-mode${theme === value ? " active" : ""}`}
                            role="radio"
                            aria-checked={theme === value}
                            onClick={() => changeTheme(value)}
                          >
                            <span
                              className={`desktop-theme-preview desktop-theme-preview-${value}`}
                              aria-hidden="true"
                            >
                              <span />
                              <span />
                              <span />
                            </span>
                            <span>{themeLabels[value]}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {activeSection === "updates" && (
                    <Stack gap={3}>
                      <Form.Check
                        type="switch"
                        id="desktop-automatic-updates"
                        label={dictionary.desktop.settings.automaticUpdates}
                        checked={preferences.automaticDownload}
                        disabled={pending !== null}
                        onChange={(event) =>
                          void updatePreference("automaticDownload", event.target.checked)
                        }
                      />
                      <Form.Text className="text-body-secondary">
                        {dictionary.desktop.settings.automaticUpdatesDescription}
                      </Form.Text>
                      <Alert variant="info" className="mb-0">
                        {dictionary.desktop.settings.updateCheckDescription}
                      </Alert>
                    </Stack>
                  )}

                  {activeSection === "diagnostics" && (
                    <Stack gap={3}>
                      {diagnostics ? (
                        <>
                          <dl className="row mb-0">
                            <dt className="col-sm-5">
                              {dictionary.desktop.settings.diagnostics.appVersion}
                            </dt>
                            <dd className="col-sm-7">{diagnostics.appVersion}</dd>
                            <dt className="col-sm-5">
                              {dictionary.desktop.settings.diagnostics.platform}
                            </dt>
                            <dd className="col-sm-7">
                              {diagnostics.platform} ({diagnostics.architecture})
                            </dd>
                            <dt className="col-sm-5">
                              {dictionary.desktop.settings.diagnostics.runtime}
                            </dt>
                            <dd className="col-sm-7">
                              Electron {diagnostics.electronVersion}, Chrome{" "}
                              {diagnostics.chromeVersion}
                            </dd>
                            <dt className="col-sm-5">
                              {dictionary.desktop.settings.diagnostics.apiHost}
                            </dt>
                            <dd className="col-sm-7">{diagnostics.apiHost}</dd>
                            <dt className="col-sm-5">
                              {dictionary.desktop.settings.diagnostics.secureStorage}
                            </dt>
                            <dd className="col-sm-7">
                              {diagnostics.secureStorage === "available"
                                ? dictionary.desktop.settings.diagnostics.available
                                : dictionary.desktop.settings.diagnostics.unavailable}
                            </dd>
                          </dl>
                          <Form.Group>
                            <Form.Label htmlFor="desktop-diagnostic-events">
                              {dictionary.desktop.settings.diagnostics.recentEvents}
                            </Form.Label>
                            <Form.Control
                              as="textarea"
                              id="desktop-diagnostic-events"
                              rows={7}
                              readOnly
                              value={
                                diagnostics.events.length > 0
                                  ? diagnostics.events.join("\n")
                                  : dictionary.desktop.settings.diagnostics.noEvents
                              }
                            />
                          </Form.Group>
                          <div className="d-flex justify-content-end">
                            <Button
                              variant="secondary"
                              disabled={copyingDiagnostics}
                              onClick={() => void copyDiagnostics()}
                            >
                              {copyingDiagnostics && (
                                <Spinner
                                  animation="border"
                                  size="sm"
                                  className="me-2"
                                  aria-hidden="true"
                                />
                              )}
                              {dictionary.desktop.settings.diagnostics.copy}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Alert variant="secondary" className="mb-0">
                          {dictionary.desktop.settings.diagnostics.unavailable}
                        </Alert>
                      )}
                    </Stack>
                  )}
                </section>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </main>
  );
}
