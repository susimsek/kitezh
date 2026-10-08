"use client";

import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import Link from "@/routing/Link";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";

/** Shared by Next's exported 404 and the browser router's unmatched routes. */
export function NotFoundView() {
  const { t } = useTranslation("common");
  return (
    <Card className="border-0 shadow-sm text-center" data-testid="not-found">
      <Card.Body className="p-4 p-md-5">
        <Icon icon="compass" className="text-primary mb-3" size="3x" />
        <div className="display-1 fw-bold text-primary" aria-hidden="true">
          404
        </div>
        <h1 className="h3 fw-bold mt-2 mb-3">{t("error.types.not_found.title")}</h1>
        <p className="text-body-secondary mb-4">{t("error.types.not_found.description")}</p>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          <Link href="/" className="btn btn-primary">
            <ActionIcon action="back" />
            {t("error.backToHome")}
          </Link>
          <Link href="/account/" className="btn btn-secondary">
            <ActionIcon action="view" />
            {t("error.openAccount")}
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
}
