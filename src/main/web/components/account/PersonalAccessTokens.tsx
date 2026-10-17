"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import { z } from "zod";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { EmptyState, ErrorState } from "@/components/admin/AsyncState";
import { useConsoleAlerts } from "@/components/auth/ConsoleAlerts";
import { ActionIcon } from "@/components/shared/ActionIcon";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useDateTimeFormatter } from "@/i18n/useDateTimeFormatter";
import { useForm } from "@/lib/form";
import { requestAccount } from "@/lib/account-api";
import { useAccountAuth } from "./AccountAuthProvider";

type PersonalAccessToken = {
  id: string | number;
  name: string;
  description?: string | null;
  createdAt: string;
  expiresAt: string | null;
  scope: string;
};

type CreatedPersonalAccessToken = PersonalAccessToken & { token: string };

const EXPIRY_CHOICES = ["7", "30", "60", "90", "custom", "never"] as const;

function customExpirationRange() {
  const today = new Date().toISOString().slice(0, 10);
  const minDate = new Date(`${today}T00:00:00.000Z`);
  minDate.setUTCDate(minDate.getUTCDate() + 1);
  const maxDate = new Date(`${today}T00:00:00.000Z`);
  maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 1);
  return {
    min: minDate.toISOString().slice(0, 10),
    max: maxDate.toISOString().slice(0, 10),
  };
}

