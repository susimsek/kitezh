"use client";

import { useEffect, useState } from "react";
import { Button, Spinner } from "react-bootstrap";

import { ActionIcon } from "@/components/shared/ActionIcon";
import { useDictionary } from "@/i18n/client";
import { isDesktopRuntime } from "@/lib/desktop-api";
import type { DesktopUpdateStatus } from "@/lib/desktop-api";

export function DesktopUpdateControl() {
  const dictionary = useDictionary();
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopApi) return undefined;
    return window.desktopApi.updates.onStatus(setStatus);
  }, []);

  if (!isDesktopRuntime() || !window.desktopApi || !status) return null;
  if (status.state !== "available" && status.state !== "downloaded") return null;

  const isDownloaded = status.state === "downloaded";
  const label = isDownloaded ? dictionary.desktop.updateRestart : dictionary.desktop.updateButton;
  const action = async () => {
    setPending(true);
    try {
      if (isDownloaded) await window.desktopApi!.updates.install();
      else await window.desktopApi!.updates.download();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="primary"
      className="desktop-update-control text-nowrap"
      aria-label={`${label} ${status.version}`}
      disabled={pending}
      onClick={() => void action()}
    >
      {pending ? (
        <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
      ) : (
        <ActionIcon action={isDownloaded ? "rotate" : "regenerate"} />
      )}
      {label}
    </Button>
  );
}
