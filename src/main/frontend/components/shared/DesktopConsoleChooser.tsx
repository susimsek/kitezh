"use client";

import { Button, Card, Col, Container, Row, Stack } from "react-bootstrap";

import { useRouter } from "@/routing/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";

import { ActionIcon } from "./ActionIcon";
import { BrandLogo } from "./BrandLogo";

export function DesktopConsoleChooser({ dictionary }: { dictionary: Dictionary }) {
  const router = useRouter();

  return (
    <main className="desktop-sign-in">
      <Container>
        <Row className="justify-content-center align-items-center auth-content-row py-4 py-md-5">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            <Card className="auth-card desktop-sign-in-card">
              <Card.Body className="p-4 p-md-5 text-center">
                <BrandLogo size={72} className="desktop-sign-in-logo d-block mx-auto mb-4" />
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
          </Col>
        </Row>
      </Container>
    </main>
  );
}
