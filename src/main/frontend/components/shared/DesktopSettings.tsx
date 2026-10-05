"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Alert, Button, Card, Container, Form, Spinner, Stack } from "react-bootstrap";

import { Icon, type IconName } from "@/components/shared/Icon";
import { useDictionary } from "@/i18n/client";
import {
  isDesktopRuntime,
  type DesktopDiagnostics,
  type DesktopPreferences,
} from "@/lib/desktop-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/theme-slice";

import { THEME_STORAGE_KEY, type Theme } from "../auth/theme";

type PreferenceKey = "launchAtLogin" | "notifications" | "automaticDownload" | "globalShortcut";
type SettingsSection = "general" | "notifications" | "appearance" | "updates" | "diagnostics";

const sectionIcons: Record<SettingsSection, IconName> = {
  general: "sliders",
  notifications: "heartPulse",
  appearance: "sun",
  updates: "clockRotateLeft",
  diagnostics: "circleInfo",
};

export function DesktopSettings() {
  const dictionary = useDictionary();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.value) as Theme;
  const [section, setSection] = useState<SettingsSection>("general");
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PreferenceKey | null>(null);
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [copyingDiagnostics, setCopyingDiagnostics] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    const desktopApi = window.desktopApi;
    void desktopApi.preferences
      .get()
      .then(setPreferences)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    void desktopApi.diagnostics
      .get()
      .then(setDiagnostics)
      .catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <main className="auth-content d-flex align-items-center justify-content-center min-vh-100">
        <Spinner
          animation="border"
          role="status"
          aria-label={dictionary.desktop.settings.loading}
        />
      </main>
    );
  }

  if (!isDesktopRuntime() || !window.desktopApi || !preferences) {
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

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "general", label: dictionary.desktop.settings.sections.general },
    {
      id: "notifications",
      label: dictionary.desktop.settings.sections.notifications,
    },
    { id: "appearance", label: dictionary.desktop.settings.sections.appearance },
    { id: "updates", label: dictionary.desktop.settings.sections.updates },
    { id: "diagnostics", label: dictionary.desktop.settings.sections.diagnostics },
  ];

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
    <main className="auth-content min-vh-100 py-4 py-md-5">
      <Container className="d-flex justify-content-center">
        <Card className="auth-card w-100" style={{ maxWidth: "64rem" }}>
          <Card.Body className="p-4 p-md-5">
            <Stack gap={1} className="mb-4">
              <span className="text-primary text-uppercase fw-semibold small">
                {dictionary.desktop.settings.eyebrow}
              </span>
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
                  className="nav nav-pills flex-column gap-1"
                  aria-label={dictionary.desktop.settings.navigation}
                >
                  {sections.map(({ id, label }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={section === id ? "primary" : "light"}
                      className="text-start d-flex align-items-center gap-2"
                      aria-current={section === id ? "page" : undefined}
                      onClick={() => setSection(id)}
                    >
                      <Icon icon={sectionIcons[id]} />
                      <span>{label}</span>
                    </Button>
                  ))}
                </nav>
              </div>

              <div className="col-12 col-md-8">
                <section aria-labelledby="desktop-settings-section-title">
                  <h2 id="desktop-settings-section-title" className="h4 fw-bold mb-1">
                    {sections.find(({ id }) => id === section)?.label}
                  </h2>
                  <p className="text-body-secondary mb-4">
                    {dictionary.desktop.settings.sectionDescriptions[section]}
                  </p>

                  {section === "general" && (
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

                  {section === "notifications" && (
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

                  {section === "appearance" && (
                    <fieldset>
                      <legend className="fs-6 fw-semibold">
                        {dictionary.desktop.settings.theme}
                      </legend>
                      <Stack gap={2}>
                        {(Object.keys(themeLabels) as Theme[]).map((value) => (
                          <Form.Check
                            key={value}
                            type="radio"
                            name="desktop-theme"
                            id={`desktop-theme-${value}`}
                            label={themeLabels[value]}
                            checked={theme === value}
                            onChange={() => changeTheme(value)}
                          />
                        ))}
                      </Stack>
                    </fieldset>
                  )}

                  {section === "updates" && (
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

                  {section === "diagnostics" && (
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

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => void window.desktopApi!.settings.close()}>
                {dictionary.desktop.settings.done}
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </main>
  );
}
