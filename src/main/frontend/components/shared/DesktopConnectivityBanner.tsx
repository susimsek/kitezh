"use client";

import { useEffect, useState } from "react";

import { apiUrl, isDesktopRuntime, setDesktopConnectivity } from "@/lib/desktop-api";

export function DesktopConnectivityBanner() {
  const [, setOffline] = useState(false);

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

  // Keep the connectivity probe active for write protection, but do not show a
  // persistent banner. The update and authentication dialogs surface actionable
  // failures when the user actually needs the server.
  return null;
}