export function PersonalAccessTokens({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.account.security.personalAccessTokens;
  const formatDateTime = useDateTimeFormatter();
  const { accessToken } = useAccountAuth();
  const alerts = useConsoleAlerts();
  const expirationRange = customExpirationRange();
  const [tokens, setTokens] = useState<PersonalAccessToken[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pending, setPending] = useState<PersonalAccessToken | null>(null);
  const [createdToken, setCreatedToken] = useState<CreatedPersonalAccessToken | null>(null);
  const [copying, setCopying] = useState(false);
  const form = useForm<{
    name: string;
    description: string;
    expiration: (typeof EXPIRY_CHOICES)[number];
    customExpirationDate: string;
  }>({
    resolver: zodResolver(
      z
        .object({
          name: z.string().trim().min(1, copy.nameRequired).max(100, copy.nameTooLong),
          description: z.string().trim().max(500, copy.descriptionTooLong),
          expiration: z.enum(EXPIRY_CHOICES),
          customExpirationDate: z.string(),
        })
        .superRefine((values, context) => {
          if (values.expiration === "custom" && !values.customExpirationDate) {
            context.addIssue({
              code: "custom",
              path: ["customExpirationDate"],
              message: copy.customDateRequired,
            });
          } else if (values.expiration === "custom") {
            if (values.customExpirationDate < expirationRange.min) {
              context.addIssue({
                code: "custom",
                path: ["customExpirationDate"],
                message: copy.customDateTooEarly,
              });
            } else if (values.customExpirationDate > expirationRange.max) {
              context.addIssue({
                code: "custom",
                path: ["customExpirationDate"],
                message: copy.customDateTooLate,
              });
            }
          }
        }),
    ),
    defaultValues: { name: "", description: "", expiration: "90", customExpirationDate: "" },
  });
  const expiration = form.watch("expiration");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setTokens(
        await requestAccount<PersonalAccessToken[]>(accessToken, {
          method: "GET",
          url: "/api/account/personal-access-tokens",
        }),
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    requestAccount<PersonalAccessToken[]>(accessToken, {
      method: "GET",
      url: "/api/account/personal-access-tokens",
    })
      .then((value) => {
        if (!active) return;
        setTokens(value);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const create = async ({
    name,
    description,
    expiration,
    customExpirationDate,
  }: {
    name: string;
    description: string;
    expiration: (typeof EXPIRY_CHOICES)[number];
    customExpirationDate: string;
  }) => {
    if (!accessToken) return;
    setCreating(true);
    try {
      const result = await requestAccount<CreatedPersonalAccessToken>(accessToken, {
        method: "POST",
        url: "/api/account/personal-access-tokens",
        data: {
          name: name.trim(),
          description: description.trim() || null,
          expiration,
          ...(expiration === "custom" ? { customExpirationDate } : {}),
        },
      });
      setCreatedToken(result);
      form.reset();
      await load();
      alerts.addAlert(copy.created);
    } catch {
      alerts.addError(copy.createError);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!accessToken || !pending) return;
    setRemoving(true);
    try {
      await requestAccount<void>(accessToken, {
        method: "DELETE",
        url: `/api/account/personal-access-tokens/${encodeURIComponent(pending.id)}`,
      });
      setPending(null);
      setCreatedToken((current) =>
        current && String(current.id) === String(pending.id) ? null : current,
      );
      await load();
      alerts.addAlert(copy.revoked);
    } catch {
      alerts.addError(copy.revokeError);
    } finally {
      setRemoving(false);
    }
  };

  const copyToken = async () => {
    if (!createdToken || !navigator.clipboard) {
      alerts.addError(copy.copyError);
      return;
    }
    setCopying(true);
    try {
      await navigator.clipboard.writeText(createdToken.token);
      alerts.addAlert(copy.copied);
    } catch {
      alerts.addError(copy.copyError);
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <Card className="admin-panel-card account-panel-card">
        <Card.Header className="bg-body p-4 border-bottom">
          <h2 className="h5 mb-1">{copy.title}</h2>
          <div className="small text-body-secondary">{copy.help}</div>
        </Card.Header>
        <Card.Body className="p-4">
          <Stack gap={3}>
            <Alert variant="info" className="mb-0">
              {copy.scopeHelp} <Badge bg="secondary">mcp.read</Badge>
            </Alert>
            {createdToken && (
              <Alert variant="warning" className="mb-0" role="status">
                <div className="fw-semibold">{copy.tokenCreatedTitle}</div>
                <div className="small mb-2">{copy.tokenCreatedHelp}</div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <code className="user-select-all text-break">{createdToken.token}</code>
                  <Button
                    disabled={copying}
                    onClick={() => void copyToken()}
                    type="button"
                    variant="secondary"
                  >
                    {copying ? (
                      <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                    ) : (
                      <ActionIcon action="copy" />
                    )}
                    {copy.copy}
                  </Button>
                  <Button onClick={() => setCreatedToken(null)} type="button" variant="secondary">
                    {copy.dismissToken}
                  </Button>
                </div>
              </Alert>
            )}
            {!loading && !error && (
              <Form noValidate onSubmit={form.handleSubmit(create)}>
                <Stack gap={2}>
                  <Form.Group controlId="personal-access-token-name">
                    <Form.Label>{copy.name}</Form.Label>
                    <Form.Control
                      autoComplete="off"
                      isInvalid={Boolean(form.formState.errors.name)}
                      maxLength={100}
                      {...form.register("name")}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.name?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group controlId="personal-access-token-description">
                    <Form.Label>{copy.description}</Form.Label>
                    <Form.Control
                      as="textarea"
                      isInvalid={Boolean(form.formState.errors.description)}
                      maxLength={500}
                      rows={2}
                      {...form.register("description")}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.description?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group controlId="personal-access-token-expiry">
                    <Form.Label>{copy.expiresAfter}</Form.Label>
                    <Form.Select {...form.register("expiration")}>
                      <option value="7">{copy.expiryDays.replace("{{count}}", "7")}</option>
                      <option value="30">{copy.expiryDays.replace("{{count}}", "30")}</option>
                      <option value="60">{copy.expiryDays.replace("{{count}}", "60")}</option>
                      <option value="90">{copy.expiryDays.replace("{{count}}", "90")}</option>
                      <option value="custom">{copy.customDate}</option>
                      <option value="never">{copy.neverExpires}</option>
                    </Form.Select>
                    {expiration === "custom" && (
                      <>
                        <Form.Control
                          className="mt-2"
                          type="date"
                          aria-label={copy.customDate}
                          min={expirationRange.min}
                          max={expirationRange.max}
                          isInvalid={Boolean(form.formState.errors.customExpirationDate)}
                          {...form.register("customExpirationDate")}
                        />
                        <Form.Control.Feedback className="d-block" type="invalid">
                          {form.formState.errors.customExpirationDate?.message}
                        </Form.Control.Feedback>
                      </>
                    )}
                    {expiration === "never" && (
                      <Alert className="mt-2 mb-0" variant="warning">
                        {copy.neverExpiresWarning}
                      </Alert>
                    )}
                  </Form.Group>
                  <div>
                    <Button disabled={creating} type="submit">
                      {creating ? (
                        <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
                      ) : (
                        <ActionIcon action="add" />
                      )}
                      {copy.create}
                    </Button>
                  </div>
                </Stack>
              </Form>
            )}
            {loading ? (
              <div className="d-flex align-items-center gap-2" role="status">
                <Spinner animation="border" size="sm" />
                <span>{dictionary.account.common.loading}</span>
              </div>
            ) : error ? (
              <ErrorState message={copy.loadError} />
            ) : (tokens ?? []).length === 0 ? (
              <EmptyState message={copy.empty} />
            ) : (
              <Stack gap={2}>
                {(tokens ?? []).map((token) => (
                  <div
                    className="d-flex align-items-start justify-content-between gap-3 border rounded-2 p-3"
                    key={token.id}
                  >
                    <div className="min-w-0">
                      <div className="fw-semibold text-break">{token.name}</div>
                      {token.description && (
                        <div className="small text-body-secondary mt-1 text-break">
                          {token.description}
                        </div>
                      )}
                      <div className="small text-body-secondary mt-1">
                        {copy.createdAt}: {formatDateTime(token.createdAt)}
                      </div>
                      <div className="small text-body-secondary">
                        {copy.expiresAt}:{" "}
                        {token.expiresAt ? formatDateTime(token.expiresAt) : copy.neverExpires}
                      </div>
                      <Badge bg="secondary" className="mt-2">
                        {token.scope}
                      </Badge>
                    </div>
                    <Button
                      disabled={removing}
                      onClick={() => setPending(token)}
                      type="button"
                      variant="danger"
                    >
                      <ActionIcon action="delete" />
                      {copy.revoke}
                    </Button>
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </Card.Body>
      </Card>
      <ConfirmModal
        show={pending !== null}
        message={copy.revokeConfirm}
        cancelLabel={dictionary.admin.common.cancel}
        confirmLabel={copy.revoke}
        confirmAction="delete"
        busy={removing}
        onCancel={() => setPending(null)}
        onConfirm={() => void revoke()}
      />
    </>
  );
}
