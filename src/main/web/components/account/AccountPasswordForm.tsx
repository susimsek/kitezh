"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button, Card, Form, Spinner } from "react-bootstrap";
import { useForm } from "@/lib/form";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";
import type { Dictionary } from "@/i18n/get-dictionary";
import { requestAccount, type AccountApiError } from "@/lib/account-api";
import { applyProblemToForm } from "@/lib/problem-detail";

import { useAccountAuth } from "./AccountAuthProvider";

type Values = { currentPassword: string; newPassword: string; confirmPassword: string };

export function AccountPasswordForm({ dictionary }: { dictionary: Dictionary }) {
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const copy = dictionary.account;
  const [failed, setFailed] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const schema = z
    .object({
      currentPassword: z.string().min(1, copy.validation.required).max(200, copy.validation.max200),
      newPassword: z.string().min(12, copy.validation.password).max(128, copy.validation.max200),
      confirmPassword: z.string().min(1, copy.validation.required).max(200, copy.validation.max200),
    })
    .refine((values) => values.currentPassword !== values.newPassword, {
      path: ["newPassword"],
      message: copy.validation.passwordSame,
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ["confirmPassword"],
      message: copy.validation.passwordMismatch,
    });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const currentPassword = useWatch({ control, name: "currentPassword" }) ?? "";
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control, name: "confirmPassword" }) ?? "";
  const longEnough = newPassword.length >= 12;
  const shortEnough = newPassword.length <= 128;
  const differentFromCurrent = newPassword.length > 0 && newPassword !== currentPassword;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    if (!accessToken) return;
    setFailed(false);
    setPasswordUpdating(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "PUT",
        url: "/api/account/password",
        data: { currentPassword, newPassword },
      });
      reset();
      alerts.addAlert(copy.security.saved);
    } catch (error) {
      const result = applyProblemToForm((error as AccountApiError).data, setError, {
        fields: ["currentPassword", "newPassword"],
        fallbackMessage: ({ field }) =>
          field === "currentPassword" ? copy.validation.currentPassword : copy.validation.password,
      });
      if (result.firstField) {
        setFocus(result.firstField as "currentPassword" | "newPassword");
      }
      setFailed(true);
    } finally {
      setPasswordUpdating(false);
    }
  });

  return (
    <Card className="admin-panel-card account-panel-card">
      <Card.Header className="bg-body p-4 border-bottom">
        <h2 className="h5 mb-1">{copy.security.sectionTitle}</h2>
        <div className="small text-body-secondary">{copy.security.sectionHelp}</div>
      </Card.Header>
      <Card.Body className="p-4">
        {failed && (
          <div className="alert alert-danger" role="alert">
            {copy.common.operationError}
          </div>
        )}
        <Form onSubmit={submit} noValidate>
          <Form.Group className="mb-4" controlId="account-current-password">
            <Form.Label>
              {copy.security.currentPassword} <span aria-hidden="true">*</span>
            </Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
              isInvalid={Boolean(errors.currentPassword)}
              aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
            />
            <Form.Control.Feedback id="current-password-error" type="invalid">
              {errors.currentPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="account-new-password">
            <Form.Label>
              {copy.security.newPassword} <span aria-hidden="true">*</span>
            </Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              isInvalid={Boolean(errors.newPassword)}
              aria-describedby="password-policy new-password-error"
            />
            <Form.Control.Feedback id="new-password-error" type="invalid">
              {errors.newPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <div id="password-policy" className="account-password-policy mb-4" aria-live="polite">
            <div className="small fw-semibold mb-2">{copy.security.policyTitle}</div>
            <PolicyItem passed={longEnough} label={copy.security.policyMinLength} />
            <PolicyItem passed={shortEnough} label={copy.security.policyMaxLength} />
            <PolicyItem passed={differentFromCurrent} label={copy.security.policyDifferent} />
            <PolicyItem passed={passwordsMatch} label={copy.security.policyMatch} />
          </div>
          <Form.Group className="mb-4" controlId="account-confirm-password">
            <Form.Label>
              {copy.security.confirmPassword} <span aria-hidden="true">*</span>
            </Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              isInvalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
            />
            <Form.Control.Feedback id="confirm-password-error" type="invalid">
              {errors.confirmPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>
          <div className="account-form-actions pt-4 border-top">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting || passwordUpdating}
              data-testid="save-password"
            >
              {isSubmitting || passwordUpdating ? (
                <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
              ) : (
                <ActionIcon action="save" />
              )}
              {copy.common.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!isDirty || isSubmitting || passwordUpdating}
              onClick={() => {
                reset();
                setFailed(false);
              }}
            >
              <ActionIcon action="cancel" />
              {copy.common.cancel}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}

function PolicyItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`account-policy-item ${passed ? "is-valid" : ""}`}>
      {passed ? <ActionIcon action="check" className="m-0" /> : <Icon icon="circle" />}
      <span>{label}</span>
    </div>
  );
}
