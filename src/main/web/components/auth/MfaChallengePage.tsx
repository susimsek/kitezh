"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";
import { useSearchParams } from "@/routing/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import { authenticatePasskey } from "@/lib/webauthn";

export function MfaChallengePage({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.mfa;
  const returnTo = safeReturnTo(useSearchParams().get("return_to"));
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const schema = z.object({ code: z.string().min(1, copy.invalidCode) });
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<{ code: string }>({
    resolver: zodResolver(schema),
  });
  const submit = handleSubmit(async ({ code }) => {
    const valid = recoveryMode
      ? /^[A-Za-z0-9]{4}(?:[- ]?[A-Za-z0-9]{4}){2}$/.test(code)
      : /^\d{6,8}$/.test(code);
    if (!valid) {
      setError("code", {
        type: "validate",
        message: recoveryMode ? copy.invalidRecoveryCode : copy.invalidCode,
      });
      return;
    }
    setBusy(true);
    setFailed(null);
    clearErrors("code");
    try {
      const response = await fetch(
        recoveryMode ? "/api/auth/mfa/recovery-code" : "/api/auth/mfa/verify",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      if (response.status === 401) {
        window.location.assign(returnTo);
        return;
      }
      if (!response.ok) {
        setError("code", {
          type: "server",
          message: await responseError(response, copy.invalidCode),
        });
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setFailed(copy.invalidCode);
    } finally {
      setBusy(false);
    }
  });
  return (
    <Card className="auth-card">
      <Card.Body className="p-4 p-md-5">
        <Stack gap={3}>
          <span className="text-primary text-uppercase fw-semibold small">{copy.eyebrow}</span>
          <h1 className="h3 fw-bold mb-0">{copy.title}</h1>
          <p className="text-body-secondary mb-0">{copy.subtitle}</p>
          {failed && <Alert variant="danger">{failed}</Alert>}
          <Form onSubmit={submit} noValidate>
            <Form.Group className="mb-4" controlId="mfa-code">
              <Form.Label>{recoveryMode ? copy.recoveryCode : copy.code}</Form.Label>
              <Form.Control
                inputMode={recoveryMode ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoFocus
                maxLength={recoveryMode ? 14 : 8}
                isInvalid={Boolean(errors.code)}
                {...register("code")}
              />
              <Form.Control.Feedback type="invalid">{errors.code?.message}</Form.Control.Feedback>
            </Form.Group>
            <Button type="submit" disabled={busy} className="w-100">
              {busy ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <ActionIcon action="check" />
              )}
              {copy.verify}
            </Button>
          </Form>
          <Button
            variant="link"
            className="px-0 align-self-start"
            type="button"
            onClick={() => {
              setRecoveryMode((value) => !value);
              clearErrors("code");
            }}
          >
            {recoveryMode ? copy.useAuthenticatorCode : copy.useRecoveryCode}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={passkeyBusy}
            onClick={() => {
              setPasskeyBusy(true);
              setFailed(null);
              void authenticatePasskey(async (url, init) => {
                const response = await fetch(url, {
                  ...init,
                  credentials: "same-origin",
                });
                let data: unknown = null;
                try {
                  data = await response.json();
                } catch {
                  // Successful WebAuthn authentication redirects to the authorization request.
                }
                return { status: response.status, data, url: response.url };
              })
                .then((response) => {
                  if (response.status >= 300) throw new Error();
                  window.location.assign(returnTo);
                })
                .catch(() => setFailed(copy.passkeyError))
                .finally(() => setPasskeyBusy(false));
            }}
          >
            {passkeyBusy ? (
              <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
            ) : (
              <Icon icon="key" className="me-2" />
            )}
            {copy.passkey}
          </Button>
        </Stack>
      </Card.Body>
    </Card>
  );
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail.trim() ? body.detail : fallback;
  } catch {
    return fallback;
  }
}
