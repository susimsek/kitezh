"use client";

import { Button, Card, Stack } from "react-bootstrap";

import { useRouter } from "@/routing/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";

import { ActionIcon } from "./ActionIcon";

export function DesktopConsoleChooser({ dictionary }: { dictionary: Dictionary }) {
  const router = useRouter();

  return (
    <main className="desktop-sign-in">
      <Card className="auth-card desktop-sign-in-card">
        <Card.Body className="p-4 p-md-5">
          <Stack gap={1} className="mb-4">
            <span className="text-primary text-uppercase fw-semibold small">
              {dictionary.desktop.chooseConsoleEyebrow}
            </span>
            <h1 className="h3 fw-bold mb-1">{dictionary.desktop.chooseConsoleTitle}</h1>
            <p className="text-body-secondary mb-0">
              {dictionary.desktop.chooseConsoleDescription}
            </p>
          </Stack>

          <div className="desktop-console-options">
            <div className="desktop-console-option">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-100"
                onClick={() => router.push("/admin?desktopSignIn=1")}
              >
                <ActionIcon action="login" />
                {dictionary.desktop.adminConsole}
              </Button>
              <p className="small text-body-secondary mt-2 mb-0">
                {dictionary.desktop.adminConsoleDescription}
              </p>
            </div>
            <div className="desktop-console-option">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-100"
                onClick={() => router.push("/account/personal-info?desktopSignIn=1")}
              >
                <ActionIcon action="login" />
                {dictionary.desktop.accountConsole}
              </Button>
              <p className="small text-body-secondary mt-2 mb-0">
                {dictionary.desktop.accountConsoleDescription}
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>
    </main>
  );
}
