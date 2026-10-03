"use client";

import { Alert } from "react-bootstrap";
import { useEffect, useState } from "react";

import { useDictionary } from "@/i18n/client";
import { apiUrl, isDesktopRuntime, setDesktopConnectivity } from "@/lib/desktop-api";

export function DesktopConnectivityBanner() {
  const dictionary = useDictionary();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime()) return undefined;
    let cancelled = false;

    const probe = async () => {
      if (!navigator.onLine) {
        if (!cancelled) {
          setDesktopConnectivity(false);
          setOffline(true);
        }
        return;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(apiUrl("/api/auth/branding"), {
          credentials: "omit",
          signal: controller.signal,
        });
        if (!cancelled) {
          setDesktopConnectivity(response.ok);
          setOffline(!response.ok);
        }
      } catch {
        if (!cancelled) {
          setDesktopConnectivity(false);
          setOffline(true);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const handleOnline = () => void probe();
    const handleOffline = () => {
      setDesktopConnectivity(false);
      setOffline(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void probe();
    const interval = window.setInterval(() => void probe(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!offline) return null;
  return (
    <Alert
      variant="warning"
      className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
      role="status"
      aria-live="polite"
    >
      {dictionary.desktop.offline}
    </Alert>
  );
}
