"use client";

import { Col, Container, Row } from "react-bootstrap";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import { AuthNavbar } from "./AuthNavbar";

type AuthLayoutProps = {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
};

export function AuthLayout({ locale, dictionary, children }: AuthLayoutProps) {
  return (
    <div className="auth-app min-vh-100 bg-body-tertiary">
      <AuthNavbar locale={locale} dictionary={dictionary} />
      <Container>
        <Row className="justify-content-center align-items-center auth-content-row py-4 py-md-5">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            {children}
          </Col>
        </Row>
      </Container>
    </div>
  );
}
