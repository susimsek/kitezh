"use client";

import { useSearchParams } from "@/routing/navigation";
import { Suspense } from "react";
import { Card } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";

type ErrorViewProps = {
  dictionary: Dictionary;
};

const DEFAULT_ERROR_TYPE = "server_error";

export function ErrorView({ dictionary }: ErrorViewProps) {
  return (
    <Suspense fallback={null}>
      <ErrorContent dictionary={dictionary} />
    </Suspense>
  );
}

function ErrorContent({ dictionary }: ErrorViewProps) {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type") ?? DEFAULT_ERROR_TYPE;
  const errorTypes = dictionary.error.types;
  const error =
    requestedType in errorTypes
      ? errorTypes[requestedType as keyof typeof errorTypes]
      : errorTypes.server_error;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4 p-md-5">
        <div className="d-grid gap-4">
          <div>
            <span className="text-primary text-uppercase fw-semibold small">
              {dictionary.error.eyebrow}
            </span>
            <h1 className="h3 fw-bold mt-2 mb-2">{error.title}</h1>
            <p className="text-body-secondary mb-0">{error.description}</p>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
