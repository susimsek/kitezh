"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "@/lib/form";
import { z } from "zod";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";

import { useDictionary } from "@/i18n/client";
import { applyProblemToForm } from "@/lib/problem-detail";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { useAdminAuth } from "./AdminAuthProvider";
import { adminRequest } from "@/lib/admin-api";
import { AdminActionIcon } from "./AdminActionIcon";
import { ViewHeader } from "./ViewHeader";

type Settings = {
  enabled: boolean;
  fromAddress: string;
  baseUrl: string;
  host: string;
  port: number;
  username: string;
  password: string;
  smtpAuth: boolean;
  starttls: boolean;
  ssl: boolean;
};
type EmailResponse = Omit<Settings, "password"> & { passwordConfigured: boolean };

export default function EmailSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const copy = useDictionary().admin.emailSettings;
  const validation = useDictionary().admin.common.validation;
  const { accessToken } = useAdminAuth();
  const alerts = useConsoleAlerts();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [testing, setTesting] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const schema = z.object({
    enabled: z.boolean(),
    fromAddress: z
      .string()
      .trim()
      .min(1, validation.required)
      .email(validation.email)
      .max(255, validation.max255),
    baseUrl: z
      .string()
      .trim()
      .min(1, validation.required)
      .url(validation.uri)
      .refine((value) => {
        try {
          return !new URL(value).hash;
        } catch {
          return false;
        }
      }, validation.uri)
      .max(255, validation.max255),
    host: z.string().trim().min(1, validation.required).max(255, validation.max255),
    port: z
      .number({ error: validation.invalid })
      .int()
      .min(1, validation.positiveNumber)
      .max(65535),
    username: z.string().max(255, validation.max255),
    password: z.string().max(1000, validation.max1000),
    smtpAuth: z.boolean(),
    starttls: z.boolean(),
    ssl: z.boolean(),
  });
  const {
    register,
    reset,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Settings>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      enabled: false,
      fromAddress: "",
      baseUrl: "",
      host: "",
      port: 587,
      username: "",
      password: "",
      smtpAuth: true,
      starttls: true,
      ssl: false,
    },
  });

  useEffect(() => {
    if (!accessToken) return;
    adminRequest<EmailResponse>(accessToken, { url: "/api/admin/settings/email" })
      .then((response) => {
        if (response.status >= 300) throw new Error();
        reset({ ...response.data, password: "" } as Settings);
        setPasswordConfigured(Boolean(response.data.passwordConfigured));
        setLoaded(true);
      })
      .catch(() => setError(true));
  }, [accessToken, reset]);

  const applySettingsProblem = (data: unknown, values: Settings) => {
    applyProblemToForm(data, setFieldError, {
      fields: ["fromAddress", "baseUrl", "host", "username", "password", "port"],
      fallbackMessage: ({ field }) => {
        const value = values[field as keyof Settings];
        return field === "fromAddress"
          ? !String(value ?? "").trim()
            ? validation.required
            : String(value).length > 255
              ? validation.max255
              : validation.email
          : field === "baseUrl"
            ? !String(value ?? "").trim()
              ? validation.required
              : String(value).length > 255
                ? validation.max255
                : validation.uri
            : field === "host"
              ? !String(value ?? "").trim()
                ? validation.required
                : validation.max255
              : field === "username"
                ? validation.max255
                : field === "password"
                  ? validation.max1000
                  : field === "port"
                    ? validation.positiveNumber
                    : validation.invalid;
      },
    });
  };

  const submit = handleSubmit(async (values) => {
    if (!accessToken) return;
    setError(false);
    try {
      const response = await adminRequest<EmailResponse>(accessToken, {
        method: "PUT",
        url: "/api/admin/settings/email",
        data: values,
      });
      if (response.status >= 300) {
        applySettingsProblem(response.data, values);
        throw new Error();
      }
      reset({ ...response.data, password: "" } as Settings);
      setPasswordConfigured(Boolean(response.data.passwordConfigured));
      alerts.addAlert(copy.saved);
    } catch {
      alerts.addError(copy.error);
    }
  });

  const testConnection = handleSubmit(async (values) => {
    if (!accessToken) return;
    setError(false);
    setTesting(true);
    try {
      const response = await adminRequest<null>(accessToken, {
        method: "POST",
        url: "/api/admin/settings/email/test",
        data: values,
      });
      if (response.status >= 300) {
        applySettingsProblem(response.data, values);
        throw new Error();
      }
      alerts.addAlert(copy.testConnectionSucceeded);
    } catch {
      alerts.addError(copy.testConnectionError);
    } finally {
      setTesting(false);
    }
  });

  return (
    <div className="d-grid gap-4">
      {!embedded && <ViewHeader title={copy.title} description={copy.subtitle} />}
      {error && <Alert variant="danger">{copy.error}</Alert>}
      <Card className="admin-panel-card">
        <Card.Body>
          {!loaded ? (
            <div role="status">{copy.loading}</div>
          ) : (
            <Form noValidate onSubmit={submit}>
              {embedded && <h2 className="h5 mb-3">{copy.title}</h2>}
              <Form.Check
                className="mb-4"
                type="switch"
                label={copy.enabled}
                {...register("enabled")}
              />
              <div className="d-grid gap-3">
                <Form.Group controlId="email-from-address">
                  <Form.Label>{copy.fromAddress}</Form.Label>
                  <Form.Control
                    isInvalid={Boolean(errors.fromAddress)}
                    {...register("fromAddress")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.fromAddress?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="email-port">
                  <Form.Label>{copy.port}</Form.Label>
                  <Form.Control
                    type="number"
                    isInvalid={Boolean(errors.port)}
                    {...register("port", { valueAsNumber: true })}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.port?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="email-host">
                  <Form.Label>{copy.host}</Form.Label>
                  <Form.Control isInvalid={Boolean(errors.host)} {...register("host")} />
                  <Form.Control.Feedback type="invalid">
                    {errors.host?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="email-username">
                  <Form.Label>{copy.username}</Form.Label>
                  <Form.Control isInvalid={Boolean(errors.username)} {...register("username")} />
                  <Form.Control.Feedback type="invalid">
                    {errors.username?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="email-password">
                  <Form.Label>{copy.password}</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="new-password"
                    isInvalid={Boolean(errors.password)}
                    {...register("password")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                  {passwordConfigured && <Form.Text>{copy.passwordConfigured}</Form.Text>}
                </Form.Group>
                <Form.Group controlId="email-base-url">
                  <Form.Label>{copy.baseUrl}</Form.Label>
                  <Form.Control isInvalid={Boolean(errors.baseUrl)} {...register("baseUrl")} />
                  <Form.Control.Feedback type="invalid">
                    {errors.baseUrl?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
              <div className="d-grid gap-3 my-4">
                <Form.Check type="switch" label={copy.smtpAuth} {...register("smtpAuth")} />
                <Form.Check type="switch" label={copy.starttls} {...register("starttls")} />
                <Form.Check type="switch" label={copy.ssl} {...register("ssl")} />
              </div>
              <div className="admin-form-actions">
                <Button
                  variant="secondary"
                  disabled={isSubmitting || testing}
                  onClick={() => void testConnection()}
                  type="button"
                >
                  {testing ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="send" />
                  )}
                  {copy.testConnection}
                </Button>
                <Button disabled={isSubmitting || testing} type="submit">
                  {isSubmitting ? (
                    <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                  ) : (
                    <AdminActionIcon action="save" />
                  )}
                  {copy.save}
                </Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
