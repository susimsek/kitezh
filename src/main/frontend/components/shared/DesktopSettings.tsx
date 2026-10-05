"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Container, Form, Spinner, Stack } from "react-bootstrap";

import { useDictionary } from "@/i18n/client";
import { isDesktopRuntime, type DesktopPreferences } from "@/lib/desktop-api";

type PreferenceKey = "launchAtLogin" | "notifications" | "automaticDownload";

export function DesktopSettings() {
  const dictionary = useDictionary();
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PreferenceKey | null>(null);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    void window.desktopApi.preferences
      .get()
      .then(setPreferences)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
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

  return (
    <main className="auth-content min-vh-100 py-4 py-md-5">
      <Container className="d-flex justify-content-center">
        <Card className="auth-card w-100" style={{ maxWidth: "48rem" }}>
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

            <Stack gap={3}>
              <Form.Check
                type="switch"
                id="desktop-launch-at-login"
                label={dictionary.desktop.settings.launchAtLogin}
                checked={preferences.launchAtLogin}
                disabled={pending !== null}
                onChange={(event) => void updatePreference("launchAtLogin", event.target.checked)}
              />
              <Form.Text className="text-body-secondary">
                {dictionary.desktop.settings.launchAtLoginDescription}
              </Form.Text>
              <Form.Check
                type="switch"
                id="desktop-notifications"
                label={dictionary.desktop.settings.notifications}
                checked={preferences.notifications}
                disabled={pending !== null}
                onChange={(event) => void updatePreference("notifications", event.target.checked)}
              />
              <Form.Text className="text-body-secondary">
                {dictionary.desktop.settings.notificationsDescription}
              </Form.Text>
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
              <Form.Group>
                <Form.Label htmlFor="desktop-global-shortcut">
                  {dictionary.desktop.settings.globalShortcut}
                </Form.Label>
                <Form.Control
                  id="desktop-global-shortcut"
                  value={preferences.globalShortcut}
                  readOnly
                  aria-describedby="desktop-global-shortcut-help"
                />
                <Form.Text id="desktop-global-shortcut-help" className="text-body-secondary">
                  {dictionary.desktop.settings.globalShortcutDescription}
                </Form.Text>
              </Form.Group>
            </Stack>

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
