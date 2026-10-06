"use client";

import { useState } from "react";
import { Button, Card, Spinner, Stack } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { isDesktopRuntime } from "@/lib/desktop-api";

import { ActionIcon } from "./ActionIcon";
import { BrandLogo } from "./BrandLogo";

type ConsoleName = "admin" | "account";

export function DesktopCompanion({ dictionary }: { dictionary: Dictionary }) {
  const [pending, setPending] = useState<ConsoleName | null>(null);

  const openConsole = async (consoleName: ConsoleName) => {
    if (!isDesktopRuntime() || !window.desktopApi || pending) return;
    setPending(consoleName);
    try {
      await window.desktopApi.companion.openConsole(consoleName);
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="desktop-companion-page">
      <Card className="desktop-companion-card">
        <Card.Body className="p-4">
          <BrandLogo size={52} className="d-block mx-auto mb-3" />
          <Stack gap={1} className="text-center mb-4">
            <span className="text-primary text-uppercase fw-semibold small">
              {dictionary.desktop.chooseConsoleEyebrow}
            </span>
            <h1 className="h4 fw-bold mb-1">{dictionary.brand.product}</h1>
            <p className="text-body-secondary small mb-0">
              {dictionary.desktop.chooseConsoleDescription}
            </p>
          </Stack>

          <Stack gap={2}>
            <Button
              type="button"
              variant="primary"
              className="w-100"
              disabled={pending !== null}
              onClick={() => void openConsole("admin")}
            >
              {pending === "admin" ? (
                <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
              ) : (
                <ActionIcon action="login" />
              )}
              {dictionary.desktop.adminConsole}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="w-100"
              disabled={pending !== null}
              onClick={() => void openConsole("account")}
            >
              {pending === "account" ? (
                <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
              ) : (
                <ActionIcon action="login" />
              )}
              {dictionary.desktop.accountConsole}
            </Button>
          </Stack>
        </Card.Body>
      </Card>
    </main>
  );
}
