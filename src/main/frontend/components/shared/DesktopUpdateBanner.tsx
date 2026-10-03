"use client";

import { Alert, Button, Spinner } from "react-bootstrap";
import { useEffect, useState } from "react";

import { useDictionary } from "@/i18n/client";
import { isDesktopRuntime } from "@/lib/desktop-api";
import type { DesktopUpdateStatus } from "@/lib/desktop-api";

export function DesktopUpdateBanner() {
  const dictionary = useDictionary();
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [pending, setPending] = useState(false);

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

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  };

  if (status.state === "checking") return null;
  if (status.state === "recovered") {
    return (
      <Alert
        variant="warning"
        className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
        role="status"
      >
        {dictionary.desktop.updateRecovered.replace("{version}", status.version)}
      </Alert>
    );
  }
  if (status.state === "error") {
    return (
      <Alert
        variant="warning"
        className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
        role="status"
      >
        {dictionary.desktop.updateError}
      </Alert>
    );
  }

  if (status.state === "available") {
    return (
      <Alert
        variant="info"
        className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
        role="status"
      >
        <span className="me-3">
          {dictionary.desktop.updateAvailable.replace("{version}", status.version)}
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() => run(() => window.desktopApi!.updates.download())}
        >
          {pending && <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />}
          {dictionary.desktop.updateDownload}
        </Button>
      </Alert>
    );
  }

  if (status.state === "downloading") {
    return (
      <Alert
        variant="info"
        className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
        role="status"
      >
        <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
        {dictionary.desktop.updateDownloading.replace(
          "{percent}",
          Math.round(status.percent).toString(),
        )}
      </Alert>
    );
  }

  return (
    <Alert
      variant="success"
      className="position-fixed top-0 start-50 translate-middle-x m-2 shadow"
      role="status"
    >
      <span className="me-3">
        {dictionary.desktop.updateReady.replace("{version}", status.version)}
      </span>
      <Button
        size="sm"
        variant="primary"
        disabled={pending}
        onClick={() => run(() => window.desktopApi!.updates.install())}
      >
        {dictionary.desktop.updateRestart}
      </Button>
    </Alert>
  );
}
