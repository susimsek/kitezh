"use client";

import { Alert, Spinner } from "react-bootstrap";
import { useEffect, useState } from "react";

import { useDictionary } from "@/i18n/client";
import { isDesktopRuntime } from "@/lib/desktop-api";
import type { DesktopUpdateStatus } from "@/lib/desktop-api";

export function DesktopUpdateBanner() {
  const dictionary = useDictionary();
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    const removeListener = window.desktopApi.updates.onStatus(setStatus);
    return removeListener;
  }, []);

  if (
    !isDesktopRuntime() ||
    !status ||
    status.state === "unsupported" ||
    status.state === "not-available"
  ) {
    return null;
  }

  if (status.state === "checking") return null;
  if (status.state === "recovered") {
    return (
      <Alert variant="warning" className="desktop-status-banner shadow" role="status">
        {dictionary.desktop.updateRecovered.replace("{version}", status.version)}
      </Alert>
    );
  }
  if (status.state === "error") {
    return (
      <Alert variant="warning" className="desktop-status-banner shadow" role="status">
        {dictionary.desktop.updateError}
      </Alert>
    );
  }

  // Available and downloaded states are represented by the compact update
  // control in each console navbar.
  if (status.state === "available" || status.state === "downloaded") return null;

  if (status.state === "downloading") {
    return (
      <Alert variant="info" className="desktop-status-banner shadow" role="status">
        <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
        {dictionary.desktop.updateDownloading.replace(
          "{percent}",
          Math.round(status.percent).toString(),
        )}
      </Alert>
    );
  }

  return null;
}
