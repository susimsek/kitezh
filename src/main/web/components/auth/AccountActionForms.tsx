"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "@/routing/Link";
import { useSearchParams } from "@/routing/navigation";
import { usePathname } from "@/routing/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { accountActionError, submitAccountAction } from "@/lib/account-actions-api";
import { applyProblemToForm } from "@/lib/problem-detail";
import { ActionIcon } from "@/components/shared/ActionIcon";

type Props = { locale: Locale; dictionary: Dictionary };

function ActionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="auth-card">
      <Card.Body className="p-4 p-md-5">
        <h1 className="h3 fw-bold mb-4">{title}</h1>
        {children}
      </Card.Body>
    </Card>
  );
}

export function ForgotPasswordForm({ locale, dictionary }: Props) {
  const copy = dictionary.accountActions;
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({
    identifier: z
      .string()
      .trim()
      .min(1, dictionary.account.validation.required)
      .max(200, dictionary.account.validation.max200),
  });
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await submitAccountAction("forgot-password", { ...values, locale });
      setSent(true);
    } catch (failure) {
      const result = applyProblemToForm(failure, setFieldError, {
        fields: ["identifier"],
        fallbackMessage: dictionary.account.validation.invalid,
      });
      if (result.firstField) {
        setError(null);
      } else {
        setError(accountActionError(failure, dictionary));
      }
    }
  });

  return (
    <ActionCard title={copy.forgotTitle}>
      {error && <Alert variant="danger">{error}</Alert>}
      {sent ? (
        <Alert variant="success">{copy.forgotSent}</Alert>
      ) : (
        <Form onSubmit={submit} noValidate>
          <p className="text-body-secondary">{copy.forgotHelp}</p>
          <Form.Group className="mb-4" controlId="reset-identifier">
            <Form.Label>{copy.identifier}</Form.Label>
            <Form.Control
              autoComplete="username"
              isInvalid={Boolean(errors.identifier)}
              {...register("identifier")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.identifier?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Button className="w-100" size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
            ) : (
              <ActionIcon action="send" />
            )}
            {copy.send}
          </Button>
        </Form>
      )}
      <Link className="d-inline-block mt-3" href={`/login`}>
        {copy.backToLogin}
      </Link>
    </ActionCard>
  );
}

export function ResetPasswordForm({ dictionary }: Props) {
  const copy = dictionary.accountActions;
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOtpMode, setResetOtpMode] = useState<"none" | "if-configured" | "required">("none");
  useEffect(() => {
    fetch("/api/auth/login-settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (
          value?.passwordResetOtpMode === "if-configured" ||
          value?.passwordResetOtpMode === "required"
        ) {
          setResetOtpMode(value.passwordResetOtpMode);
        }
      })
      .catch(() => {});
  }, []);
  const schema = z
    .object({
      newPassword: z
        .string()
        .min(12, dictionary.account.validation.password)
        .max(128, dictionary.account.validation.max200),
      confirmPassword: z.string(),
      otpCode: z.string().trim().max(8, copy.otpInvalid).optional(),
    })
    .superRefine((values, context) => {
      if (values.newPassword !== values.confirmPassword) {
        context.addIssue({
          path: ["confirmPassword"],
          code: "custom",
          message: copy.passwordMismatch,
        });
      }
      if (resetOtpMode === "required" && !/^\d{6,8}$/.test(values.otpCode ?? "")) {
        context.addIssue({ path: ["otpCode"], code: "custom", message: copy.otpRequired });
      }
    });
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "", otpCode: "" },
  });

  const submit = handleSubmit(async (values) => {
    if (!token) return;
    setError(null);
    try {
      await submitAccountAction("reset-password", {
        token,
        newPassword: values.newPassword,
        otpCode: values.otpCode?.trim() || undefined,
      });
      reset();
      setDone(true);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (failure) {
      const result = applyProblemToForm(failure, setFieldError, {
        fields: ["newPassword", "confirmPassword", "otpCode"],
        fallbackMessage: (violation) =>
          violation.field === "newPassword"
            ? dictionary.account.validation.password
            : violation.field === "otpCode"
              ? copy.otpInvalid
              : copy.passwordMismatch,
      });
      if (!result.firstField) setError(accountActionError(failure, dictionary));
    }
  });

  return (
    <ActionCard title={copy.resetTitle}>
      {done && <Alert variant="success">{copy.resetDone}</Alert>}
      {!done && (!token || error) && (
        <Alert variant="danger">{!token ? copy.invalidLink : error}</Alert>
      )}
      {!done && token && (
        <Form onSubmit={submit} noValidate>
          <Stack gap={3}>
            <Form.Group controlId="action-new-password">
              <Form.Label>{copy.newPassword}</Form.Label>
              <Form.Control
                type="password"
                autoComplete="new-password"
                isInvalid={Boolean(errors.newPassword)}
                {...register("newPassword")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.newPassword?.message}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group controlId="action-confirm-password">
              <Form.Label>{copy.confirmPassword}</Form.Label>
              <Form.Control
                type="password"
                autoComplete="new-password"
                isInvalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
              <Form.Control.Feedback type="invalid">
                {errors.confirmPassword?.message}
              </Form.Control.Feedback>
            </Form.Group>
            {resetOtpMode !== "none" && (
              <Form.Group controlId="action-otp-code">
                <Form.Label>{copy.otpCode}</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  isInvalid={Boolean(errors.otpCode)}
                  {...register("otpCode")}
                />
                <Form.Text>{copy.otpHelp}</Form.Text>
                <Form.Control.Feedback type="invalid">
                  {errors.otpCode?.message}
                </Form.Control.Feedback>
              </Form.Group>
            )}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <ActionIcon action="save" />
              )}
              {copy.reset}
            </Button>
          </Stack>
        </Form>
      )}
      <Link className="d-inline-block mt-3" href={`/login`}>
        {copy.backToLogin}
      </Link>
    </ActionCard>
  );
}

export function VerifyEmailView({ dictionary }: Props) {
  const copy = dictionary.accountActions;
  const token = useSearchParams().get("token");
  const action = usePathname().endsWith("/confirm-email") ? "confirm-email" : "verify-email";
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitAccountAction(action, { token });
      setDone(true);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (failure) {
      setError(accountActionError(failure, dictionary));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionCard title={copy.verifyTitle}>
      {done ? (
        <Alert variant="success">{copy.verifyDone}</Alert>
      ) : !token ? (
        <Alert variant="danger">{copy.invalidLink}</Alert>
      ) : (
        <>
          <p>{copy.verifyHelp}</p>
          {error && <Alert variant="danger">{error}</Alert>}
          <Button className="w-100" type="button" disabled={busy} onClick={() => void verify()}>
            {busy ? (
              <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
            ) : (
              <ActionIcon action="verify" />
            )}
            {copy.verifyTitle}
          </Button>
        </>
      )}
      <Link className="d-inline-block mt-3" href={`/login`}>
        {copy.backToLogin}
      </Link>
    </ActionCard>
  );
}
