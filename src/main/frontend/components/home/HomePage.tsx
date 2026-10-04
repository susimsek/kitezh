"use client";

import { Button, Card, Col, Container, Row, Stack } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Icon, type IconName } from "@/components/shared/Icon";
import { useBranding } from "@/components/auth/BrandingProvider";

type HomeFeature = {
  icon: IconName;
  title: string;
  description: string;
};

export function HomePage({ dictionary }: { dictionary: Dictionary }) {
  const branding = useBranding();
  const copy = dictionary.home;
  const product = branding.applicationName || dictionary.brand.product;
  const features: HomeFeature[] = [
    {
      icon: "shieldHalved",
      title: copy.features.security.title,
      description: copy.features.security.description,
    },
    {
      icon: "key",
      title: copy.features.protocols.title,
      description: copy.features.protocols.description,
    },
    {
      icon: "users",
      title: copy.features.consoles.title,
      description: copy.features.consoles.description,
    },
  ];

  return (
    <>
      <main className="home-page py-4 py-md-5">
        <Container>
          <section className="home-hero py-4 py-md-5">
            <Row className="align-items-center g-4 g-lg-5">
              <Col xs={12} lg={7}>
                <Stack gap={3}>
                  <span className="text-primary text-uppercase fw-semibold small">
                    {copy.eyebrow}
                  </span>
                  <h1 className="display-4 fw-bold mb-0">{copy.title}</h1>
                  <p className="lead text-body-secondary mb-0">{copy.subtitle}</p>
                  <Stack direction="horizontal" gap={2} className="flex-wrap pt-2">
                    <Button as="a" href="/download" variant="primary" size="lg">
                      <ActionIcon action="download" />
                      {copy.download}
                    </Button>
                    <Button as="a" href="/login" variant="secondary" size="lg">
                      <ActionIcon action="login" />
                      {copy.signIn}
                    </Button>
                  </Stack>
                  <p className="small text-body-secondary mb-0">{copy.openSource}</p>
                </Stack>
              </Col>
              <Col xs={12} lg={5}>
                <div className="home-hero-mark mx-auto" aria-hidden="true">
                  <BrandLogo size={128} />
                </div>
              </Col>
            </Row>
          </section>

          <section className="home-features mt-4 mt-md-5" aria-labelledby="home-features-title">
            <div className="text-center mb-4">
              <h2 id="home-features-title" className="h3 mb-2">
                {copy.features.title}
              </h2>
              <p className="text-body-secondary mb-0">{copy.features.subtitle}</p>
            </div>
            <Row className="g-3 g-lg-4">
              {features.map((feature) => (
                <Col key={feature.title} xs={12} md={4}>
                  <Card className="home-feature-card h-100">
                    <Card.Body className="p-4">
                      <Icon icon={feature.icon} size="2x" className="text-primary mb-3" />
                      <h3 className="h5">{feature.title}</h3>
                      <p className="text-body-secondary mb-0">{feature.description}</p>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </section>
        </Container>
      </main>

      <footer className="home-site-footer border-top py-4 py-md-5">
        <Container>
          <Row className="g-4">
            <Col xs={12} md={6} lg={5}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <BrandLogo size={32} />
                <span className="fw-semibold">{product}</span>
              </div>
              <p className="home-footer-description text-body-secondary mb-0">
                {copy.footer.description}
              </p>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <h2 className="h6 mb-3">{copy.footer.product}</h2>
              <Stack gap={2} as="ul" className="list-unstyled mb-0">
                <li>
                  <a className="home-footer-link" href="/login">
                    {copy.footer.signIn}
                  </a>
                </li>
                <li>
                  <a className="home-footer-link" href="/download">
                    {copy.footer.download}
                  </a>
                </li>
              </Stack>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <h2 className="h6 mb-3">{copy.footer.resources}</h2>
              <Stack gap={2} as="ul" className="list-unstyled mb-0">
                <li>
                  <a
                    className="home-footer-link"
                    href="https://github.com/susimsek/kitezh#readme"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.footer.documentation}
                  </a>
                </li>
                <li>
                  <a
                    className="home-footer-link"
                    href="https://github.com/susimsek/kitezh/releases"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.footer.releases}
                  </a>
                </li>
              </Stack>
            </Col>
            <Col xs={12} lg={3}>
              <h2 className="h6 mb-3">{copy.footer.project}</h2>
              <Stack gap={2} as="ul" className="list-unstyled mb-0">
                <li>
                  <a
                    className="home-footer-link"
                    href="https://github.com/susimsek/kitezh"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.footer.sourceCode}
                  </a>
                </li>
                <li>
                  <a
                    className="home-footer-link"
                    href="https://github.com/susimsek/kitezh/blob/main/LICENSE"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.footer.license}
                  </a>
                </li>
                <li>
                  <a
                    className="home-footer-link"
                    href="https://github.com/susimsek/kitezh/security/policy"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.footer.security}
                  </a>
                </li>
              </Stack>
            </Col>
          </Row>
          <div className="home-footer border-top text-body-secondary mt-4 pt-3">
            {copy.footer.copyright.replace("{product}", product)}
          </div>
        </Container>
      </footer>
    </>
  );
}
