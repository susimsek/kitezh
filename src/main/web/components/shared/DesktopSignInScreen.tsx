"use client";

import { Alert, Button, Card, Col, Container, Row, Spinner, Stack } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";

import { ActionIcon } from "./ActionIcon";
import { BrandLogo } from "./BrandLogo";

type DesktopSignInScreenProps = {
  dictionary: Dictionary;
  pending: boolean;
  error: boolean;
  onSignIn: () => void;
};

export function DesktopSignInScreen({
  dictionary,
  pending,
  error,
  onSignIn,
}: DesktopSignInScreenProps) {
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
                  <h1 className="h3 fw-bold mb-1">{dictionary.desktop.signInTitle}</h1>
                  <p className="text-body-secondary mb-0">{dictionary.desktop.signInDescription}</p>
                </Stack>

                {error && (
                  <Alert variant="danger" className="text-start" role="alert">
                    {dictionary.desktop.signInUnavailable}
                  </Alert>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-100"
                  disabled={pending}
                  aria-busy={pending}
                  onClick={onSignIn}
                >
                  {pending ? (
                    <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
                  ) : (
                    <ActionIcon action="login" />
                  )}
                  {dictionary.desktop.signInWithBrowser}
                </Button>

                <p className="small text-body-secondary mt-3 mb-0">
                  {dictionary.desktop.browserSignInHint}
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
